import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { JOBS, QUEUES } from '../../queue/queue.constants';

import { AdminDataRightsController } from './admin-data-rights.controller';
import { ConsentService } from './consent.service';
import { DataRightsController } from './data-rights.controller';
import { ErasureProcessor } from './erasure.processor';
import { ErasureService } from './erasure.service';
import { ExportService } from './export.service';

const SWEEP_SCHEDULER_ID = 'erasure:daily-sweep';
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.ERASURE })],
  controllers: [DataRightsController, AdminDataRightsController],
  providers: [ConsentService, ExportService, ErasureService, ErasureProcessor],
  exports: [ConsentService],
})
export class DataRightsModule implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.ERASURE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Idempotent by scheduler id — restarts replace rather than duplicate it.
    await this.queue.upsertJobScheduler(
      SWEEP_SCHEDULER_ID,
      { every: SWEEP_INTERVAL_MS },
      { name: JOBS.ERASURE_SWEEP, opts: { removeOnComplete: true, removeOnFail: 50 } },
    );
  }
}
