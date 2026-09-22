import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller.js';
import { VIDEO_ANALYSIS_QUEUE } from './jobs.model.js';
import { JobsService } from './jobs.service.js';
import { VideosModule } from '../videos/videos.module.js';

export { VIDEO_ANALYSIS_QUEUE };

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_ANALYSIS_QUEUE }),
    VideosModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [BullModule],
})
export class JobsModule {}
