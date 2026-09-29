import { HttpStatus } from '@nestjs/common';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { MEDICAL_READ_VIEW } from './medical.constants.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MedicalRepository } from './medical.repo.js';

const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const otherUserId = '8473a317-317a-4b0a-8b01-eb4e961ff52f';
const coachUserId = '1317a43a-05af-4f2c-bc5b-781219643b68';
const doctorUserId = '7ca0a87a-af9e-4dcf-809c-35cc02c57bed';
const doctorProfileId = 'doc-profile-001';
const adminUserId = 'ad310000-0000-4000-8000-000000000001';
const requestId = 'req-audit-123';

const fighterRef = { id: fighterId, userId: fighterUserId };

const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-sub',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-sub',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

const otherFighterActor: AuthenticatedUser = {
  id: otherUserId,
  authSubject: 'other-fighter-sub',
  email: 'other@example.com',
  role: USER.FIGHTER,
};

const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-sub',
  email: 'coach@example.com',
  role: USER.COACH,
};

const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-sub',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const guestActor: AuthenticatedUser = {
  id: 'guest-user-id',
  authSubject: 'guest-sub',
  email: 'guest@example.com',
  role: USER.GUEST,
};

const dummyTx = { execute: vi.fn() } as unknown as Transaction;

function repositoryMock(): Mocked<MedicalRepository> {
  return {
    findFighter: vi.fn().mockResolvedValue(fighterRef),
    isCoachUserAssignedToFighter: vi.fn().mockResolvedValue(true),
    isDoctorUserAssignedToFighter: vi.fn().mockResolvedValue(true),
    insertMedicalReadAudit: vi.fn().mockResolvedValue(undefined),
    findActiveDoctorIdByUserId: vi.fn().mockResolvedValue(doctorProfileId),
    lockEffectiveDoctorAssignment: vi.fn().mockResolvedValue({ id: 'assign-1' }),
  } as unknown as Mocked<MedicalRepository>;
}

