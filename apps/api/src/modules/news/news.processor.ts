import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { JOBS, QUEUES, type PollFeedsJob } from '../../queue/queue.constants';

import { NewsService } from './news.service';

@Processor(QUEUES.FEEDS)
export class NewsProcessor extends WorkerHost {
  private readonly logger = new Logger(NewsProcessor.name);

  constructor(private readonly news: NewsService) {
    super();
  }

  async process(job: Job<PollFeedsJob>): Promise<void> {
    if (job.name !== JOBS.POLL_FEEDS) return;
    this.logger.log('Polling active feed sources…');
    await this.news.pollAllActiveSources();
    this.logger.log('Feed poll complete.');
  }
}
