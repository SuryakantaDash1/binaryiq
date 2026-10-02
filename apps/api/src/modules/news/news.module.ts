import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { JOBS, QUEUES } from '../../queue/queue.constants';

import { NewsController } from './news.controller';
import { NewsProcessor } from './news.processor';
import { NewsService } from './news.service';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly
const POLL_SCHEDULER_ID = 'feeds:poll-active-sources';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.FEEDS })],
  controllers: [NewsController],
  providers: [NewsService, NewsProcessor],
  exports: [NewsService],
})
export class NewsModule implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.FEEDS) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler is idempotent by schedulerId — re-registering on every
    // API restart replaces the existing scheduler instead of duplicating it.
    await this.queue.upsertJobScheduler(
      POLL_SCHEDULER_ID,
      { every: POLL_INTERVAL_MS },
      { name: JOBS.POLL_FEEDS, opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }
}
