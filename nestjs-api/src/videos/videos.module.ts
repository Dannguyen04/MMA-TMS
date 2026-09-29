import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase/supabase.module.js';
import { VideoAccessService } from './video-access.service.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [VideosController],
  providers: [VideoAccessService, VideosService],
  exports: [VideoAccessService, VideosService],
})
export class VideosModule {}
