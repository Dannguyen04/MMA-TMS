import { HttpException, HttpStatus } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type {
  CoachAssignment,
  FighterMeasurement,
  PublicFighter,
  TrainingSessionSummary,
} from './fighters.model.js';
import { FightersRepository } from './fighters.repo.js';
import { FightersService } from './fighters.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const otherUserId = '8473a317-317a-4b0a-8b01-eb4e961ff52f';
const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const measurementId = 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7';
const assignmentId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const coachId = '1317a43a-05af-4f2c-bc5b-781219643b68';
const requestId = 'request-id';

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-auth-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

const otherFighterActor: AuthenticatedUser = {
  ...fighterActor,
  id: otherUserId,
  authSubject: 'other-fighter-auth-subject',
  email: 'other-fighter@example.com',
};

const coachActor: AuthenticatedUser = {
  id: coachId,
  authSubject: 'coach-auth-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};

const doctorActor: AuthenticatedUser = {
  id: '7ca0a87a-af9e-4dcf-809c-35cc02c57bed',
  authSubject: 'doctor-auth-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const adminActor: AuthenticatedUser = {
  id: 'ad310000-0000-4000-8000-000000000001',
  authSubject: 'admin-auth-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const fighter: PublicFighter = {
  id: fighterId,
  userId: fighterUserId,
  firstName: 'An',
  lastName: 'Nguyen',
  dateOfBirth: '2000-01-01',
  nationality: 'VN',
  weightClass: 'LIGHTWEIGHT',
  heightCm: 175,
  reachCm: 180,
  dominantStance: 'ORTHODOX',
  leftArmCm: null,
  rightArmCm: null,
  leftLegCm: null,
  rightLegCm: null,
  gym: 'MMA Gym',
  currentMedicalStatus: 'HEALTHY',
  bio: null,
  profileImageUrl: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const measurement: FighterMeasurement = {
  id: measurementId,
  fighterId,
  recordedById: fighterUserId,
  measuredAt: new Date('2026-02-01T00:00:00.000Z'),
  measurementContext: 'SELF_REPORTED',
  weightKg: 70.35,
  heightCm: null,
  reachCm: null,
  notes: null,
  supersedesId: null,
  isSuperseded: false,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
};

const assignment: CoachAssignment = {
  id: assignmentId,
  coachId,
  fighterId,
  assignedById: coachId,
  startsAt: new Date('2026-02-01T00:00:00.000Z'),
  endsAt: null,
  endedById: null,
  endReason: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
};

const session: TrainingSessionSummary = {
  id: '0b5cbcd2-dd64-4d46-8024-b375f518a52d',
  fighterId,
  coachId,
  planId: null,
  title: 'Sparring session',
  scheduledAt: new Date('2026-02-02T00:00:00.000Z'),
  plannedDurationSec: 3600,
  actualDurationSec: 3300,
  roundCount: 5,
  location: 'Main gym',
  sessionType: 'SPARRING',
  status: 'COMPLETED',
  coachNotes: null,
  completedAt: new Date('2026-02-02T01:00:00.000Z'),
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
};

function repositoryMock() {
  const transaction = { scope: 'transaction' };
  const executeAuditContext = vi.fn().mockResolvedValue([]);
  Object.defineProperty(transaction, 'execute', {
    value: executeAuditContext,
  });
  return {
    transaction: vi.fn(
      async (work: (value: object) => Promise<unknown>): Promise<unknown> =>
        work(transaction),
    ),
    executeAuditContext,
    findByUserId: vi.fn().mockResolvedValue(fighter),
    findAll: vi.fn().mockResolvedValue({ data: [fighter], total: 11 }),
    findById: vi.fn().mockResolvedValue(fighter),
    update: vi.fn().mockResolvedValue({ ...fighter, bio: 'Updated bio' }),
    findMeasurements: vi
      .fn()
      .mockResolvedValue({ data: [measurement], total: 1 }),
    findMeasurementById: vi.fn().mockResolvedValue(measurement),
    insertMeasurement: vi.fn().mockResolvedValue(measurement),
    findCoachAssignments: vi.fn().mockResolvedValue([assignment]),
    findCoachById: vi.fn().mockResolvedValue({ id: coachId, isActive: true }),
    findActiveCoachAssignment: vi.fn().mockResolvedValue(undefined),
    insertCoachAssignment: vi.fn().mockResolvedValue(assignment),
    findCoachAssignmentById: vi.fn().mockResolvedValue({
      id: assignmentId,
      starts_at: assignment.startsAt,
      ends_at: null,
    }),
    closeCoachAssignment: vi.fn().mockResolvedValue({
      ...assignment,
      endsAt: new Date('2026-02-02T00:00:00.000Z'),
      endedById: coachId,
      endReason: 'Fighter moved to another camp',
    }),
    findTrainingSessions: vi
      .fn()
      .mockResolvedValue({ data: [session], total: 6 }),
    findMedicalSummary: vi.fn().mockResolvedValue({
      fighterId,
      currentMedicalStatus: 'HEALTHY',
      activeClearance: null,
      activeInjuries: [],
      jointStates: [],
    }),
    findActiveCoachIdByUserId: vi.fn().mockResolvedValue(coachId),
    isFighterAssignedToCoach: vi.fn().mockResolvedValue(true),
    findAllForCoach: vi.fn().mockResolvedValue({ data: [fighter], total: 1 }),
  };
}

function serviceWith(repository = repositoryMock()) {
  return {
    repository,
    service: new FightersService(repository as unknown as FightersRepository),
  };
}

async function caught(promise: Promise<unknown>): Promise<HttpException> {
  return promise.catch((error: unknown) => error) as Promise<HttpException>;
}

describe('FightersService', () => {
  it('prevents a fighter from reading another fighter profile', async () => {
    const { service } = serviceWith();
    const error = await caught(service.findById(otherFighterActor, fighterId));

    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns a filtered paginated list to a non-fighter actor', async () => {
    const { service, repository } = serviceWith();
    const query = {
      page: 1,
      limit: 10,
      weightClass: 'LIGHTWEIGHT' as const,
    };

    await expect(service.findAll(doctorActor, query)).resolves.toEqual({
      data: [fighter],
      total: 11,
      hasNextPage: true,
    });
    expect(repository.findAll).toHaveBeenCalledWith(query);
  });

  it('updates the owner profile atomically with audit context', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.updateProfile(
        fighterActor,
        fighterId,
        { bio: 'Updated bio' },
        requestId,
      ),
    ).resolves.toMatchObject({ bio: 'Updated bio' });
    expect(repository.executeAuditContext).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      fighterId,
      { bio: 'Updated bio' },
      { scope: 'transaction' },
    );
  });

  it('does not reapply a role gate after profile-update permission is granted', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.updateProfile(
        doctorActor,
        fighterId,
        { bio: 'Updated by an explicitly authorized user' },
        requestId,
      ),
    ).resolves.toMatchObject({ bio: 'Updated bio' });
    expect(repository.update).toHaveBeenCalledWith(
      fighterId,
      { bio: 'Updated by an explicitly authorized user' },
      { scope: 'transaction' },
    );
  });

  it('records a self-reported measurement with actor provenance', async () => {
    const { service, repository } = serviceWith();
    const input = {
      measurementContext: 'SELF_REPORTED' as const,
      weightKg: 70.35,
    };

    await expect(
      service.createMeasurement(fighterActor, fighterId, input, requestId),
    ).resolves.toEqual(measurement);
    expect(repository.insertMeasurement).toHaveBeenCalledWith(
      fighterId,
      fighterActor.id,
      input,
      undefined,
      { scope: 'transaction' },
    );
  });

  it('rejects a fighter measurement with a non-self-reported context', async () => {
    const { service, repository } = serviceWith();
    const error = await caught(
      service.createMeasurement(
        fighterActor,
        fighterId,
        { measurementContext: 'CHECKUP', weightKg: 70.35 },
        requestId,
      ),
    );

    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(error.getResponse()).toMatchObject({
      code: 'MEASUREMENT_CONTEXT_FORBIDDEN',
    });
    expect(repository.insertMeasurement).not.toHaveBeenCalled();
  });

  it('creates an append-only correction that references the original measurement', async () => {
    const { service, repository } = serviceWith();
    const corrected = { ...measurement, supersedesId: measurementId };
    repository.insertMeasurement.mockResolvedValueOnce(corrected);
    const input = {
      measurementContext: 'SELF_REPORTED' as const,
      weightKg: 70.5,
    };

    await expect(
      service.supersedeMeasurement(
        fighterActor,
        fighterId,
        measurementId,
        input,
        requestId,
      ),
    ).resolves.toEqual(corrected);
    expect(repository.insertMeasurement).toHaveBeenCalledWith(
      fighterId,
      fighterActor.id,
      input,
      measurementId,
      { scope: 'transaction' },
    );
  });

  it('rejects a second correction of an already superseded measurement', async () => {
    const repository = repositoryMock();
    repository.findMeasurementById.mockResolvedValueOnce({
      ...measurement,
      isSuperseded: true,
    });
    const { service } = serviceWith(repository);
    const error = await caught(
      service.supersedeMeasurement(
        fighterActor,
        fighterId,
        measurementId,
        { measurementContext: 'SELF_REPORTED', weightKg: 70.5 },
        requestId,
      ),
    );

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toMatchObject({
      code: 'MEASUREMENT_ALREADY_SUPERSEDED',
    });
    expect(repository.insertMeasurement).not.toHaveBeenCalled();
  });

  it('creates a temporal coach assignment with actor provenance', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.assignCoach(
        coachActor,
        fighterId,
        { coachId, startsAt: '2026-02-01T00:00:00.000Z' },
        requestId,
      ),
    ).resolves.toEqual(assignment);
    expect(repository.insertCoachAssignment).toHaveBeenCalledWith(
      coachId,
      fighterId,
      coachActor.id,
      new Date('2026-02-01T00:00:00.000Z'),
      { scope: 'transaction' },
    );
  });

  it('does not reapply a Coach/Admin role gate after assignment permission is granted', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.assignCoach(doctorActor, fighterId, { coachId }, requestId),
    ).resolves.toEqual(assignment);
    expect(repository.insertCoachAssignment).toHaveBeenCalledWith(
      coachId,
      fighterId,
      doctorActor.id,
      expect.any(Date),
      { scope: 'transaction' },
    );
  });

  it('rejects a duplicate active coach assignment', async () => {
    const repository = repositoryMock();
    repository.findActiveCoachAssignment.mockResolvedValueOnce({
      id: assignmentId,
    });
    const { service } = serviceWith(repository);
    const error = await caught(
      service.assignCoach(coachActor, fighterId, { coachId }, requestId),
    );

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toMatchObject({
      code: 'COACH_ASSIGNMENT_ALREADY_ACTIVE',
    });
    expect(repository.insertCoachAssignment).not.toHaveBeenCalled();
  });

  it('closes an active assignment and rejects an invalid period', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.endCoachAssignment(
        coachActor,
        fighterId,
        assignmentId,
        {
          endReason: 'Fighter moved to another camp',
          endsAt: '2026-02-02T00:00:00.000Z',
        },
        requestId,
      ),
    ).resolves.toMatchObject({
      endedById: coachActor.id,
      endReason: 'Fighter moved to another camp',
    });

    const error = await caught(
      service.endCoachAssignment(
        coachActor,
        fighterId,
        assignmentId,
        {
          endReason: 'Invalid period',
          endsAt: '2026-01-31T00:00:00.000Z',
        },
        requestId,
      ),
    );
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toMatchObject({
      code: 'INVALID_ASSIGNMENT_PERIOD',
    });
    expect(repository.closeCoachAssignment).toHaveBeenCalledTimes(1);
  });

  it('does not reapply a Coach/Admin role gate after end permission is granted', async () => {
    const { service, repository } = serviceWith();

    await expect(
      service.endCoachAssignment(
        doctorActor,
        fighterId,
        assignmentId,
        {
          endReason: 'Authorized reassignment',
          endsAt: '2026-02-02T00:00:00.000Z',
        },
        requestId,
      ),
    ).resolves.toMatchObject({ id: assignmentId });
    expect(repository.closeCoachAssignment).toHaveBeenCalledWith(
      assignmentId,
      doctorActor.id,
      'Authorized reassignment',
      new Date('2026-02-02T00:00:00.000Z'),
      { scope: 'transaction' },
    );
  });

  it('rejects closing an assignment that is already closed', async () => {
    const repository = repositoryMock();
    repository.findCoachAssignmentById.mockResolvedValueOnce({
      id: assignmentId,
      starts_at: assignment.startsAt,
      ends_at: new Date('2026-02-02T00:00:00.000Z'),
    });
    const { service } = serviceWith(repository);
    const error = await caught(
      service.endCoachAssignment(
        coachActor,
        fighterId,
        assignmentId,
        { endReason: 'Already closed' },
        requestId,
      ),
    );

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.getResponse()).toMatchObject({
      code: 'COACH_ASSIGNMENT_ALREADY_CLOSED',
    });
  });

  it('returns filtered training sessions with pagination metadata', async () => {
    const { service, repository } = serviceWith();
    const query = {
      page: 1,
      limit: 5,
      status: 'COMPLETED' as const,
      sessionType: 'SPARRING' as const,
    };

    await expect(
      service.findTrainingSessions(doctorActor, fighterId, query),
    ).resolves.toEqual({ data: [session], total: 6, hasNextPage: true });
    expect(repository.findTrainingSessions).toHaveBeenCalledWith(
      fighterId,
      query,
    );
  });

  it('enforces the medical read matrix and always adds the disclaimer', async () => {
    const { service } = serviceWith();
    const denied = await caught(
      service.getMedicalSummary(otherFighterActor, fighterId),
    );

    expect(denied.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(denied.getResponse()).toMatchObject({
      code: 'MEDICAL_ACCESS_DENIED',
    });

    await expect(
      service.getMedicalSummary(doctorActor, fighterId),
    ).resolves.toMatchObject({
      fighterId,
      disclaimer:
        'Measurements are estimated from 2D video using AI pose estimation. Results are NOT clinically validated. This system does not provide medical diagnosis. Consult a qualified healthcare professional for medical assessment.',
    });
  });

  describe('COACH assignment scoping', () => {
    // At unit level, unassigned, closed (ends_at <= now) and future
    // (starts_at > now) assignments all surface as isFighterAssignedToCoach
    // returning false; the temporal SQL itself is covered by DB tests.
    const deniedAssignments = [
      'unassigned',
      'closed assignment',
      'future assignment',
    ] as const;

    function coachDeniedRepository(
      reason: 'assignment' | 'profile' = 'assignment',
    ) {
      const repository = repositoryMock();
      if (reason === 'profile') {
        repository.findActiveCoachIdByUserId.mockResolvedValueOnce(undefined);
      } else {
        repository.isFighterAssignedToCoach.mockResolvedValueOnce(false);
      }
      return repository;
    }

    describe('findAll', () => {
      it('lists only assigned Fighters for COACH and passes filters through', async () => {
        const { service, repository } = serviceWith();
        const query = {
          page: 1,
          limit: 10,
          medicalStatus: 'HEALTHY' as const,
        };

        await expect(service.findAll(coachActor, query)).resolves.toEqual({
          data: [fighter],
          total: 1,
          hasNextPage: false,
        });
        expect(repository.findActiveCoachIdByUserId).toHaveBeenCalledWith(
          coachActor.id,
        );
        expect(repository.findAllForCoach).toHaveBeenCalledWith(coachId, query);
        expect(repository.findAll).not.toHaveBeenCalled();
      });

      it('rejects COACH with no active profile before listing', async () => {
        const repository = coachDeniedRepository('profile');
        const { service } = serviceWith(repository);

        const error = await caught(
          service.findAll(coachActor, { page: 1, limit: 10 }),
        );

        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
        expect(repository.findAllForCoach).not.toHaveBeenCalled();
      });

      it('keeps ADMIN on the unscoped list', async () => {
        const { service, repository } = serviceWith();
        const query = { page: 1, limit: 10 };

        await service.findAll(adminActor, query);

        expect(repository.findAll).toHaveBeenCalledWith(query);
        expect(repository.findActiveCoachIdByUserId).not.toHaveBeenCalled();
        expect(repository.findAllForCoach).not.toHaveBeenCalled();
      });
    });

    describe('findById', () => {
      it('returns the full profile to an assigned COACH', async () => {
        const { service, repository } = serviceWith();

        await expect(service.findById(coachActor, fighterId)).resolves.toEqual(
          fighter,
        );
        expect(repository.isFighterAssignedToCoach).toHaveBeenCalledWith(
          coachId,
          fighterId,
        );
      });

      it.each(deniedAssignments)('rejects COACH with %s', async () => {
        const { service } = serviceWith(coachDeniedRepository());

        const error = await caught(service.findById(coachActor, fighterId));

        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.getResponse()).toMatchObject({ code: 'FORBIDDEN' });
      });

      it('rejects COACH with no active profile without an assignment lookup', async () => {
        const repository = coachDeniedRepository('profile');
        const { service } = serviceWith(repository);

        const error = await caught(service.findById(coachActor, fighterId));

        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(repository.isFighterAssignedToCoach).not.toHaveBeenCalled();
      });

      it('returns 404 before any assignment lookup for an unknown Fighter', async () => {
        const repository = repositoryMock();
        repository.findById.mockResolvedValueOnce(undefined);
        const { service } = serviceWith(repository);

        const error = await caught(service.findById(coachActor, fighterId));

        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toMatchObject({ code: 'FIGHTER_NOT_FOUND' });
        expect(repository.findActiveCoachIdByUserId).not.toHaveBeenCalled();
      });

      it('does not apply the assignment check to ADMIN or DOCTOR', async () => {
        const { service, repository } = serviceWith();

        await expect(service.findById(adminActor, fighterId)).resolves.toEqual(
          fighter,
        );
        await expect(service.findById(doctorActor, fighterId)).resolves.toEqual(
          fighter,
        );
        expect(repository.findActiveCoachIdByUserId).not.toHaveBeenCalled();
      });
    });

    const scopedReads = [
      {
        name: 'findMeasurements',
        run: (service: FightersService, actor: AuthenticatedUser) =>
          service.findMeasurements(actor, fighterId, {
            page: 1,
            limit: 10,
            includeSuperseded: false,
          }),
        dataMethod: 'findMeasurements',
      },
      {
        name: 'findCoachAssignments',
        run: (service: FightersService, actor: AuthenticatedUser) =>
          service.findCoachAssignments(actor, fighterId),
        dataMethod: 'findCoachAssignments',
      },
      {
        name: 'findTrainingSessions',
        run: (service: FightersService, actor: AuthenticatedUser) =>
          service.findTrainingSessions(actor, fighterId, {
            page: 1,
            limit: 10,
          }),
        dataMethod: 'findTrainingSessions',
      },
    ] as const;

    describe.each(scopedReads)('$name', ({ run, dataMethod }) => {
      it('returns data to an assigned COACH', async () => {
        const { service, repository } = serviceWith();

        await run(service, coachActor);

        expect(repository.isFighterAssignedToCoach).toHaveBeenCalledWith(
          coachId,
          fighterId,
        );
        expect(repository[dataMethod]).toHaveBeenCalled();
      });

      it.each(deniedAssignments)(
        'rejects COACH with %s without reading data',
        async () => {
          const repository = coachDeniedRepository();
          const { service } = serviceWith(repository);

          const error = await caught(run(service, coachActor));

          expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
          expect(repository[dataMethod]).not.toHaveBeenCalled();
        },
      );

      it('rejects COACH with no active profile without reading data', async () => {
        const repository = coachDeniedRepository('profile');
        const { service } = serviceWith(repository);

        const error = await caught(run(service, coachActor));

        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(repository[dataMethod]).not.toHaveBeenCalled();
      });
    });
  });
});
