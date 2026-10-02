import { z } from 'zod';

export type TicketIssueType = 'LOGIN' | 'SURVEY' | 'SURVEY_PAYMENT' | 'REWARDS' | 'UNSUBSCRIBE' | 'OTHER';
export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
export type SenderType = 'bot' | 'user' | 'admin';

export interface SupportTicketSummary {
  id: string;
  issueType: TicketIssueType;
  subject: string | null;
  status: TicketStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessage {
  id: string;
  senderType: SenderType;
  message: string;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  messages: SupportTicketMessage[];
}

// Flow types (for chatbot)
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

// Transcript line for escalation
export interface TranscriptLine {
  senderType: SenderType;
  message: string;
}

// Zod schemas (no .default(), no .transform())
// Members submit the chatbot conversation they had. Only 'bot'/'user' lines are
// accepted — 'admin' lines are written by staff replies server-side, so a member
// can't forge messages that look like they came from support.
export const transcriptLineSchema = z.object({
  senderType: z.enum(['bot', 'user']),
  message: z.string().min(1).max(4000),
});

export const createTicketSchema = z.object({
  topic: z.string().min(1).max(100),
  subject: z.string().min(1).max(200).optional(),
  transcript: z.array(transcriptLineSchema).min(1).max(50),
  message: z.string().min(1).max(4000),
});

export const postTicketMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  assigneeAdminId: z.string().uuid().optional(),
});

// Admin ticket row (list view)
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
  messages: SupportTicketMessage[];
}

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type PostTicketMessageInput = z.infer<typeof postTicketMessageSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
