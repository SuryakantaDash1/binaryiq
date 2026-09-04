import { Module } from '@nestjs/common';

import { AdminAuthController } from './admin-auth.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService],
})
export class AdminModule {}
