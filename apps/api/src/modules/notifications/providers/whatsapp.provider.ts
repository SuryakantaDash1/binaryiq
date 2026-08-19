import { Injectable, Logger } from '@nestjs/common';

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export interface WhatsAppMessage { to: string; templateId: string; data: Record<string, string> }
export interface WhatsAppProvider {
  send(msg: WhatsAppMessage): Promise<{ providerMessageId: string }>;
}

@Injectable()
export class NoopWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger('WhatsApp');
  send(msg: WhatsAppMessage): Promise<{ providerMessageId: string }> {
    this.logger.log(`[NOOP WhatsApp] To: ${msg.to} template=${msg.templateId}`);
    return Promise.resolve({ providerMessageId: `noop-wa-${Date.now()}` });
  }
}
