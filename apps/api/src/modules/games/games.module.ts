import { Module } from '@nestjs/common';

import { PointsModule } from '../points/points.module';

import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { RngProvider } from './rng.provider';

@Module({
  imports: [PointsModule],
  controllers: [GamesController],
  providers: [GamesService, RngProvider],
  exports: [GamesService],
})
export class GamesModule {}
