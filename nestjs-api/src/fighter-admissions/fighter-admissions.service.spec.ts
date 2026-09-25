import { HttpException } from '@nestjs/common';
import type { RecoveryEmailService } from '../shared/contracts/recovery-email.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { UsersService } from '../users/users.service.js';
import {
  ACTIVATION_STATUS,
  ADMIN_DECISION,
  APPLICATION_STATUS,
  ASSESSMENT_CONCLUSION,
} from './fighter-admissions.constants.js';
import { FighterAdmissionsRepository } from './fighter-admissions.repo.js';
import { FighterAdmissionsService } from './fighter-admissions.service.js';

describe('FighterAdmissionsService', () => {
  const guestActor: AuthenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    authSubject: 'sub-guest-111',
    email: 'guest@example.com',
    role: USER.GUEST,
  };

  const fighterActor: AuthenticatedUser = {
    id: '22222222-2222-4222-8222-222222222222',
    authSubject: 'sub-fighter-222',
    email: 'fighter@example.com',
    role: USER.FIGHTER,
  };

  const adminActor: AuthenticatedUser = {
    id: '33333333-3333-4333-8333-333333333333',
    authSubject: 'sub-admin-333',
    email: 'admin@example.com',
    role: USER.ADMIN,
  };

  const coachActor: AuthenticatedUser = {
    id: '44444444-4444-4444-8444-444444444444',
    authSubject: 'sub-coach-444',
    email: 'coach@example.com',
    role: USER.COACH,
  };

  const sampleApplicationRow = {
    id: 'app-uuid-1',
    guestUserId: guestActor.id,
    email: 'snapshot@example.com',
    firstName: 'An',
    lastName: 'Nguyen',
    dateOfBirth: '2000-01-01',
    weightClass: 'LIGHTWEIGHT',
    nationality: 'VN',
    contactPhone: '+84123456789',
    trainingBackground: '3 yrs boxing',
    competitionBackground: '2 bouts',
    motivation: 'Go pro',
    status: APPLICATION_STATUS.SUBMITTED,
    submittedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  function mockDependencies() {
    const tx = { scope: 'tx' };
    const execute = vi.fn().mockResolvedValue([]);
    Object.defineProperty(tx, 'execute', { value: execute });
    const repository = {
      transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
      hasOpenApplication: vi.fn().mockResolvedValue(false),
      insertApplication: vi.fn().mockResolvedValue(sampleApplicationRow),
      findApplicationById: vi.fn().mockResolvedValue(sampleApplicationRow),
      lockApplication: vi.fn().mockResolvedValue(sampleApplicationRow),
      lockActivationByGuestUserId: vi.fn().mockResolvedValue(null),
      lockActivationByAuthSubject: vi.fn().mockResolvedValue(null),
      lockActivationByApplication: vi.fn().mockResolvedValue(null),
      advanceApplicationStatus: vi.fn().mockResolvedValue(true),
      advanceActivationStatus: vi.fn().mockResolvedValue(true),
      releaseStaleClaim: vi.fn().mockResolvedValue(true),
      claimRecoverySend: vi.fn().mockResolvedValue(null),
      markRecoveryAccepted: vi.fn().mockResolvedValue({ recoveryAttempts: 1, attemptedAt: new Date() }),
      findAssessmentByApplication: vi.fn().mockResolvedValue(null),
      findDecisionByApplication: vi.fn().mockResolvedValue(null),
      findActivationByApplication: vi.fn().mockResolvedValue(null),
      findActiveCoachById: vi.fn().mockResolvedValue(null),
      findActiveCoachByUserId: vi.fn().mockResolvedValue(null),
      findOpenAssignment: vi.fn().mockResolvedValue(null),
      insertAssignment: vi.fn().mockResolvedValue({ id: 'asgn-1' }),
      closeOpenAssignment: vi.fn().mockResolvedValue(true),
      insertAssessment: vi.fn().mockResolvedValue({ id: 'asm-1' }),
      insertDecision: vi.fn().mockResolvedValue({ id: 'dec-1' }),
      insertActivation: vi.fn().mockResolvedValue({ id: 'act-1' }),
      listApplicationsByGuest: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      listApplications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      listApplicationsForCoach: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      listAssignments: vi.fn().mockResolvedValue([]),
      findAccountEmail: vi.fn().mockResolvedValue('current_email@example.com'),
    };

    const usersService = {
      promoteGuestToFighter: vi.fn().mockResolvedValue(undefined),
    };

    const recoveryEmail: RecoveryEmailService = {
      sendPasswordRecoveryEmail: vi.fn().mockResolvedValue({ accepted: true }),
    };

    const service = new FighterAdmissionsService(
      repository as unknown as FighterAdmissionsRepository,
      usersService as unknown as UsersService,
      recoveryEmail,
    );

    return { service, repository, usersService, recoveryEmail };
  }

  // ── 1. Hai đường tạo FIGHTER & GUEST boundary (§1, §2) ───────────────────
  describe('Application submission & identity bounds (§1, §2)', () => {
    it('records applicant email as snapshot of verified session, ignoring body override', async () => {
      const { service, repository } = mockDependencies();
      const input = {
        firstName: 'An',
        lastName: 'Nguyen',
        dateOfBirth: '2000-01-01',
        weightClass: 'LIGHTWEIGHT' as const,
      };

      const result = await service.submitApplication(guestActor, input, 'req-1');

      expect(repository.hasOpenApplication).toHaveBeenCalledWith(guestActor.id, expect.anything());
      expect(repository.insertApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          guestUserId: guestActor.id,
          email: guestActor.email, // Snapshotted from actor, not body
        }),
        expect.anything(),
      );
      expect(result.id).toBe(sampleApplicationRow.id);
    });

    it('rejects submission if the guest already has an open application', async () => {
      const { service, repository } = mockDependencies();
      repository.hasOpenApplication.mockResolvedValueOnce(true);

      const error = await service
        .submitApplication(
          guestActor,
          {
            firstName: 'An',
            lastName: 'Nguyen',
            dateOfBirth: '2000-01-01',
            weightClass: 'LIGHTWEIGHT' as const,
          },
          'req-1',
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_APPLICATION_ALREADY_OPEN',
      );
    });
  });

  // ── 2. Lịch sử hồ sơ sau activation (§3) ──────────────────────────────────
  describe('Applicant history visibility (§3)', () => {
    it('allows a promoted FIGHTER to access their own admission record', async () => {
      const { service, repository } = mockDependencies();
      repository.findApplicationById.mockResolvedValueOnce({
        ...sampleApplicationRow,
        guestUserId: fighterActor.id, // Owns this application
      });

      const app = await service.getOwnApplication(fighterActor, sampleApplicationRow.id);
      expect(app.id).toBe(sampleApplicationRow.id);
      expect(app.applicant.email).toBe(sampleApplicationRow.email);
    });

    it('throws 404 if direct-recruit FIGHTER attempts to read an application they do not own', async () => {
      const { service, repository } = mockDependencies();
      // Application belongs to someone else (or does not exist)
      repository.findApplicationById.mockResolvedValueOnce(sampleApplicationRow);

      const error = await service
        .getOwnApplication(fighterActor, sampleApplicationRow.id)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_APPLICATION_NOT_FOUND',
      );
    });
  });

  // ── 3. Race condition on recovery email & resend cooldown (§4) ────────────
  describe('Recovery email race & cooldown (§4)', () => {
    it('resends email to current account email, not submission snapshot, and records attempt', async () => {
      const { service, repository, recoveryEmail } = mockDependencies();
      repository.findActivationByApplication.mockResolvedValueOnce({
        id: 'act-1',
        applicationId: sampleApplicationRow.id,
        guestUserId: guestActor.id,
        status: ACTIVATION_STATUS.PENDING,
      });
      repository.findAccountEmail.mockResolvedValueOnce('new_divergent_email@example.com');
      repository.claimRecoverySend.mockResolvedValueOnce({
        recoveryAttempts: 1,
        attemptedAt: new Date(),
      });

      const result = await service.resendActivationEmail(adminActor, sampleApplicationRow.id, 'req-1');

      expect(recoveryEmail.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
        'new_divergent_email@example.com',
      );
      expect(result.accepted).toBe(true);
      expect(result.recoveryAttempts).toBe(1);
    });

    it('rejects resend with 409 when in cooldown window', async () => {
      const { service, repository } = mockDependencies();
      repository.findActivationByApplication.mockResolvedValue({
        id: 'act-1',
        applicationId: sampleApplicationRow.id,
        guestUserId: guestActor.id,
        status: ACTIVATION_STATUS.PENDING,
      });
      // Claim fails because of active cooldown
      repository.claimRecoverySend.mockResolvedValueOnce(null);

      const error = await service
        .resendActivationEmail(adminActor, sampleApplicationRow.id, 'req-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_ACTIVATION_RESEND_COOLDOWN',
      );
    });
  });

  // ── 4. Admission Activation State Machine (§6) ────────────────────────────
  describe('Fighter Activation state machine (§6)', () => {
    it('promotes GUEST to FIGHTER in atomic transaction when PASSWORD_SET', async () => {
      const { service, repository, usersService } = mockDependencies();
      repository.lockActivationByGuestUserId.mockResolvedValueOnce({
        activation: {
          id: 'act-1',
          status: ACTIVATION_STATUS.PASSWORD_SET,
        },
        application: {
          ...sampleApplicationRow,
          status: APPLICATION_STATUS.APPROVED,
        },
      });

      const response = await service.activate(guestActor, 'req-1');

      expect(usersService.promoteGuestToFighter).toHaveBeenCalledWith(
        sampleApplicationRow.guestUserId,
        expect.objectContaining({
          firstName: sampleApplicationRow.firstName,
          lastName: sampleApplicationRow.lastName,
        }),
        expect.anything(),
      );
      expect(repository.advanceActivationStatus).toHaveBeenCalledWith(
        'act-1',
        ACTIVATION_STATUS.PASSWORD_SET,
        ACTIVATION_STATUS.COMPLETED,
        expect.anything(),
      );
      expect(repository.advanceApplicationStatus).toHaveBeenCalledWith(
        sampleApplicationRow.id,
        APPLICATION_STATUS.APPROVED,
        APPLICATION_STATUS.ACTIVATED,
        expect.anything(),
      );
      expect(response).toEqual({
        applicationId: sampleApplicationRow.id,
        status: ACTIVATION_STATUS.COMPLETED,
        role: 'FIGHTER',
        alreadyActive: false,
      });
    });

    it('returns idempotent response if activation is already COMPLETED', async () => {
      const { service, repository, usersService } = mockDependencies();
      repository.lockActivationByGuestUserId.mockResolvedValueOnce({
        activation: {
          id: 'act-1',
          status: ACTIVATION_STATUS.COMPLETED,
        },
        application: sampleApplicationRow,
      });

      const response = await service.activate(guestActor, 'req-1');

      expect(usersService.promoteGuestToFighter).not.toHaveBeenCalled();
      expect(response).toEqual({
        applicationId: sampleApplicationRow.id,
        status: ACTIVATION_STATUS.COMPLETED,
        role: 'FIGHTER',
        alreadyActive: true,
      });
    });

    it('rejects activation with 409 if password has not been set yet (status is PENDING)', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByGuestUserId.mockResolvedValueOnce({
        activation: {
          id: 'act-1',
          status: ACTIVATION_STATUS.PENDING,
        },
        application: sampleApplicationRow,
      });

      const error = await service.activate(guestActor, 'req-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_ACTIVATION_PASSWORD_NOT_SET',
      );
    });

    it('rejects activation with 409 if recovery is currently IN_PROGRESS', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByGuestUserId.mockResolvedValueOnce({
        activation: {
          id: 'act-1',
          status: ACTIVATION_STATUS.IN_PROGRESS,
        },
        application: sampleApplicationRow,
      });

      const error = await service.activate(guestActor, 'req-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_ACTIVATION_IN_PROGRESS',
      );
    });

    it('rolls back entire transaction if promoteGuestToFighter fails', async () => {
      const { service, repository, usersService } = mockDependencies();
      repository.lockActivationByGuestUserId.mockResolvedValueOnce({
        activation: {
          id: 'act-1',
          status: ACTIVATION_STATUS.PASSWORD_SET,
        },
        application: sampleApplicationRow,
      });
      usersService.promoteGuestToFighter.mockRejectedValueOnce(new Error('Promotion lock failed'));

      const error = await service.activate(guestActor, 'req-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(repository.advanceActivationStatus).not.toHaveBeenCalled();
      expect(repository.advanceApplicationStatus).not.toHaveBeenCalled();
    });
  });

  // ── 5. Email snapshot vs current account email divergence (§7) ───────────
  describe('Email divergence handling (§7)', () => {
    it('staff view exposes both applicant snapshot email and current accountEmail', async () => {
      const { service, repository } = mockDependencies();
      repository.findApplicationById.mockResolvedValueOnce({
        ...sampleApplicationRow,
        email: 'original_snapshot@example.com',
      });
      repository.findAccountEmail.mockResolvedValueOnce('updated_account@example.com');

      const staffView = await service.getApplication(sampleApplicationRow.id);

      expect(staffView.applicant.email).toBe('original_snapshot@example.com');
      expect(staffView.accountEmail).toBe('updated_account@example.com');
    });

    it('approval dispatches recovery email to account email, not the snapshot email', async () => {
      const { service, repository, recoveryEmail } = mockDependencies();
      repository.lockApplication.mockResolvedValueOnce({
        ...sampleApplicationRow,
        status: APPLICATION_STATUS.PASSED,
      });
      repository.findAssessmentByApplication.mockResolvedValueOnce({
        id: 'asm-1',
        conclusion: ASSESSMENT_CONCLUSION.PASS,
      });
      repository.findAccountEmail.mockResolvedValueOnce('brand_new_email@example.com');
      repository.claimRecoverySend.mockResolvedValueOnce({
        recoveryAttempts: 1,
        attemptedAt: new Date(),
      });

      await service.submitDecision(
        adminActor,
        sampleApplicationRow.id,
        { decision: ADMIN_DECISION.APPROVED, reason: 'Passed all tests' },
        'req-1',
      );

      expect(recoveryEmail.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
        'brand_new_email@example.com',
      );
    });
  });

  // ── 6. AdmissionActivationPort claim and stale recovery (§5) ─────────────
  describe('AdmissionActivationPort implementation (§5)', () => {
    it('claims pending activation PENDING -> IN_PROGRESS', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByAuthSubject.mockResolvedValueOnce({
        activation: { id: 'act-1', status: ACTIVATION_STATUS.PENDING },
        application: sampleApplicationRow,
      });
      repository.advanceActivationStatus.mockResolvedValueOnce(true);

      const claimResult = await service.claimPendingActivation('sub-1', 'req-1');

      expect(claimResult).toEqual({
        outcome: 'CLAIMED',
        claim: {
          applicationId: sampleApplicationRow.id,
          activationId: 'act-1',
          authSubject: 'sub-1',
        },
      });
      expect(repository.advanceActivationStatus).toHaveBeenCalledWith(
        'act-1',
        ACTIVATION_STATUS.PENDING,
        ACTIVATION_STATUS.IN_PROGRESS,
        expect.anything(),
      );
    });

    it('releases stale claim if IN_PROGRESS has exceeded timeout', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByAuthSubject.mockResolvedValueOnce({
        activation: { id: 'act-1', status: ACTIVATION_STATUS.IN_PROGRESS },
        application: sampleApplicationRow,
      });
      repository.releaseStaleClaim.mockResolvedValueOnce(true);
      repository.advanceActivationStatus.mockResolvedValueOnce(true);

      const claimResult = await service.claimPendingActivation('sub-1', 'req-1');

      expect(repository.releaseStaleClaim).toHaveBeenCalled();
      expect(claimResult.outcome).toBe('CLAIMED');
    });

    it('marks password set: IN_PROGRESS -> PASSWORD_SET', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByApplication.mockResolvedValueOnce({
        id: 'act-1',
        status: ACTIVATION_STATUS.IN_PROGRESS,
      });
      repository.advanceActivationStatus.mockResolvedValueOnce(true);

      await service.markPasswordSet(
        { applicationId: 'app-1', activationId: 'act-1', authSubject: 'sub-1' },
        'req-1',
      );

      expect(repository.advanceActivationStatus).toHaveBeenCalledWith(
        'act-1',
        ACTIVATION_STATUS.IN_PROGRESS,
        ACTIVATION_STATUS.PASSWORD_SET,
        expect.anything(),
      );
    });

    it('releases claim back to PENDING: IN_PROGRESS -> PENDING', async () => {
      const { service, repository } = mockDependencies();
      repository.lockActivationByApplication.mockResolvedValueOnce({
        id: 'act-1',
        status: ACTIVATION_STATUS.IN_PROGRESS,
      });

      await service.releaseClaim(
        { applicationId: 'app-1', activationId: 'act-1', authSubject: 'sub-1' },
        'req-1',
      );

      expect(repository.advanceActivationStatus).toHaveBeenCalledWith(
        'act-1',
        ACTIVATION_STATUS.IN_PROGRESS,
        ACTIVATION_STATUS.PENDING,
        expect.anything(),
      );
    });
  });

  // ── 7. Coach assignment & assessment workflows ────────────────────────────
  describe('Coach assignment & assessment', () => {
    it('requires reassignmentReason when replacing an active coach', async () => {
      const { service, repository } = mockDependencies();
      repository.findActiveCoachById.mockResolvedValueOnce({ id: 'new-coach-id' });
      repository.findOpenAssignment.mockResolvedValueOnce({
        id: 'asgn-old',
        coachId: 'old-coach-id',
      });

      const error = await service
        .assignCoach(
          adminActor,
          sampleApplicationRow.id,
          { coachId: 'new-coach-id', reassignmentReason: '   ' },
          'req-1',
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_APPLICATION_REASSIGNMENT_REASON_REQUIRED',
      );
    });

    it('forbids assessment submission from unassigned coach', async () => {
      const { service, repository } = mockDependencies();
      repository.findActiveCoachByUserId.mockResolvedValueOnce({ id: 'unassigned-coach' });
      repository.findOpenAssignment.mockResolvedValueOnce({
        id: 'asgn-1',
        coachId: 'assigned-coach',
      });

      const error = await service
        .submitAssessment(
          coachActor,
          sampleApplicationRow.id,
          {
            conclusion: ASSESSMENT_CONCLUSION.PASS,
            summary: 'Assessment text',
            criteria: [
              {
                criterionName: 'Cardio',
                method: 'beep test',
                observation: 'level 12',
              },
            ],
          },
          'req-1',
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
      expect(((error as HttpException).getResponse() as { code: string }).code).toBe(
        'FIGHTER_APPLICATION_NOT_ASSIGNED',
      );
    });
  });
});
