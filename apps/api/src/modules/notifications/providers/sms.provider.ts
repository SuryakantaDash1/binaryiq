import { Injectable, Logger } from '@nestjs/common';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export interface SmsMessage { to: string; body: string }
export interface SmsProvider {
  send(msg: SmsMessage): Promise<{ providerMessageId: string }>;
}

@Injectable()
export class NoopSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  send(msg: SmsMessage): Promise<{ providerMessageId: string }> {
    this.logger.log(`[NOOP SMS] not sent (${msg.body.length} chars)`);
    return Promise.resolve({ providerMessageId: `noop-sms-${Date.now()}` });
  }
}
