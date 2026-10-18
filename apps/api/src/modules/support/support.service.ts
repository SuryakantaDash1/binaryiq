
import type { TicketIssueType, TicketStatus } from '@binaryiq/db';
import type {
  AdminTicketDetail,
  AdminTicketRow,
  CreateTicketInput,
  PostTicketMessageInput,
  SupportTicketDetail,
  SupportTicketMessage,
  SupportTicketSummary,
  UpdateTicketInput,
} from '@binaryiq/types';
import { Injectable, Logger } from '@nestjs/common';

import {
  NotFoundException,
  UnprocessableException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../notifications/email.provider';
import { NotificationsService } from '../notifications/notifications.service';

import { ChatbotService } from './chatbot.service';

const ALLOWED_TRANSITIONS = new Map<TicketStatus, TicketStatus[]>([
  ['OPEN', ['PENDING']],
  ['PENDING', ['RESOLVED']],
  ['RESOLVED', ['CLOSED', 'PENDING']],
  ['CLOSED', []],
]);

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbot: ChatbotService,
    private readonly notifications: NotificationsService,
    private readonly emailProvider: EmailProvider,
  ) {}

  // ─── Member: Create ticket ────────────────────────────────────────

  async createTicket(
    userId: string,
    dto: CreateTicketInput,
    ip: string | null = null,
  ): Promise<SupportTicketSummary> {
    const flow = this.chatbot.getFlow(dto.topic);
    if (!flow.escalable) throw new UnprocessableException('topic_not_escalable');

    const transcriptRows = dto.transcript.map((line) => ({
      senderType: line.senderType,
      message: line.message,
    }));

    const ticket = await this.prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          userId,
          issueType: flow.issueType as TicketIssueType,
          subject: dto.subject ?? flow.title,
          status: 'OPEN',
        },
      });

      await tx.supportTicketMessage.createMany({
        data: [
          ...transcriptRows.map((line) => ({
            ticketId: t.id,
            senderType: line.senderType,
            message: line.message,
          })),
          {
            ticketId: t.id,
            senderType: 'user',
            message: dto.message,
          },
        ],
      });

      return t;
    });

    // Post-transaction: send admin emails
    try {
      const admins = await this.prisma.admin.findMany({
        where: { role: { in: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      });
      // Subject is member-supplied: strip it to plain text before it reaches a mail client.
      const safeSubject = (ticket.subject ?? flow.title).replace(/[<>&"'\r\n]/g, ' ').slice(0, 120);
      const subject = `New support ticket — ${safeSubject}`;
      const html = `<p>Ticket <strong>#${ticket.id}</strong> — ${flow.title}: ${safeSubject}</p><p>User ID: ${userId}</p>`;
      for (const admin of admins) {
        await this.emailProvider.send({ to: admin.email, subject, html }).catch((err: unknown) => {
          this.logger.warn(`Failed to email admin ${admin.id}: ${String(err)}`);
        });
      }

      if (flow.dpoRouted) {
        const dpoAdmins = await this.prisma.admin.findMany({
          where: { role: 'DPO', isActive: true },
        });
        const dpoSubject = `DPO routing — ${safeSubject}`;
        const dpoHtml = `<p>Ticket <strong>#${ticket.id}</strong> has been routed to the DPO team.</p><p>User ID: ${userId}</p>`;
        for (const dpo of dpoAdmins) {
          await this.emailProvider.send({ to: dpo.email, subject: dpoSubject, html: dpoHtml }).catch((err: unknown) => {
            this.logger.warn(`Failed to email DPO ${dpo.id}: ${String(err)}`);
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Admin email dispatch error: ${String(err)}`);
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'support.ticket.create',
        targetType: 'ticket',
        targetId: ticket.id,
        ipAddress: ip,
      },
    });

    const count = await this.prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } });

    return {
      id: ticket.id,
      issueType: ticket.issueType as TicketIssueType,
      subject: ticket.subject,
      status: ticket.status as TicketStatus,
      messageCount: count,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  // ─── Member: List tickets (cursor pagination) ─────────────────────

  async listTickets(
    userId: string,
    query: { status?: TicketStatus; limit?: number; cursor?: string },
  ): Promise<{ items: SupportTicketSummary[]; pagination: { nextCursor: string | null; hasMore: boolean } }> {
    const limit = query.limit ?? 20;
    const cursorDate = query.cursor
      ? new Date(Buffer.from(query.cursor, 'base64url').toString())
      : undefined;

    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { _count: { select: { messages: true } } },
    });

    const hasMore = tickets.length > limit;
    const page = tickets.slice(0, limit);
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1]!.createdAt.toISOString()).toString('base64url')
      : null;

    return {
      items: page.map((t) => ({
        id: t.id,
        issueType: t.issueType as TicketIssueType,
        subject: t.subject,
        status: t.status as TicketStatus,
        messageCount: t._count.messages,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      pagination: { nextCursor, hasMore },
    };
  }

  // ─── Member: Get single ticket ────────────────────────────────────

  async getTicket(userId: string, ticketId: string): Promise<SupportTicketDetail> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        _count: { select: { messages: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return {
      id: ticket.id,
      issueType: ticket.issueType as TicketIssueType,
      subject: ticket.subject,
      status: ticket.status as TicketStatus,
      messageCount: ticket._count.messages,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map(this.toMessageDto),
    };
  }

  // ─── Member: Add message ──────────────────────────────────────────

  async addMessage(
    userId: string,
    ticketId: string,
    dto: PostTicketMessageInput,
  ): Promise<SupportTicketMessage> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === 'CLOSED') throw new UnprocessableException('ticket_closed');

    const reopenUpdate = ticket.status === 'RESOLVED' ? { status: 'PENDING' as TicketStatus } : {};

    // Always touch the ticket (bumps updatedAt via @updatedAt) so it surfaces as recently active.
    const [msg] = await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: { ticketId, senderType: 'user', message: dto.message },
      }),
      this.prisma.supportTicket.update({ where: { id: ticketId }, data: reopenUpdate }),
    ]);

    return this.toMessageDto(msg);
  }

  // ─── Admin: List tickets (offset pagination) ──────────────────────

  async adminListTickets(query: {
    status?: TicketStatus;
    issueType?: TicketIssueType;
    assigneeId?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AdminTicketRow[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.issueType ? { issueType: query.issueType } : {}),
      ...(query.assigneeId ? { assigneeAdminId: query.assigneeId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [total, tickets] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, username: true } },
          _count: { select: { messages: true } },
        },
      }),
    ]);

    return {
      items: tickets.map((t) => ({
        id: t.id,
        userId: t.userId,
        userEmail: t.user.email,
        username: t.user.username,
        issueType: t.issueType as TicketIssueType,
        subject: t.subject,
        status: t.status as TicketStatus,
        assigneeAdminId: t.assigneeAdminId,
        messageCount: t._count.messages,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ─── Admin: Get single ticket ─────────────────────────────────────

  // Read-only — intentionally not audit-logged (a page view isn't an auditable action).
  async adminGetTicket(adminId: string, ticketId: string): Promise<AdminTicketDetail> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, email: true, username: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        _count: { select: { messages: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return {
      id: ticket.id,
      userId: ticket.userId,
      userEmail: ticket.user.email,
      username: ticket.user.username,
      issueType: ticket.issueType as TicketIssueType,
      subject: ticket.subject,
      status: ticket.status as TicketStatus,
      assigneeAdminId: ticket.assigneeAdminId,
      messageCount: ticket._count.messages,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      messages: ticket.messages.map(this.toMessageDto),
    };
  }

  // ─── Admin: Update ticket ─────────────────────────────────────────

  async adminUpdateTicket(
    adminId: string,
    ticketId: string,
    dto: UpdateTicketInput,
    ip: string | null = null,
  ): Promise<AdminTicketRow> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true, email: true, username: true } }, _count: { select: { messages: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (dto.status) {
      const allowed = ALLOWED_TRANSITIONS.get(ticket.status as TicketStatus) ?? [];
      if (!allowed.includes(dto.status as TicketStatus)) {
        throw new UnprocessableException('invalid_status_transition');
      }
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(dto.status ? { status: dto.status as TicketStatus } : {}),
        ...(dto.assigneeAdminId !== undefined ? { assigneeAdminId: dto.assigneeAdminId } : {}),
      },
      include: { user: { select: { id: true, email: true, username: true } }, _count: { select: { messages: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'admin',
        actorId: adminId,
        action: 'admin.ticket.update',
        targetType: 'ticket',
        targetId: ticketId,
        ipAddress: ip,
        metadata: { status: dto.status, assigneeAdminId: dto.assigneeAdminId },
      },
    });

    if (dto.status === 'RESOLVED') {
      await this.notifications
        .send(ticket.userId, 'OFFERS_NEWS', {
          title: 'Support ticket resolved',
          message: 'Your support ticket has been resolved.',
        })
        .catch((err: unknown) => {
          this.logger.warn(`Failed to notify user on resolve: ${String(err)}`);
        });
    }

    return {
      id: updated.id,
      userId: updated.userId,
      userEmail: updated.user.email,
      username: updated.user.username,
      issueType: updated.issueType as TicketIssueType,
      subject: updated.subject,
      status: updated.status as TicketStatus,
      assigneeAdminId: updated.assigneeAdminId,
      messageCount: updated._count.messages,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── Admin: Add message ───────────────────────────────────────────

  async adminAddMessage(
    adminId: string,
    ticketId: string,
    dto: PostTicketMessageInput,
    ip: string | null = null,
  ): Promise<SupportTicketMessage> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Touch the ticket (bumps updatedAt via @updatedAt) so it surfaces as recently active.
    const [msg] = await this.prisma.$transaction([
      this.prisma.supportTicketMessage.create({
        data: { ticketId, senderType: 'admin', message: dto.message },
      }),
      this.prisma.supportTicket.update({ where: { id: ticketId }, data: {} }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        actorType: 'admin',
        actorId: adminId,
        action: 'admin.ticket.message',
        targetType: 'ticket',
        targetId: ticketId,
        ipAddress: ip,
      },
    });

    await this.notifications
      .send(ticket.userId, 'OFFERS_NEWS', {
        title: 'New reply from support',
        message: dto.message,
      })
      .catch((err: unknown) => {
        this.logger.warn(`Failed to notify user on admin reply: ${String(err)}`);
      });

    return this.toMessageDto(msg);
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private toMessageDto(m: {
    id: string;
    senderType: string;
    message: string;
    createdAt: Date;
  }): SupportTicketMessage {
    return {
      id: m.id,
      senderType: m.senderType as SupportTicketMessage['senderType'],
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
