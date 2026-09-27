import { HttpStatus } from '@nestjs/common';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MEDICAL_ELIGIBILITY_REASON } from './medical.constants.js';
import type {
  Clearance,
  DoctorAssignment,
  Examination,
  Injury,
} from './medical.model.js';
import { createRecoveryPlanSchema, updateRecoveryPlanSchema } from './medical.model.js';
import { MedicalRepository } from './medical.repo.js';
import { evaluateEligibility, MedicalService } from './medical.service.js';

const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const doctorUserId = '7ca0a87a-af9e-4dcf-809c-35cc02c57bed';
const doctorProfileId = 'doc-profile-001';
const otherDoctorProfileId = 'doc-profile-002';
const adminUserId = 'ad310000-0000-4000-8000-000000000001';
const requestId = 'req-unit-test-1';
const now = new Date('2026-09-27T10:00:00.000Z');

const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-sub',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-sub',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const dummyTx = { execute: vi.fn() } as unknown as Transaction;

function repositoryMock(): Mocked<MedicalRepository> {
  const transaction = { execute: vi.fn() };
  return {
    transaction: vi.fn(async (work) => work(transaction as unknown as Transaction)),
    lockFighter: vi.fn().mockResolvedValue({ id: fighterId }),
    lockFighterMedicalState: vi.fn().mockResolvedValue(undefined),
    lockInjury: vi.fn(),
    lockRecoveryPlan: vi.fn(),
    isAssignableDoctor: vi.fn().mockResolvedValue(true),
    findFighter: vi.fn().mockResolvedValue({ id: fighterId, userId: 'user-fighter-1' }),
    findActiveDoctorProfile: vi.fn().mockResolvedValue({ id: doctorProfileId, fullName: 'Dr. House' }),
    findActiveDoctorIdByUserId: vi.fn().mockResolvedValue(doctorProfileId),
    findOpenDoctorAssignment: vi.fn().mockResolvedValue(undefined),
    insertDoctorAssignment: vi.fn(),
    findDoctorAssignment: vi.fn(),
    closeDoctorAssignment: vi.fn(),
    listDoctorAssignments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    listFightersForDoctor: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    insertInjury: vi.fn(),
    findInjury: vi.fn(),
    updateInjury: vi.fn(),
    insertTreatment: vi.fn(),
    insertRecoveryPlan: vi.fn(),
    findRecoveryPlan: vi.fn(),
    updateRecoveryPlan: vi.fn(),
    findOpenReviewRequest: vi.fn().mockResolvedValue(undefined),
    insertReviewRequest: vi.fn(),
    listReviewRequests: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findReviewRequestsForResolution: vi.fn().mockResolvedValue([]),
    resolveReviewRequests: vi.fn().mockResolvedValue(0),
    findCurrentExamination: vi.fn().mockResolvedValue(undefined),
    findExamination: vi.fn(),
    insertExamination: vi.fn(),
    listExaminations: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findActiveClearancesForScope: vi.fn().mockResolvedValue([]),
    revokeClearancesForExamination: vi.fn().mockResolvedValue([]),
    insertClearance: vi.fn(),
    findClearance: vi.fn(),
    findClearanceWithExaminationNotes: vi.fn(),
    findActiveClearanceForType: vi.fn().mockResolvedValue(undefined),
    revokeClearance: vi.fn(),
    countOpenReviewRequests: vi.fn().mockResolvedValue(0),
    listClearancesForEligibility: vi.fn().mockResolvedValue([]),
    listClearancesForExamination: vi.fn().mockResolvedValue([]),
    findMedicalDossierData: vi.fn().mockResolvedValue({
      fighterId,
      currentStatus: 'HEALTHY',
      currentTrainingExamination: null,
      currentCompetitionExamination: null,
      activeClearances: [],
      activeInjuries: [],
      activeRecoveryPlans: [],
      pendingReviewRequests: [],
    }),
    listMedicalHistory: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  } as unknown as Mocked<MedicalRepository>;
}

function accessMock(): Mocked<MedicalAccessService> {
  return {
    requireFighter: vi.fn().mockResolvedValue({ id: fighterId, userId: 'user-fighter-1' }),
    canReadFighter: vi.fn().mockResolvedValue(true),
    assertReadScope: vi.fn().mockResolvedValue(undefined),
    authorizeClinicalRead: vi.fn().mockResolvedValue(undefined),
    requireAssignedDoctor: vi.fn().mockResolvedValue(doctorProfileId),
    assertReviewRequestScope: vi.fn().mockResolvedValue(undefined),
    assertDoctorFighterScope: vi.fn().mockResolvedValue(undefined),
  } as unknown as Mocked<MedicalAccessService>;
}

