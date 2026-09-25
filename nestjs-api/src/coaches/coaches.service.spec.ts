import { HttpException, HttpStatus } from '@nestjs/common';
import type { FightersRepository } from '../fighters/fighters.repo.js';
import type { PublicFighter } from '../fighters/fighters.model.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { CoachesService } from './coaches.service.js';
import type { CoachesRepository } from './coaches.repo.js';
import type { ListCoachFightersQuery } from './coaches.model.js';

const coachUserId = '1317a43a-05af-4f2c-bc5b-781219643b68';
const ownCoachProfileId = 'c0ac4000-0000-4000-8000-000000000001';
const otherCoachProfileId = 'c0ac4000-0000-4000-8000-000000000002';
const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';

const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-auth-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};

const adminActor: AuthenticatedUser = {
  id: 'ad310000-0000-4000-8000-000000000001',
  authSubject: 'admin-auth-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const fighterActor: AuthenticatedUser = {
  id: 'f1640000-0000-4000-8000-000000000001',
  authSubject: 'fighter-auth-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

const doctorActor: AuthenticatedUser = {
  id: 'd0c10000-0000-4000-8000-000000000001',
  authSubject: 'doctor-auth-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const guestActor: AuthenticatedUser = {
  id: '90e51000-0000-4000-8000-000000000001',
  authSubject: 'guest-auth-subject',
  email: 'guest@example.com',
  role: 'GUEST' as AuthenticatedUser['role'],
};

const sampleFighter: PublicFighter = {
  id: fighterId,
  userId: 'u5e40000-0000-4000-8000-000000000001',
  firstName: 'An',
  lastName: 'Nguyen',
  dateOfBirth: '2000-01-01',
  nationality: 'VN',
  weightClass: 'LIGHTWEIGHT',
  heightCm: 175,
  reachCm: 180,
  dominantStance: 'ORTHODOX',
  leftArmCm: 70,
  rightArmCm: 70,
  leftLegCm: 90,
  rightLegCm: 90,
  gym: 'MMA Gym',
  currentMedicalStatus: 'HEALTHY',
  bio: 'Top athlete',
  profileImageUrl: 'https://example.com/avatar.jpg',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function caught(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
}

function createMocks() {
  const coachesRepo = {
    isActiveCoach: vi.fn().mockResolvedValue(true),
  };

  const fightersRepo = {
    findActiveCoachIdByUserId: vi.fn().mockResolvedValue(ownCoachProfileId),
    findAllForCoach: vi.fn().mockResolvedValue({
      data: [sampleFighter],
      total: 1,
    }),
  };

  const service = new CoachesService(
    coachesRepo as unknown as CoachesRepository,
    fightersRepo as unknown as FightersRepository,
  );

  return { service, coachesRepo, fightersRepo };
}

describe('CoachesService.findAssignedFighters', () => {
  const defaultQuery: ListCoachFightersQuery = {
    page: 1,
    limit: 20,
  };

  describe('COACH role', () => {
    it('returns assigned fighters when own coach id matches :id', async () => {
      const { service, fightersRepo } = createMocks();
      fightersRepo.findAllForCoach.mockResolvedValueOnce({
        data: [sampleFighter],
        total: 11,
      });

      const query: ListCoachFightersQuery = { page: 1, limit: 5 };
      const result = await service.findAssignedFighters(
        coachActor,
        ownCoachProfileId,
        query,
      );

      expect(fightersRepo.findActiveCoachIdByUserId).toHaveBeenCalledWith(
        coachActor.id,
      );
      expect(fightersRepo.findAllForCoach).toHaveBeenCalledWith(
        ownCoachProfileId,
        query,
      );
      expect(result.total).toBe(11);
      expect(result.hasNextPage).toBe(true);
      expect(result.data).toEqual([sampleFighter]);
    });

    it('calculates hasNextPage correctly at pagination boundary', async () => {
      const { service, fightersRepo } = createMocks();

      // Exactly at boundary: page 2 * limit 5 = 10 == total 10 -> hasNextPage = false
      fightersRepo.findAllForCoach.mockResolvedValueOnce({
        data: [sampleFighter],
        total: 10,
      });
      const atBoundary = await service.findAssignedFighters(
        coachActor,
        ownCoachProfileId,
        { page: 2, limit: 5 },
      );
      expect(atBoundary.hasNextPage).toBe(false);

      // Beyond boundary: page 3 * limit 5 = 15 > total 10 -> hasNextPage = false
      fightersRepo.findAllForCoach.mockResolvedValueOnce({
        data: [],
        total: 10,
      });
      const beyondBoundary = await service.findAssignedFighters(
        coachActor,
        ownCoachProfileId,
        { page: 3, limit: 5 },
      );
      expect(beyondBoundary.hasNextPage).toBe(false);
    });

    it('returns empty data when coach has zero assignments', async () => {
      const { service, fightersRepo } = createMocks();
      fightersRepo.findAllForCoach.mockResolvedValueOnce({
        data: [],
        total: 0,
      });

      const result = await service.findAssignedFighters(
        coachActor,
        ownCoachProfileId,
        defaultQuery,
      );

      expect(result).toEqual({
        data: [],
        total: 0,
        hasNextPage: false,
      });
    });

    it('throws 403 FORBIDDEN when coach has no active profile', async () => {
      const { service, fightersRepo } = createMocks();
      fightersRepo.findActiveCoachIdByUserId.mockResolvedValueOnce(undefined);

      const error = await caught(
        service.findAssignedFighters(
          coachActor,
          ownCoachProfileId,
          defaultQuery,
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
      expect(fightersRepo.findAllForCoach).not.toHaveBeenCalled();
    });

    it('throws 403 FORBIDDEN when coach requests another coach profile, without probing existence', async () => {
      const { service, coachesRepo, fightersRepo } = createMocks();

      const error = await caught(
        service.findAssignedFighters(
          coachActor,
          otherCoachProfileId,
          defaultQuery,
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
      // Prevent existence leak: isActiveCoach and findAllForCoach must never be called
      expect(coachesRepo.isActiveCoach).not.toHaveBeenCalled();
      expect(fightersRepo.findAllForCoach).not.toHaveBeenCalled();
    });
  });

  describe('ADMIN role', () => {
    it('allows Admin to list fighters of an active Coach', async () => {
      const { service, coachesRepo, fightersRepo } = createMocks();
      coachesRepo.isActiveCoach.mockResolvedValueOnce(true);
      fightersRepo.findAllForCoach.mockResolvedValueOnce({
        data: [sampleFighter],
        total: 1,
      });

      const result = await service.findAssignedFighters(
        adminActor,
        otherCoachProfileId,
        defaultQuery,
      );

      expect(coachesRepo.isActiveCoach).toHaveBeenCalledWith(otherCoachProfileId);
      expect(fightersRepo.findAllForCoach).toHaveBeenCalledWith(
        otherCoachProfileId,
        defaultQuery,
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('throws 404 COACH_NOT_FOUND when requested coach is inactive or unknown', async () => {
      const { service, coachesRepo, fightersRepo } = createMocks();
      coachesRepo.isActiveCoach.mockResolvedValueOnce(false);

      const error = await caught(
        service.findAssignedFighters(
          adminActor,
          otherCoachProfileId,
          defaultQuery,
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.getResponse()).toMatchObject({ code: 'COACH_NOT_FOUND' });
      expect(fightersRepo.findAllForCoach).not.toHaveBeenCalled();
    });
  });

  describe('Other roles', () => {
    it.each([
      ['FIGHTER', fighterActor],
      ['DOCTOR', doctorActor],
      ['GUEST', guestActor],
    ])('throws 403 FORBIDDEN for %s actor without data call', async (_name, actor) => {
      const { service, coachesRepo, fightersRepo } = createMocks();

      const error = await caught(
        service.findAssignedFighters(
          actor,
          ownCoachProfileId,
          defaultQuery,
        ),
      );

      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
      expect(coachesRepo.isActiveCoach).not.toHaveBeenCalled();
      expect(fightersRepo.findAllForCoach).not.toHaveBeenCalled();
    });
  });
});
