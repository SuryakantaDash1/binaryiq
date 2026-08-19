import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/services/encryption.module';
import { QUEUES } from '../../queue/queue.constants';

import { AdminDataRightsController } from './admin-data-rights.controller';
import { ConsentService } from './consent.service';
import { DataRightsController } from './data-rights.controller';
import { ErasureProcessor } from './erasure.processor';
import { ErasureService } from './erasure.service';
import { ExportService } from './export.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.ERASURE }),
    EncryptionModule,
  ],
  controllers: [DataRightsController, AdminDataRightsController],
  providers: [ConsentService, ExportService, ErasureService, ErasureProcessor],
  exports: [ConsentService],
})
export class DataRightsModule {}
