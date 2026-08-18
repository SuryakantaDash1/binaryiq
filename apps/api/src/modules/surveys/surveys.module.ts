import { Module } from '@nestjs/common';
import { EncryptionModule } from '../../common/services/encryption.module';
import { PointsModule } from '../points/points.module';
import { MatchingService } from './matching.service';
import { SurveyCompletionService } from './survey-completion.service';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';

@Module({
  imports: [PointsModule, EncryptionModule],
  controllers: [SurveysController],
  providers: [SurveysService, MatchingService, SurveyCompletionService],
})
export class SurveysModule {}
