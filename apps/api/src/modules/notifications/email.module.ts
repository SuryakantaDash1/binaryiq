import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';

import { ConsoleEmailProvider, EmailProvider, ResendEmailProvider, SendGridEmailProvider } from './email.provider';

/**
 * Single, app-wide EmailProvider binding: Resend when configured, else SendGrid
 * when configured, else console. Two providers are supported (not just one)
 * because provider sign-up/vetting can fail or get blocked unpredictably —
 * swapping is then just an env var change, no code changes needed.
 */
@Global()
@Module({
  providers: [
    {
      provide: EmailProvider,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): EmailProvider => {
        const resendKey = config.get('RESEND_API_KEY');
        const resendFrom = config.get('RESEND_FROM_EMAIL');
        if (resendKey && resendFrom) return new ResendEmailProvider(resendKey, resendFrom);

        const sendgridKey = config.get('SENDGRID_API_KEY');
        const sendgridFrom = config.get('SENDGRID_FROM_EMAIL');
        if (sendgridKey && sendgridFrom) return new SendGridEmailProvider(sendgridKey, sendgridFrom);

        return new ConsoleEmailProvider(config.get('NODE_ENV') === 'development');
      },
    },
  ],
  exports: [EmailProvider],
})
export class EmailModule {}