describe('MedicalService', () => {
  let service: MedicalService;
  let repo: Mocked<MedicalRepository>;
  let access: Mocked<MedicalAccessService>;

  beforeEach(() => {
    repo = repositoryMock();
    access = accessMock();
    service = new MedicalService(repo, access);

    repo.lockInjury.mockImplementation(async (id) => repo.findInjury(id));
    repo.lockRecoveryPlan.mockImplementation(async (id) => repo.findRecoveryPlan(id));
  });

  describe('recovery milestone refinements', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const content = { title: 'Walk comfortably', criteria: 'Doctor confirms progress' };
    const stored = {
      id, ...content, targetDate: '2026-10-01', notes: 'Keep this note',
      isCompleted: false, completedAt: null,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      repo.findRecoveryPlan.mockResolvedValue({
        id: 'plan-1', fighterId, status: 'COMPLETED', startDate: '2026-09-01',
        actualEndDate: '2026-09-20', milestones: [stored],
      } as Awaited<ReturnType<MedicalRepository['findRecoveryPlan']>>);
      repo.updateRecoveryPlan.mockImplementation(async (_id, patch) => ({
        ...(await repo.findRecoveryPlan('plan-1'))!, ...patch,
      }));
    });

    afterEach(() => vi.useRealTimers());

    it.each([
      { ...content, id }, { ...content, completedAt: now.toISOString() },
      { ...content, unexpected: true }, { ...content, isCompleted: 'true' },
      { ...content, targetDate: '2026-02-30' }, { ...content, title: '' },
    ])('rejects invalid or client-owned create milestone fields: %j', (milestone) => {
      expect(createRecoveryPlanSchema.safeParse({
        injuryId: id, title: 'Recovery', startDate: '2026-09-01', milestones: [milestone],
      }).success).toBe(false);
    });

    it('rejects duplicate update IDs and input lists over 50 items', () => {
      expect(updateRecoveryPlanSchema.safeParse({ milestones: [
        { ...content, id }, { ...content, id },
      ] }).success).toBe(false);
      expect(updateRecoveryPlanSchema.safeParse({ milestones: Array(51).fill(content) }).success).toBe(false);
    });

    it('creates unique server IDs and completion times without completing the plan', async () => {
      repo.findInjury.mockResolvedValue({ fighterId } as Injury);
      await service.createRecoveryPlan(doctorActor, fighterId, {
        injuryId: id, title: 'Recovery', startDate: '2026-09-01',
        milestones: [content, { ...content, isCompleted: true }],
      }, requestId);
      const milestones = repo.insertRecoveryPlan.mock.calls[0][3];
      expect(milestones[0]).toMatchObject({ isCompleted: false, completedAt: null });
      expect(milestones[1]).toMatchObject({ isCompleted: true, completedAt: now.toISOString() });
      expect(milestones[0].id).not.toBe(milestones[1].id);
      expect(milestones.every(m => /^[0-9a-f-]{36}$/.test(m.id))).toBe(true);
      expect(repo.updateRecoveryPlan).not.toHaveBeenCalled();
      expect(repo.insertClearance).not.toHaveBeenCalled();
    });

    it.each([
      [false, null, true, now.toISOString()],
      [true, '2026-09-10T00:00:00.000Z', true, '2026-09-10T00:00:00.000Z'],
      [true, '2026-09-10T00:00:00.000Z', false, null],
    ] as const)('preserves identity and handles completion %s -> %s', async (wasComplete, previousTime, isCompleted, expectedTime) => {
      const plan = (await repo.findRecoveryPlan('plan-1'))!;
      repo.findRecoveryPlan.mockResolvedValue({ ...plan, milestones: [
        { ...stored, isCompleted: wasComplete, completedAt: previousTime },
      ] });
      await service.updateRecoveryPlan(doctorActor, 'plan-1', {
        milestones: [content, { ...content, id, isCompleted }],
      }, requestId);
      const patch = repo.updateRecoveryPlan.mock.calls[0][1];
      expect(patch.milestones?.[1]).toEqual({
        ...stored, isCompleted, completedAt: expectedTime,
      });
      expect(patch).not.toHaveProperty('status');
      expect(patch).not.toHaveProperty('actualEndDate');
    });

    it('does not rewrite legacy values when milestones are omitted', async () => {
      const legacy = ['x', 1, true, null, [1], { label: 'a', done: true }, ...Array(60).fill(null)];
      const plan = (await repo.findRecoveryPlan('plan-1'))!;
      repo.findRecoveryPlan.mockResolvedValue({ ...plan, milestones: legacy });
      const result = await service.updateRecoveryPlan(doctorActor, 'plan-1', { description: 'Corrected' }, requestId);
      expect(repo.updateRecoveryPlan.mock.calls[0][1]).toEqual({ description: 'Corrected' });
      expect(result.milestones).toEqual(legacy);
    });

    it('rejects an unknown milestone ID before any write', async () => {
      await expect(service.updateRecoveryPlan(doctorActor, 'plan-1', {
        milestones: [{ ...content, id: '00000000-0000-4000-8000-000000000002' }],
      }, requestId)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MEDICAL_REFERENCE_NOT_FOUND' }),
      });
      expect(repo.updateRecoveryPlan).not.toHaveBeenCalled();
    });
  });

  describe('governing clearance refinements', () => {
    const older = {
      status: 'ACTIVE' as const, validFrom: new Date('2026-09-01'), validUntil: null,
      allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null,
    };
    const state = {
      scope: 'TRAINING' as const, now, openReviewRequests: 0,
      currentExamination: { decision: 'ELIGIBLE' as const },
    };

    it.each([
      { ...older, status: 'REVOKED' as const },
      { ...older, validFrom: new Date('2026-10-01') },
    ])('never falls back to older ACTIVE clearance: %j', (newest) => {
      expect(evaluateEligibility({ ...state, clearances: [newest, older] })).toEqual({
        scope: 'TRAINING', eligible: false, reasons: ['CLEARANCE_REQUIRED'],
      });
    });

    it('scope eligibility does not promise eligibility for every session type', () => {
      const clearances = [{ ...older, allowedSessionTypes: ['PHYSICAL_THERAPY' as const] }, older];
      expect(evaluateEligibility({ ...state, clearances }).eligible).toBe(true);
      expect(evaluateEligibility({ ...state, clearances, sessionType: 'SPARRING' }).reasons)
        .toEqual(['SESSION_TYPE_RESTRICTED']);
      expect(evaluateEligibility({ ...state, clearances, sessionType: 'PHYSICAL_THERAPY' }).eligible)
        .toBe(true);
    });
  });

  describe('Doctor Assignments', () => {
    it('assignDoctor: allows ADMIN to assign doctor', async () => {
      const assignment: DoctorAssignment = {
        id: 'assign-1',
        fighterId,
        doctorId: doctorProfileId,
        startsAt: now.toISOString(),
        endsAt: null,
        assignedById: adminUserId,
        endedById: null,
        endReason: null,
        createdAt: now.toISOString(),
      };
      repo.insertDoctorAssignment.mockResolvedValueOnce(assignment);

      const result = await service.assignDoctor(
        adminActor,
        fighterId,
        { doctorId: doctorProfileId },
        requestId,
      );

      expect(result).toEqual(assignment);
      expect(repo.insertDoctorAssignment).toHaveBeenCalled();
    });

    it('assignDoctor: rejects non-ADMIN role with 403 FORBIDDEN', async () => {
      await expect(
        service.assignDoctor(
          doctorActor,
          fighterId,
          { doctorId: doctorProfileId },
          requestId,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('assignDoctor: rejects when doctor profile not found with 404 DOCTOR_NOT_FOUND', async () => {
      repo.isAssignableDoctor.mockResolvedValueOnce(false);

      await expect(
        service.assignDoctor(
          adminActor,
          fighterId,
          { doctorId: 'non-existent' },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'DOCTOR_NOT_FOUND' },
      });
    });

    it('endDoctorAssignment: allows ADMIN to end any assignment', async () => {
      const assignment: DoctorAssignment = {
        id: 'assign-1',
        fighterId,
        doctorId: otherDoctorProfileId,
        startsAt: now.toISOString(),
        endsAt: null,
        assignedById: adminUserId,
        endedById: null,
        endReason: null,
        createdAt: now.toISOString(),
      };
      repo.findDoctorAssignment.mockResolvedValueOnce(assignment);
      const closed = { ...assignment, endsAt: now.toISOString(), endedById: adminUserId };
      repo.closeDoctorAssignment.mockResolvedValueOnce(closed);

      const result = await service.endDoctorAssignment(
        adminActor,
        fighterId,
        'assign-1',
        { endReason: 'Rotated doctor' },
        requestId,
      );

      expect(result).toEqual(closed);
    });

    it('endDoctorAssignment: allows DOCTOR to end own assignment', async () => {
      const assignment: DoctorAssignment = {
        id: 'assign-1',
        fighterId,
        doctorId: doctorProfileId,
        startsAt: now.toISOString(),
        endsAt: null,
        assignedById: adminUserId,
        endedById: null,
        endReason: null,
        createdAt: now.toISOString(),
      };
      repo.findDoctorAssignment.mockResolvedValueOnce(assignment);
      const closed = { ...assignment, endsAt: now.toISOString(), endedById: doctorActor.id };
      repo.closeDoctorAssignment.mockResolvedValueOnce(closed);

      const result = await service.endDoctorAssignment(
        doctorActor,
        fighterId,
        'assign-1',
        { endReason: 'Treatment complete' },
        requestId,
      );

      expect(result).toEqual(closed);
    });

    it('endDoctorAssignment: rejects DOCTOR ending another doctor assignment with 403', async () => {
      const assignment: DoctorAssignment = {
        id: 'assign-1',
        fighterId,
        doctorId: otherDoctorProfileId,
        startsAt: now.toISOString(),
        endsAt: null,
        assignedById: adminUserId,
        endedById: null,
        endReason: null,
        createdAt: now.toISOString(),
      };
      repo.findDoctorAssignment.mockResolvedValueOnce(assignment);

      await expect(
        service.endDoctorAssignment(
          doctorActor,
          fighterId,
          'assign-1',
          { endReason: 'Should fail' },
          requestId,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('endDoctorAssignment: rejects when already closed with 409 DOCTOR_ASSIGNMENT_ALREADY_CLOSED', async () => {
      const assignment: DoctorAssignment = {
        id: 'assign-1',
        fighterId,
        doctorId: doctorProfileId,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-20T00:00:00.000Z',
        assignedById: adminUserId,
        endedById: adminUserId,
        endReason: 'Past assignment',
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      repo.findDoctorAssignment.mockResolvedValueOnce(assignment);

      await expect(
        service.endDoctorAssignment(
          adminActor,
          fighterId,
          'assign-1',
          { endReason: 'Re-ending' },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DOCTOR_ASSIGNMENT_ALREADY_CLOSED' },
      });
    });
  });

  describe('Injuries & Treatments', () => {
    it('updateInjury: rejects transition away from RESOLVED with 409 INVALID_INJURY_STATUS_TRANSITION', async () => {
      const resolvedInjury: Injury = {
        id: 'inj-1',
        fighterId,
        injuryType: 'KNEE_SPRAIN',
        bodyLocation: 'Right Knee',
        severity: 'MODERATE',
        status: 'RESOLVED',
        occurredAt: '2026-09-01',
        diagnosedAt: '2026-09-02',
        expectedRecoveryDays: 30,
        actualRecoveryDays: 25,
        resolvedAt: '2026-09-26T00:00:00.000Z',
        reportedByDoctorId: doctorProfileId,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-26T00:00:00.000Z',
        description: 'Healed',
        treatmentPlan: null,
      };
      repo.findInjury.mockResolvedValue(resolvedInjury);

      await expect(
        service.updateInjury(
          doctorActor,
          'inj-1',
          { status: 'ACTIVE' },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'INVALID_INJURY_STATUS_TRANSITION' },
      });
    });

    it('updateInjury: allows content corrections on RESOLVED injury', async () => {
      const resolvedInjury: Injury = {
        id: 'inj-1',
        fighterId,
        injuryType: 'KNEE_SPRAIN',
        bodyLocation: 'Right Knee',
        severity: 'MODERATE',
        status: 'RESOLVED',
        occurredAt: '2026-09-01',
        diagnosedAt: '2026-09-02',
        expectedRecoveryDays: 30,
        actualRecoveryDays: 25,
        resolvedAt: '2026-09-26T00:00:00.000Z',
        reportedByDoctorId: doctorProfileId,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-26T00:00:00.000Z',
        description: 'Healed',
        treatmentPlan: null,
      };
      repo.findInjury.mockResolvedValue(resolvedInjury);
      const updated = { ...resolvedInjury, description: 'Corrected description' };
      repo.updateInjury.mockResolvedValueOnce(updated);

      const result = await service.updateInjury(
        doctorActor,
        'inj-1',
        { description: 'Corrected description' },
        requestId,
      );

      expect(result.description).toBe('Corrected description');
    });
  });

  describe('Examinations & Clearances', () => {
    it('createExamination: creates examination with NOT_ELIGIBLE decision', async () => {
      const exam: Examination = {
        id: 'exam-1',
        sequenceNo: 1,
        fighterId,
        doctorId: doctorProfileId,
        recordedById: doctorActor.id,
        scope: 'TRAINING',
        decision: 'NOT_ELIGIBLE',
        examinedAt: now.toISOString(),
        validUntil: null,
        reason: 'Severe concussion',
        restrictions: null,
        supersedesId: null,
        createdAt: now.toISOString(),
      };
      repo.insertExamination.mockResolvedValueOnce(exam);

      const result = await service.createExamination(
        doctorActor,
        fighterId,
        {
          scope: 'TRAINING',
          decision: 'NOT_ELIGIBLE',
          examinedAt: now.toISOString(),
          reason: 'Severe concussion',
        },
        requestId,
      );

      expect(result).toEqual(exam);
      expect(repo.insertExamination).toHaveBeenCalledWith(
        expect.objectContaining({
          fighterId,
          doctorId: doctorProfileId,
          scope: 'TRAINING',
          decision: 'NOT_ELIGIBLE',
          reason: 'Severe concussion',
        }),
        expect.anything(),
      );
    });

    it('createExamination: superseding non-current exam throws 409 EXAMINATION_CORRECTION_CONFLICT', async () => {
      repo.findExamination.mockResolvedValueOnce({
        id: 'exam-older',
        fighterId,
        scope: 'TRAINING',
      } as unknown as Examination);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-current',
        scope: 'TRAINING',
      } as unknown as Examination);

      await expect(
        service.createExamination(
          doctorActor,
          fighterId,
          {
            scope: 'TRAINING',
            decision: 'ELIGIBLE',
            examinedAt: now.toISOString(),
            supersedesId: 'exam-older',
          },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'EXAMINATION_CORRECTION_CONFLICT' },
      });
    });

    it('issueClearance: rejects issuing clearance from NOT_ELIGIBLE examination with 409', async () => {
      repo.findExamination.mockResolvedValueOnce({
        id: 'exam-1',
        fighterId,
        scope: 'TRAINING',
        decision: 'NOT_ELIGIBLE',
        examinedAt: now.toISOString(),
      } as unknown as Examination);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
      } as unknown as Examination);

      await expect(
        service.issueClearance(
          doctorActor,
          fighterId,
          {
            examinationId: 'exam-1',
            clearanceType: 'TRAINING',
            validFrom: now.toISOString(),
          },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE' },
      });
    });

    it('revokeClearance: allows assigned DOCTOR to revoke ACTIVE clearance', async () => {
      const clearance: Clearance = {
        id: 'clr-1',
        fighterId,
        examinationId: 'exam-1',
        clearanceType: 'TRAINING',
        status: 'ACTIVE',
        validFrom: '2026-09-01T00:00:00.000Z',
        validUntil: '2026-10-01T00:00:00.000Z',
        issuedByDoctorId: doctorProfileId,
        revokedByDoctorId: null,
        revocationReason: null,
        revokedAt: null,
        allowedSessionTypes: null,
        allowedTechniqueTypes: null,
        excludedJoints: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      repo.findClearance.mockResolvedValueOnce(clearance);
      const revoked = { ...clearance, status: 'REVOKED' as const, revocationReason: 'Injury flare-up' };
      repo.revokeClearance.mockResolvedValueOnce(revoked);
      repo.findClearanceWithExaminationNotes.mockResolvedValueOnce({
        clearance: revoked,
        examinationNotes: null,
      });

      const result = await service.revokeClearance(
        doctorActor,
        'clr-1',
        { revocationReason: 'Injury flare-up' },
        requestId,
      );

      expect(result.status).toBe('REVOKED');
    });

    it('revokeClearance: throws 409 MEDICAL_CLEARANCE_NOT_ACTIVE when clearance is already revoked', async () => {
      const clearance: Clearance = {
        id: 'clr-1',
        fighterId,
        examinationId: 'exam-1',
        clearanceType: 'TRAINING',
        status: 'REVOKED',
        validFrom: '2026-09-01T00:00:00.000Z',
        validUntil: '2026-10-01T00:00:00.000Z',
        issuedByDoctorId: doctorProfileId,
        revokedByDoctorId: doctorProfileId,
        revocationReason: 'Prior revocation',
        revokedAt: '2026-09-20T00:00:00.000Z',
        allowedSessionTypes: null,
        allowedTechniqueTypes: null,
        excludedJoints: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
      };
      repo.findClearance.mockResolvedValueOnce(clearance);

      await expect(
        service.revokeClearance(
          doctorActor,
          'clr-1',
          { revocationReason: 'Try again' },
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'MEDICAL_CLEARANCE_NOT_ACTIVE' },
      });
    });
  });

  describe('evaluateTrainingEligibility (D9 Gate)', () => {
    it('returns eligible for never-examined fighter with no open review request', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce(undefined);
      repo.listClearancesForEligibility.mockResolvedValueOnce([]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result).toEqual({ scope: 'TRAINING', eligible: true, reasons: [] });
    });

    it('blocks start when an open review request is pending', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(1);
      repo.findCurrentExamination.mockResolvedValueOnce(undefined);
      repo.listClearancesForEligibility.mockResolvedValueOnce([]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(MEDICAL_ELIGIBILITY_REASON.REVIEW_REQUEST_PENDING);
    });

    it('blocks start when examination decision is NOT_ELIGIBLE', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
        decision: 'NOT_ELIGIBLE',
      } as unknown as Examination);
      repo.listClearancesForEligibility.mockResolvedValueOnce([]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(MEDICAL_ELIGIBILITY_REASON.EXAMINATION_NOT_ELIGIBLE);
    });

    it('blocks start when current exam is ELIGIBLE but no clearance has ever been issued', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
        decision: 'ELIGIBLE',
      } as unknown as Examination);
      repo.listClearancesForExamination.mockResolvedValueOnce([]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(MEDICAL_ELIGIBILITY_REASON.CLEARANCE_REQUIRED);
    });

    it('blocks start when newest clearance was restricted and has now expired', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
        decision: 'ELIGIBLE',
      } as unknown as Examination);
      repo.listClearancesForExamination.mockResolvedValueOnce([
        {
          id: 'clr-restricted-expired',
          status: 'EXPIRED',
          validFrom: new Date('2026-08-01'),
          validUntil: new Date('2026-09-01'),
          allowedSessionTypes: ['PAD_WORK'],
          allowedTechniqueTypes: null,
          excludedJoints: null,
        },
      ]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(MEDICAL_ELIGIBILITY_REASON.CLEARANCE_EXPIRED);
    });

    it('blocks sessionType outside allowedSessionTypes when restricted', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
        decision: 'ELIGIBLE_WITH_RESTRICTIONS',
      } as unknown as Examination);
      repo.listClearancesForExamination.mockResolvedValueOnce([
        {
          id: 'clr-active-restricted',
          status: 'ACTIVE',
          validFrom: new Date('2026-09-01'),
          validUntil: new Date('2026-10-01'),
          allowedSessionTypes: ['PAD_WORK', 'CONDITIONING'],
          allowedTechniqueTypes: null,
          excludedJoints: null,
        },
      ]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain(MEDICAL_ELIGIBILITY_REASON.SESSION_TYPE_RESTRICTED);
    });

    it('allows sessionType inside allowedSessionTypes for restricted clearance', async () => {
      repo.countOpenReviewRequests.mockResolvedValueOnce(0);
      repo.findCurrentExamination.mockResolvedValueOnce({
        id: 'exam-1',
        decision: 'ELIGIBLE_WITH_RESTRICTIONS',
      } as unknown as Examination);
      repo.listClearancesForExamination.mockResolvedValueOnce([
        {
          id: 'clr-active-restricted',
          status: 'ACTIVE',
          validFrom: new Date('2026-09-01'),
          validUntil: new Date('2026-10-01'),
          allowedSessionTypes: ['PAD_WORK', 'SPARRING'],
          allowedTechniqueTypes: null,
          excludedJoints: null,
        },
      ]);

      const result = await service.evaluateTrainingEligibility(
        fighterId,
        'SPARRING',
        dummyTx,
      );

      expect(result).toEqual({ scope: 'TRAINING', eligible: true, reasons: [] });
    });
  });
});
