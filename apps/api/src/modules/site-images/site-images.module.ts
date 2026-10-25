import { Module } from '@nestjs/common';

import { SiteImagesController } from './site-images.controller';
import { SiteImagesService } from './site-images.service';

@Module({
  controllers: [SiteImagesController],
  providers: [SiteImagesService],
})
export class SiteImagesModule {}
