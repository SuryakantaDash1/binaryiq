import { Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export abstract class EmailProvider {
  abstract send(message: EmailMessage): Promise<void>;
}

/** "jane.doe@example.com" → "j***@example.com" — safe to put in logs. */
/** The provider's short error text (e.g. "domain is not verified"), capped — useful in logs, never contains our key. */
async function providerReason(res: Response): Promise<string> {
  try {
    return (await res.text()).replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return '(no details)';
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Fallback when SendGrid isn't configured. Never sends, never logs the full
 * address, and only prints links (which carry one-time reset/verify tokens)
 * in local development. Production refuses to boot without SendGrid
 * (env.schema.ts), so this can't silently swallow real user mail.
 */
export class ConsoleEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');

  constructor(private readonly isDevelopment: boolean) {
    super();
  }

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`(not sent — no email provider) to ${maskEmail(message.to)}: ${message.subject}`);
    if (this.isDevelopment) {
      const link = /href="([^"]+)"/.exec(message.html)?.[1];
      if (link) this.logger.log(`   [dev only] link: ${link}`);
    }
    return Promise.resolve();
  }
}

/** SendGrid v3 mail-send over plain fetch — no SDK dependency. */
export class SendGridEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: this.from },
        subject: message.subject,
        content: [{ type: 'text/html', value: message.html }],
      }),
    });
    if (!res.ok) {
      this.logger.error(`SendGrid rejected mail to ${maskEmail(message.to)} (HTTP ${res.status}): ${await providerReason(res)}`);
      throw new Error(`Email delivery failed (${res.status})`);
    }
  }
}

/** Resend over plain fetch — no SDK dependency. Same shape as SendGridEmailProvider. */
export class ResendEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Resend rejected mail to ${maskEmail(message.to)} (HTTP ${res.status}): ${await providerReason(res)}`);
      throw new Error(`Email delivery failed (${res.status})`);
    }
  }
}
