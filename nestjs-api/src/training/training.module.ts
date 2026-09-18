import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TrainingRepository } from './training.repo.js';
import { TrainingService } from './training.service.js';
import {
  ExercisesController,
  PlansController,
  SessionsController,
} from './training.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PlansController, SessionsController, ExercisesController],
  providers: [TrainingRepository, TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
