import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

export const VIDEO_ANALYSIS_QUEUE = 'video-analysis';

@Module({
  imports: [BullModule.registerQueue({ name: VIDEO_ANALYSIS_QUEUE })],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
