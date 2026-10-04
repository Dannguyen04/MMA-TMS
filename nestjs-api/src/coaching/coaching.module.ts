import { Module } from '@nestjs/common';
import { CoachingController, CoachingWorkerController } from './coaching.controller.js';
import { WorkerAuthGuard } from '../jobs/guards/worker-auth.guard.js';
import { CoachingService } from './coaching.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CoachingController, CoachingWorkerController],
  providers: [CoachingService, WorkerAuthGuard],
  exports: [CoachingService],
})
export class CoachingModule {}

