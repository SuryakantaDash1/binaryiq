import { Module } from '@nestjs/common';

import { EncryptionModule } from '../../common/services/encryption.module';
import { PointsModule } from '../points/points.module';

import { ProfileSurveysController } from './profile-surveys.controller';
import { ProfileSurveysService } from './profile-surveys.service';

@Module({
  imports: [PointsModule, EncryptionModule],
  controllers: [ProfileSurveysController],
  providers: [ProfileSurveysService],
  exports: [ProfileSurveysService],
})
export class ProfileSurveysModule {}
