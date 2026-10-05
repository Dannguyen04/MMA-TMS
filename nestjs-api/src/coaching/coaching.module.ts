import { Module } from '@nestjs/common';
import { CoachingController, CoachingWorkerController } from './coaching.controller.js';
import { WorkerAuthGuard } from '../jobs/guards/worker-auth.guard.js';
import { CoachingService } from './coaching.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { VideosModule } from '../videos/videos.module.js';
import { MovementReviewController } from './movement-review.controller.js';
import { MovementReviewService } from './movement-review.service.js';

@Module({
  imports: [DatabaseModule, VideosModule],
  controllers: [CoachingController, CoachingWorkerController, MovementReviewController],
  providers: [CoachingService, WorkerAuthGuard, MovementReviewService],
  exports: [CoachingService],
})
export class CoachingModule {}

