import { Injectable, Logger } from '@nestjs/common';

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
export interface PushMessage { tokens: string[]; title: string; body: string; data?: Record<string, string> }
export interface PushProvider {
  send(msg: PushMessage): Promise<{ providerMessageId: string; failedTokens: string[] }>;
}

@Injectable()
export class NoopPushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  send(msg: PushMessage): Promise<{ providerMessageId: string; failedTokens: string[] }> {
    this.logger.log(`[NOOP PUSH] To: ${msg.tokens.length} token(s) — ${msg.title}`);
    return Promise.resolve({ providerMessageId: `noop-push-${Date.now()}`, failedTokens: [] });
  }
}
