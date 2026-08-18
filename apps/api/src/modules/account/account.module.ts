import { Module } from '@nestjs/common';
import { EncryptionModule } from '../../common/services/encryption.module';
import { ConsoleEmailProvider, EmailProvider } from '../notifications/email.provider';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [EncryptionModule],
  controllers: [AccountController],
  providers: [
    AccountService,
    { provide: EmailProvider, useClass: ConsoleEmailProvider },
  ],
  exports: [AccountService],
})
export class AccountModule {}
