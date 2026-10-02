import type {
  ArticleView,
  ArticlePage,
  ArticleQuery,
  FeedSourceView,
  FeedSourcePage,
  CreateFeedSourceInput,
  UpdateFeedSourceInput,
} from '@influencer/types';
import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

import { NotFoundException, ValidationException } from '../../common/exceptions/domain.exception';
import { assertPublicHttpUrl, fetchPublicText, FetchFailedError, UnsafeUrlError } from '../../common/net/public-fetch';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ITEMS_PER_SOURCE = 20;
const SUMMARY_MAX_LEN = 400;

/** Strips HTML tags and collapses whitespace — summaries are rendered as plain text. */
function stripHtml(input: string | undefined): string | null {
  if (!input) return null;
  const text = input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > SUMMARY_MAX_LEN ? `${text.slice(0, SUMMARY_MAX_LEN - 1)}…` : text;
}

interface MediaTag {
  $?: { url?: string };
}
type FeedItem = Parser.Item & {
  'media:thumbnail'?: MediaTag | MediaTag[];
  'media:content'?: MediaTag | MediaTag[];
};

/**
 * A short, fixed description of a poll failure. Raw error text can reveal internal
 * hosts, ports or file paths, so it never reaches the admin UI or the database.
 */
function feedErrorMessage(err: unknown): string {
  if (err instanceof UnsafeUrlError) return 'Blocked: feed address is not a public internet host';
  if (err instanceof FetchFailedError) return err.message; // our own fixed messages, e.g. "HTTP 404"
  if (err instanceof Error && /ENOTFOUND|EAI_AGAIN/.test((err as NodeJS.ErrnoException).code ?? '')) return 'Could not resolve host';
  if (err instanceof Error && /ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test((err as NodeJS.ErrnoException).code ?? '')) return 'Could not connect';
  if (err instanceof Error && /xml|feed|parse|non-whitespace|unexpected/i.test(err.message)) return 'Could not parse feed';
  return 'Could not fetch feed';
}

/** Feeds are untrusted: keep only http(s) URLs so a `javascript:` link can never reach a page. */
function httpUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Pulls an image URL out of whatever shape a given feed uses (standard RSS enclosure,
 *  MediaRSS thumbnail/content, or a bare <img> inside the HTML content as a last resort). */
function extractImageUrl(item: FeedItem): string | null {
  if (item.enclosure?.url) return item.enclosure.url;

  const media = item['media:thumbnail'] ?? item['media:content'];
  const first = Array.isArray(media) ? media[0] : media;
  if (first?.$?.url) return first.$.url;

  const html = item.content ?? item.summary;
  const match = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly parser = new Parser({
    timeout: 15_000,
    customFields: { item: ['media:thumbnail', 'media:content'] },
  });

  constructor(private readonly prisma: PrismaService) {}

  // ─── Member-facing articles ──────────────────────────────────────
  async listArticles(query: ArticleQuery): Promise<ArticlePage> {
    const where = query.category ? { source: { category: query.category } } : {};
    const [total, rows] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { source: true },
      }),
    ]);
    return {
      items: rows.map(this.toArticleView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ─── Admin: feed sources ─────────────────────────────────────────
  async adminListSources(page = 1, pageSize = 20): Promise<FeedSourcePage> {
    const [total, rows] = await Promise.all([
      this.prisma.feedSource.count(),
      this.prisma.feedSource.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(this.toSourceView), total, page, pageSize };
  }

  async adminCreateSource(input: CreateFeedSourceInput): Promise<FeedSourceView> {
    await this.assertFetchableFeedUrl(input.feedUrl);
    const source = await this.prisma.feedSource.create({
      data: {
        name: input.name,
        feedUrl: input.feedUrl,
        category: input.category,
        isActive: input.isActive ?? true,
      },
    });
    return this.toSourceView(source);
  }

  async adminUpdateSource(id: string, input: UpdateFeedSourceInput): Promise<FeedSourceView> {
    const existing = await this.prisma.feedSource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feed source not found');
    if (input.feedUrl !== undefined) await this.assertFetchableFeedUrl(input.feedUrl);
    const source = await this.prisma.feedSource.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.feedUrl !== undefined ? { feedUrl: input.feedUrl } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.toSourceView(source);
  }

  async adminPollSourceNow(id: string): Promise<FeedSourceView> {
    const source = await this.prisma.feedSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Feed source not found');
    await this.pollSource(source);
    const updated = await this.prisma.feedSource.findUniqueOrThrow({ where: { id } });
    return this.toSourceView(updated);
  }

  // ─── Polling (called by NewsProcessor on the repeat job) ─────────
  async pollAllActiveSources(): Promise<void> {
    const sources = await this.prisma.feedSource.findMany({ where: { isActive: true } });
    for (const source of sources) {
      // One broken feed must never block the rest.
      await this.pollSource(source).catch((e: unknown) => {
        this.logger.error(`Unexpected error polling source ${source.name}`, e);
      });
    }
  }

  private async pollSource(source: { id: string; name: string; feedUrl: string }): Promise<void> {
    try {
      // Our own fetch (public addresses only, size/time capped) instead of
      // parser.parseURL, which would follow the URL anywhere — including our network.
      const xml = await fetchPublicText(source.feedUrl, {
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      });
      const feed = await this.parser.parseString(xml);
      const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE);

      for (const item of items) {
        const link = httpUrl(item.link);
        if (!link) continue;
        const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : new Date();
        const imageUrl = httpUrl(extractImageUrl(item as FeedItem));

        await this.prisma.article.upsert({
          where: { link },
          update: {
            title: item.title ?? link,
            summary: stripHtml(item.contentSnippet ?? item.content),
            imageUrl,
            publishedAt,
          },
          create: {
            sourceId: source.id,
            title: item.title ?? link,
            link,
            summary: stripHtml(item.contentSnippet ?? item.content),
            imageUrl,
            publishedAt,
          },
        });
      }

      await this.prisma.feedSource.update({
        where: { id: source.id },
        data: { lastPolledAt: new Date(), lastError: null },
      });
    } catch (err) {
      const message = feedErrorMessage(err);
      this.logger.warn(`Failed to poll feed "${source.name}": ${message}`);
      await this.prisma.feedSource.update({
        where: { id: source.id },
        data: { lastPolledAt: new Date(), lastError: message },
      });
    }
  }

  private async assertFetchableFeedUrl(feedUrl: string): Promise<void> {
    try {
      await assertPublicHttpUrl(feedUrl);
    } catch (err) {
      throw new ValidationException(
        err instanceof UnsafeUrlError
          ? 'Feed URL must point to a public internet address'
          : 'Could not resolve the feed URL host',
      );
    }
  }

  // ─── Mappers ──────────────────────────────────────────────────────
  private toArticleView = (row: {
    id: string;
    title: string;
    link: string;
    summary: string | null;
    imageUrl: string | null;
    publishedAt: Date;
    source: { name: string; category: string | null };
  }): ArticleView => ({
    id: row.id,
    title: row.title,
    link: row.link,
    summary: row.summary,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt.toISOString(),
    sourceName: row.source.name,
    sourceCategory: row.source.category,
  });

  private toSourceView = (row: {
    id: string;
    name: string;
    feedUrl: string;
    category: string | null;
    isActive: boolean;
    lastPolledAt: Date | null;
    lastError: string | null;
    createdAt: Date;
  }): FeedSourceView => ({
    id: row.id,
    name: row.name,
    feedUrl: row.feedUrl,
    category: row.category,
    isActive: row.isActive,
    lastPolledAt: row.lastPolledAt ? row.lastPolledAt.toISOString() : null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  });
}
