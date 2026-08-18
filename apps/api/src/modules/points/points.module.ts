import { Module } from '@nestjs/common';

import { PointsController } from './points.controller';
import { PointsService } from './points.service';

/** Exports the ledger gateway for every feature module to inject. */
@Module({
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
