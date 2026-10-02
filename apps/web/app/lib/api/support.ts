import { adminFetch } from './admin.js';
import { apiFetch } from './client.js';

export type TicketIssueType = 'LOGIN' | 'SURVEY' | 'SURVEY_PAYMENT' | 'REWARDS' | 'UNSUBSCRIBE' | 'OTHER';
export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type SenderType = 'bot' | 'user' | 'admin';

export interface TicketMessage {
  id: string;
  senderType: SenderType;
  message: string;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  issueType: TicketIssueType;
  subject: string | null;
  status: TicketStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

export interface FlowOption {
  label: string;
  next: string;
}

export interface FlowNode {
  id: string;
  message: string;
  options?: FlowOption[];
  resolution?: boolean;
  escalate?: boolean;
  action?: { type: 'navigate'; href: string };
  suppressEscalation?: boolean;
}

export interface ChatbotFlow {
  topic: string;
  issueType: TicketIssueType;
  title: string;
  icon: string;
  escalable: boolean;
  dpoRouted: boolean;
  entryNodeId: string;
  nodes: Record<string, FlowNode>;
}

export interface TranscriptLine {
  senderType: SenderType;
  message: string;
}

// Admin types
export interface AdminTicketRow {
  id: string;
  userId: string;
  userEmail: string;
  username: string;
  issueType: TicketIssueType;
  subject: string | null;
  status: TicketStatus;
  assigneeAdminId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTicketDetail extends AdminTicketRow {
  messages: TicketMessage[];
}

export const supportApi = {
  // Chatbot
  listFlows(): Promise<ChatbotFlow[]> {
    return apiFetch('/chatbot/flows');
  },

  // Member tickets
  createTicket(body: {
    topic: string;
    subject?: string;
    transcript: TranscriptLine[];
    message: string;
  }): Promise<TicketSummary> {
    return apiFetch('/support/tickets', { method: 'POST', body });
  },

  listMyTickets(params?: { status?: string; limit?: number; cursor?: string }): Promise<{
    items: TicketSummary[];
    pagination: { nextCursor: string | null; hasMore: boolean; limit: number };
  }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const q = qs.toString();
    return apiFetch(`/support/tickets${q ? `?${q}` : ''}`);
  },

  getMyTicket(id: string): Promise<TicketDetail> {
    return apiFetch(`/support/tickets/${id}`);
  },

  addMessage(ticketId: string, message: string): Promise<TicketMessage> {
    return apiFetch(`/support/tickets/${ticketId}/messages`, { method: 'POST', body: { message } });
  },

  // Admin
  async adminListTickets(params?: {
    status?: string;
    issueType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AdminTicketRow[]; pagination: { total: number; page: number; pageSize: number } }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.issueType) qs.set('issueType', params.issueType);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    // API returns { items, total, page, pageSize } — adapt to { items, pagination }.
    const res = await adminFetch<{ items: AdminTicketRow[]; total: number; page: number; pageSize: number }>(
      `/admin/support/tickets${q ? `?${q}` : ''}`,
    );
    return {
      items: res.items ?? [],
      pagination: { total: res.total ?? 0, page: res.page ?? 1, pageSize: res.pageSize ?? 20 },
    };
  },

  adminGetTicket(id: string): Promise<AdminTicketDetail> {
    return adminFetch(`/admin/support/tickets/${id}`);
  },

  adminUpdateTicket(id: string, body: { status?: string; assigneeAdminId?: string }): Promise<AdminTicketRow> {
    return adminFetch(`/admin/support/tickets/${id}`, { method: 'PUT', body });
  },

  adminAddMessage(ticketId: string, message: string): Promise<TicketMessage> {
    return adminFetch(`/admin/support/tickets/${ticketId}/messages`, { method: 'POST', body: { message } });
  },
};
