import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Provider abstraction — swap the console impl for SendGrid in Phase 7. */
export abstract class EmailProvider {
  abstract send(message: EmailMessage): Promise<void>;
}

/**
 * Dev/no-op email provider: logs the message (and any links) instead of sending.
 * Lets the registration + reset flows work end-to-end without SendGrid.
 */
@Injectable()
export class ConsoleEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`✉  To: ${message.to} — ${message.subject}`);
    const link = /href="([^"]+)"/.exec(message.html)?.[1];
    if (link) this.logger.log(`   Link: ${link}`);
    return Promise.resolve();
  }
}
