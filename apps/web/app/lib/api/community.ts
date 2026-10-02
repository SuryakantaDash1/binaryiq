import type { AnnouncementPage } from '@influencer/types';

import { apiFetch } from './client.js';

export const communityApi = {
  listAnnouncements(params?: { page?: number; pageSize?: number }): Promise<AnnouncementPage> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return apiFetch(`/community/announcements${q ? `?${q}` : ''}`);
  },
};
