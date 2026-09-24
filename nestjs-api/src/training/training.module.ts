import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TrainingRepository } from './training.repo.js';
import { TrainingAccessService } from './training-access.service.js';
import { TrainingPlanController } from './plans/training-plan.controller.js';
import { TrainingPlanService } from './plans/training-plan.service.js';
import { TrainingSessionController } from './sessions/training-session.controller.js';
import { TrainingSessionService } from './sessions/training-session.service.js';
import { ExerciseController } from './exercises/exercise.controller.js';
import { ExerciseService } from './exercises/exercise.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [
    TrainingPlanController,
    TrainingSessionController,
    ExerciseController,
  ],
  providers: [
    TrainingRepository,
    TrainingAccessService,
    TrainingPlanService,
    TrainingSessionService,
    ExerciseService,
  ],
  exports: [TrainingPlanService, TrainingSessionService, ExerciseService],
})
export class TrainingModule {}
