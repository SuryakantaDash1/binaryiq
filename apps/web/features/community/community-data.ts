/**
 * Static mock content for the Community page's Forum tab.
 * No backend exists for forum/contests, so this stands in for a future CMS.
 * Brand-safe: no "Toluna" text — everything is "Influencers"/"our".
 */

export interface ForumCategory {
  id: string;
  title: string;
  description: string;
  categories: number;
  threads: number;
}

export const FORUM_CATEGORIES: ForumCategory[] = [
  {
    id: 'interest-groups',
    title: 'Interest groups',
    description:
      'Join the groups you are most interested in to share great ideas and engage with likeminded people.',
    categories: 6,
    threads: 1,
  },
];
