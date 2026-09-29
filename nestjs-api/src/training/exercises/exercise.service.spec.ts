import {
  ForbiddenException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import type { ExerciseEntity } from '../training.model.js';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import { ExerciseService } from './exercise.service.js';

const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const exerciseId = 'fc9d9ca7-b105-4650-aa80-e96872159309';
const now = '2026-09-17T10:00:00.000Z';

const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};
const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const exercise: ExerciseEntity = {
  id: exerciseId,
  name: 'Jab',
  description: null,
  category: 'STRIKING',
  targetMuscleGroups: [],
  videoUrl: null,
  thumbnailUrl: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

function repositoryMock() {
  return {
    findExercises: vi.fn(),
    findExerciseById: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
  };
}

describe('ExerciseService', () => {
  let service: ExerciseService;
  let repo: Mocked<TrainingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseService,
        TrainingAccessService,
        { provide: TrainingRepository, useValue: repositoryMock() },
      ],
    }).compile();

    service = module.get(ExerciseService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
  });

  describe('listExercises', () => {
    it('returns exercises and computes hasNextPage correctly', async () => {
      repo.findExercises.mockResolvedValue({ data: [exercise], total: 15 });

      const res = await service.listExercises({ page: 1, limit: 10 });
      expect(res).toEqual({
        data: [exercise],
        total: 15,
        hasNextPage: true,
      });
      expect(repo.findExercises).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('computes hasNextPage false when on the last page', async () => {
      repo.findExercises.mockResolvedValue({ data: [exercise], total: 10 });

      const res = await service.listExercises({ page: 1, limit: 10 });
      expect(res.hasNextPage).toBe(false);
    });
  });

  describe('getExerciseById', () => {
    it('returns exercise when found', async () => {
      repo.findExerciseById.mockResolvedValue(exercise);

      await expect(service.getExerciseById(exerciseId)).resolves.toEqual(exercise);
    });

    it('throws 404 when exercise does not exist', async () => {
      repo.findExerciseById.mockResolvedValue(undefined);

      await expect(service.getExerciseById(exerciseId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('createExercise', () => {
    it('allows ADMIN to create an exercise', async () => {
      repo.createExercise.mockResolvedValue(exercise);

      await expect(
        service.createExercise(adminActor, {
          name: 'Jab',
          category: 'STRIKING',
          targetMuscleGroups: [],
        }),
      ).resolves.toEqual(exercise);
      expect(repo.createExercise).toHaveBeenCalledWith({
        name: 'Jab',
        category: 'STRIKING',
        targetMuscleGroups: [],
      });
    });

    it('rejects POST /exercises (createExercise) for DOCTOR before repo call', async () => {
      await expect(
        service.createExercise(doctorActor, {
          name: 'Exercise',
          category: 'STRIKING',
          targetMuscleGroups: [],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createExercise).not.toHaveBeenCalled();
    });
  });

  describe('updateExercise', () => {
    it('allows ADMIN to update an exercise', async () => {
      const updated = { ...exercise, name: 'Cross' };
      repo.updateExercise.mockResolvedValue(updated);

      await expect(
        service.updateExercise(adminActor, exerciseId, { name: 'Cross' }),
      ).resolves.toEqual(updated);
      expect(repo.updateExercise).toHaveBeenCalledWith(exerciseId, {
        name: 'Cross',
      });
    });

    it('throws 404 when exercise to update does not exist', async () => {
      repo.updateExercise.mockResolvedValue(undefined);

      await expect(
        service.updateExercise(adminActor, exerciseId, { name: 'Cross' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('rejects PATCH /exercises/:id (updateExercise) for DOCTOR before repo call', async () => {
      await expect(
        service.updateExercise(doctorActor, 'non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.updateExercise).not.toHaveBeenCalled();
    });
  });

  describe('DOCTOR read access', () => {
    it('allows DOCTOR to read exercises list and by id', async () => {
      repo.findExercises.mockResolvedValue({ data: [exercise], total: 1 });
      repo.findExerciseById.mockResolvedValue(exercise);

      await expect(service.listExercises({ page: 1, limit: 10 })).resolves.toMatchObject({
        data: [exercise],
      });
      await expect(service.getExerciseById(exerciseId)).resolves.toEqual(exercise);
    });
  });
});
