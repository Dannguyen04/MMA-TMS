import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { VideosModule } from '../videos/videos.module.js';
import { SupabaseModule } from '../common/supabase/supabase.module.js';

export const VIDEO_ANALYSIS_QUEUE = 'video-analysis';

@Module({
  imports: [
    BullModule.registerQueue({ name: VIDEO_ANALYSIS_QUEUE }),
    VideosModule,
    SupabaseModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
