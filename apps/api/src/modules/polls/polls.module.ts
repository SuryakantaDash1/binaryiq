import { Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module';

import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';

@Module({
  imports: [PointsModule],
  controllers: [PollsController],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
