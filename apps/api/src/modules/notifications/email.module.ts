import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../../config/config.service';

import { ConsoleEmailProvider, EmailProvider, SendGridEmailProvider } from './email.provider';

/** Single, app-wide EmailProvider binding: SendGrid when configured, console otherwise. */
@Global()
@Module({
  providers: [
    {
      provide: EmailProvider,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): EmailProvider => {
        const apiKey = config.get('SENDGRID_API_KEY');
        const from = config.get('SENDGRID_FROM_EMAIL');
        if (apiKey && from) return new SendGridEmailProvider(apiKey, from);
        return new ConsoleEmailProvider(config.get('NODE_ENV') === 'development');
      },
    },
  ],
  exports: [EmailProvider],
})
export class EmailModule {}
