import { Module } from '@nestjs/common';

import { PointsService } from './points.service';

/** Exports the ledger gateway for every feature module to inject. */
@Module({
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