describe('MedicalAccessService', () => {
  let service: MedicalAccessService;
  let repo: Mocked<MedicalRepository>;

  beforeEach(() => {
    repo = repositoryMock();
    service = new MedicalAccessService(repo);
  });

  describe('requireFighter', () => {
    it('returns fighter ref when fighter exists', async () => {
      await expect(service.requireFighter(fighterId)).resolves.toEqual(fighterRef);
      expect(repo.findFighter).toHaveBeenCalledWith(fighterId);
    });

    it('throws 404 FIGHTER_NOT_FOUND when fighter does not exist', async () => {
      repo.findFighter.mockResolvedValueOnce(undefined);
      await expect(service.requireFighter('unknown-id')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'FIGHTER_NOT_FOUND' },
      });
    });
  });

  describe('canReadFighter (D1 Matrix)', () => {
    it('allows ADMIN to read any fighter', async () => {
      await expect(service.canReadFighter(adminActor, fighterRef)).resolves.toBe(true);
    });

    it('allows FIGHTER to read self', async () => {
      await expect(service.canReadFighter(fighterActor, fighterRef)).resolves.toBe(true);
    });

    it('denies FIGHTER to read another fighter', async () => {
      await expect(service.canReadFighter(otherFighterActor, fighterRef)).resolves.toBe(false);
    });

    it('allows assigned COACH to read fighter', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValueOnce(true);
      await expect(service.canReadFighter(coachActor, fighterRef)).resolves.toBe(true);
      expect(repo.isCoachUserAssignedToFighter).toHaveBeenCalledWith(coachActor.id, fighterId);
    });

    it('denies unassigned COACH to read fighter', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValueOnce(false);
      await expect(service.canReadFighter(coachActor, fighterRef)).resolves.toBe(false);
    });

    it('allows assigned DOCTOR to read fighter', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(true);
      await expect(service.canReadFighter(doctorActor, fighterRef)).resolves.toBe(true);
      expect(repo.isDoctorUserAssignedToFighter).toHaveBeenCalledWith(doctorActor.id, fighterId);
    });

    it('denies unassigned DOCTOR to read fighter', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(false);
      await expect(service.canReadFighter(doctorActor, fighterRef)).resolves.toBe(false);
    });

    it('denies GUEST to read fighter', async () => {
      await expect(service.canReadFighter(guestActor, fighterRef)).resolves.toBe(false);
    });
  });

  describe('assertReadScope', () => {
    it('succeeds when actor is permitted to read', async () => {
      await expect(service.assertReadScope(adminActor, fighterId)).resolves.toBeUndefined();
    });

    it('throws 403 FORBIDDEN when actor is not permitted to read', async () => {
      await expect(service.assertReadScope(otherFighterActor, fighterId)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });
  });

  describe('authorizeClinicalRead (D1 Matrix + Audit)', () => {
    it('allows authorized read and logs metadata audit row without clinical content', async () => {
      await expect(
        service.authorizeClinicalRead(
          doctorActor,
          fighterId,
          MEDICAL_READ_VIEW.DOSSIER,
          requestId,
        ),
      ).resolves.toBeUndefined();

      expect(repo.insertMedicalReadAudit).toHaveBeenCalledWith(
        doctorActor.id,
        fighterId,
        MEDICAL_READ_VIEW.DOSSIER,
        requestId,
      );
    });

    it('throws 403 MEDICAL_ACCESS_DENIED when actor fails read scope', async () => {
      await expect(
        service.authorizeClinicalRead(
          otherFighterActor,
          fighterId,
          MEDICAL_READ_VIEW.DOSSIER,
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'MEDICAL_ACCESS_DENIED' },
      });
      expect(repo.insertMedicalReadAudit).not.toHaveBeenCalled();
    });

    it('throws 500 MEDICAL_OPERATION_FAILED if audit insert fails (fail-closed)', async () => {
      repo.insertMedicalReadAudit.mockRejectedValueOnce(new Error('DB failure'));

      await expect(
        service.authorizeClinicalRead(
          adminActor,
          fighterId,
          MEDICAL_READ_VIEW.HISTORY,
          requestId,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        response: { code: 'MEDICAL_OPERATION_FAILED' },
      });
    });
  });

  describe('requireAssignedDoctor (D2 Matrix)', () => {
    it('returns doctor profile id when DOCTOR has active profile and active assignment', async () => {
      await expect(
        service.requireAssignedDoctor(doctorActor, fighterId, dummyTx),
      ).resolves.toBe(doctorProfileId);

      expect(repo.findActiveDoctorIdByUserId).toHaveBeenCalledWith(doctorActor.id, dummyTx);
      expect(repo.lockEffectiveDoctorAssignment).toHaveBeenCalledWith(
        doctorProfileId,
        fighterId,
        dummyTx,
      );
    });

    it('denies non-DOCTOR role (ADMIN) even with write permission', async () => {
      await expect(
        service.requireAssignedDoctor(adminActor, fighterId, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
      expect(repo.findActiveDoctorIdByUserId).not.toHaveBeenCalled();
    });

    it('denies DOCTOR without active profile', async () => {
      repo.findActiveDoctorIdByUserId.mockResolvedValueOnce(undefined);
      await expect(
        service.requireAssignedDoctor(doctorActor, fighterId, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('denies DOCTOR without effective assignment to this fighter', async () => {
      repo.lockEffectiveDoctorAssignment.mockResolvedValueOnce(undefined);
      await expect(
        service.requireAssignedDoctor(doctorActor, fighterId, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });
  });

  describe('assertReviewRequestScope (D9)', () => {
    it('allows FIGHTER for self', async () => {
      await expect(
        service.assertReviewRequestScope(fighterActor, fighterRef, dummyTx),
      ).resolves.toBeUndefined();
    });

    it('denies FIGHTER for other fighter', async () => {
      await expect(
        service.assertReviewRequestScope(otherFighterActor, fighterRef, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('allows assigned COACH', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValueOnce(true);
      await expect(
        service.assertReviewRequestScope(coachActor, fighterRef, dummyTx),
      ).resolves.toBeUndefined();
    });

    it('denies unassigned COACH', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValueOnce(false);
      await expect(
        service.assertReviewRequestScope(coachActor, fighterRef, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('allows assigned DOCTOR', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(true);
      await expect(
        service.assertReviewRequestScope(doctorActor, fighterRef, dummyTx),
      ).resolves.toBeUndefined();
    });

    it('denies unassigned DOCTOR', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(false);
      await expect(
        service.assertReviewRequestScope(doctorActor, fighterRef, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('denies ADMIN to create review request', async () => {
      await expect(
        service.assertReviewRequestScope(adminActor, fighterRef, dummyTx),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });
  });

  describe('assertDoctorFighterScope', () => {
    it('is a no-op for non-DOCTOR roles', async () => {
      await expect(service.assertDoctorFighterScope(coachActor, fighterId)).resolves.toBeUndefined();
      expect(repo.isDoctorUserAssignedToFighter).not.toHaveBeenCalled();
    });

    it('allows assigned DOCTOR', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(true);
      await expect(service.assertDoctorFighterScope(doctorActor, fighterId)).resolves.toBeUndefined();
      expect(repo.isDoctorUserAssignedToFighter).toHaveBeenCalledWith(doctorActor.id, fighterId);
    });

    it('denies unassigned DOCTOR', async () => {
      repo.isDoctorUserAssignedToFighter.mockResolvedValueOnce(false);
      await expect(service.assertDoctorFighterScope(doctorActor, fighterId)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });
  });
});
