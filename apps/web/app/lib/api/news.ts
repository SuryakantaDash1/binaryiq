import type { ArticlePage } from '@binaryiq/types';

import { apiFetch } from './client.js';

export const newsApi = {
  listArticles(params?: { page?: number; pageSize?: number; category?: string }): Promise<ArticlePage> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.category) qs.set('category', params.category);
    const q = qs.toString();
    return apiFetch(`/news/articles${q ? `?${q}` : ''}`);
  },
};
