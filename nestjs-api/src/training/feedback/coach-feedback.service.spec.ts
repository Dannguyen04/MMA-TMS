import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import type { CreateFeedbackInput } from '../training.model.js';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import { CoachFeedbackService } from './coach-feedback.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const otherFighterId = 'a481035b-961c-4411-995d-2bd576fbb749';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const sessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f57';
const feedbackId = 'ba425c7d-f166-4800-a542-d2f5d1a96adc';
const now = '2026-09-17T10:00:00.000Z';

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};
const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};
const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const praise: CreateFeedbackInput = {
  fighterId,
  sessionId: null,
  videoId: null,
  kind: 'PRAISE',
  body: 'Good balance after the cross.',
  techniques: ['cross'],
};

function repositoryMock() {
  return {
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isDoctorAssignedToFighter: vi.fn(),
    isCoachProfileOwnedByUser: vi.fn(),
    findSessionById: vi.fn(),
    findFeedback: vi.fn(),
    createFeedback: vi.fn(),
    findVideoContext: vi.fn(),
  };
}

describe('CoachFeedbackService', () => {
  let service: CoachFeedbackService;
  let repo: Mocked<TrainingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachFeedbackService,
        TrainingAccessService,
        { provide: TrainingRepository, useValue: repositoryMock() },
      ],
    }).compile();

    service = module.get(CoachFeedbackService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
  });

  it('scopes fighter feedback queries to the authenticated fighter profile', async () => {
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
    repo.findFeedback.mockResolvedValue({ data: [], total: 0 });

    await expect(
      service.listFeedback(fighterActor, { page: 1, limit: 20 }),
    ).resolves.toEqual({ data: [], total: 0, hasNextPage: false });
    expect(repo.findFeedback).toHaveBeenCalledWith(
      { page: 1, limit: 20, fighterId },
      {},
    );
  });

  it('defaults an unscoped coach query to the coach own feedback', async () => {
    repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repo.findFeedback.mockResolvedValue({ data: [], total: 0 });

    await service.listFeedback(coachActor, { page: 1, limit: 20 });
    expect(repo.findFeedback).toHaveBeenCalledWith(
      { page: 1, limit: 20, coachId },
      { activeCoachId: coachId },
    );
  });

  it('requires doctors to scope feedback to a fighter', async () => {
    await expect(
      service.listFeedback(doctorActor, { page: 1, limit: 20 }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.findFeedback).not.toHaveBeenCalled();
  });

  it('derives the coach profile when creating assigned-fighter feedback', async () => {
    repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repo.isCoachAssignedToFighter.mockResolvedValue(true);
    repo.createFeedback.mockResolvedValue({
      id: feedbackId,
      coachId,
      createdAt: now,
      ...praise,
    });

    await expect(
      service.createFeedback(coachActor, praise),
    ).resolves.toMatchObject({ id: feedbackId, coachId });
    expect(repo.createFeedback).toHaveBeenCalledWith({ ...praise, coachId });
  });

  it('denies coach feedback creation outside an active assignment', async () => {
    repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repo.isCoachAssignedToFighter.mockResolvedValue(false);

    await expect(
      service.createFeedback(coachActor, {
        ...praise,
        fighterId: otherFighterId,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.createFeedback).not.toHaveBeenCalled();
  });

  it('rejects feedback that references another fighter session', async () => {
    repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repo.isCoachAssignedToFighter.mockResolvedValue(true);
    repo.findSessionById.mockResolvedValue({
      fighterId: otherFighterId,
    } as Awaited<ReturnType<TrainingRepository['findSessionById']>>);

    await expect(
      service.createFeedback(coachActor, { ...praise, sessionId }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.createFeedback).not.toHaveBeenCalled();
  });

  it('never lets a non-coach create feedback', async () => {
    await expect(service.createFeedback(doctorActor, praise)).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.findActiveCoachIdByUserId).not.toHaveBeenCalled();
  });
});
