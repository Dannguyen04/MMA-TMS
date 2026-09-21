import { Injectable } from '@nestjs/common';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import {
  exerciseNotFound,
  mapTrainingPersistenceError,
} from '../training.error.js';
import type {
  CreateExerciseInput,
  UpdateExerciseInput,
  ListExercisesQuery,
} from '../training.model.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';

@Injectable()
export class ExerciseService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly access: TrainingAccessService,
  ) {}

  async listExercises(query: ListExercisesQuery) {
    try {
      const result = await this.repo.findExercises(query);
      return {
        ...result,
        hasNextPage: query.page * query.limit < result.total,
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async getExerciseById(id: string) {
    try {
      const exercise = await this.repo.findExerciseById(id);
      if (!exercise) throw exerciseNotFound();
      return exercise;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createExercise(actor: AuthenticatedUser, data: CreateExerciseInput) {
    this.access.assertTrainingWriteAllowed(actor);
    try {
      return await this.repo.createExercise(data);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updateExercise(
    actor: AuthenticatedUser,
    id: string,
    data: UpdateExerciseInput,
  ) {
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const updated = await this.repo.updateExercise(id, data);
      if (!updated) throw exerciseNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }
}
