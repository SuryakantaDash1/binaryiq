import { adminFetch } from './admin.js';
import { apiFetch } from './client.js';

export type ConsentType = 'TERMS' | 'PRIVACY' | 'MARKETING' | 'COOKIES';

export interface ConsentLogDTO {
  id: string;
  consentType: ConsentType;
  consentVersion: string;
  granted: boolean;
  ipAddress: string | null;
  createdAt: string;
}

export interface ConsentState {
  current: Partial<Record<ConsentType, boolean>>;
  history: ConsentLogDTO[];
}

export const dataRightsApi = {
  // Member — consents
  getConsents(): Promise<ConsentState> {
    return apiFetch('/consents');
  },

  grantConsent(body: { consentType: ConsentType; consentVersion: string; granted: boolean }): Promise<ConsentLogDTO> {
    return apiFetch('/consents', { method: 'POST', body });
  },

  // Data export
  requestExport(): Promise<{ downloadUrl: string; expiresAt: string }> {
    return apiFetch('/account/data-export');
  },

  // Erasure
  deleteAccount(confirm: string): Promise<{ status: string; purgeEligibleAt: string }> {
    return apiFetch('/account', { method: 'DELETE', body: { confirm } });
  },

  // Admin
  adminGetAuditLogs(params?: {
    actorType?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<{
      id: string;
      actorType: string;
      actorId: string | null;
      action: string;
      targetType: string | null;
      targetId: string | null;
      ipAddress: string | null;
      metadata: unknown;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.actorType) qs.set('actorType', params.actorType);
    if (params?.action) qs.set('action', params.action);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return adminFetch(`/admin/audit-logs${q ? `?${q}` : ''}`);
  },

  adminGetConsents(params?: {
    userId?: string;
    consentType?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    data: ConsentLogDTO[];
    meta: { pagination: { nextCursor: string | null; hasMore: boolean; limit: number } };
  }> {
    const qs = new URLSearchParams();
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.consentType) qs.set('consentType', params.consentType);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const q = qs.toString();
    return adminFetch(`/admin/consents${q ? `?${q}` : ''}`, { raw: true });
  },
};
