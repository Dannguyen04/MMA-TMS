import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type {
  NotificationPublisher,
  NotifyInput,
} from '../shared/contracts/notification.contract.js';
import {
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
} from '../shared/contracts/notification.contract.js';
import { DoctorAssignmentReminder } from './doctor-assignment-reminder.service.js';
import { MEDICAL_NOTIFICATION_TEXT } from './medical.constants.js';
import { MedicalRepository } from './medical.repo.js';

describe('DoctorAssignmentReminder', () => {
  let reminder: DoctorAssignmentReminder;
  let repo: Mocked<MedicalRepository>;
  let authorization: Mocked<AuthorizationService>;
  let academySettingsRepo: Mocked<AcademySettingsRepository>;
  let notifications: Mocked<NotificationPublisher>;

  const fighterUserId = 'usr-fighter-001';
  const fighterId = 'ftr-profile-001';
  const adminUserId = 'usr-admin-001';
  const requestId = 'req-123';

  beforeEach(() => {
    repo = {
      findFighterDoctorAssignmentState: vi.fn(),
    } as unknown as Mocked<MedicalRepository>;

    authorization = {
      findActiveUserIdsWithPermission: vi.fn(),
    } as unknown as Mocked<AuthorizationService>;

    academySettingsRepo = {
      getMedicalSupervision: vi.fn(),
    } as unknown as Mocked<AcademySettingsRepository>;

    notifications = {
      notify: vi.fn(),
      notifyResolved: vi.fn(),
    } as unknown as Mocked<NotificationPublisher>;

    reminder = new DoctorAssignmentReminder(
      repo,
      authorization,
      academySettingsRepo,
      notifications,
    );
  });

  describe('when medical_supervision = NONE (Criterion 8)', () => {
    it('skips notification and returns SUPERVISION_DISABLED without calling publisher', async () => {
      academySettingsRepo.getMedicalSupervision.mockResolvedValue('NONE');

      const results = await reminder.remind(fighterUserId, requestId);

      expect(results).toEqual([
        { status: 'skipped', reason: 'SUPERVISION_DISABLED' },
      ]);
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
      expect(repo.findFighterDoctorAssignmentState).not.toHaveBeenCalled();
      expect(
        authorization.findActiveUserIdsWithPermission,
      ).not.toHaveBeenCalled();
    });
  });

  describe('when medical_supervision = DOCTOR', () => {
    beforeEach(() => {
      academySettingsRepo.getMedicalSupervision.mockResolvedValue('DOCTOR');
      notifications.notifyResolved.mockImplementation(
        async (resolve, _context) => {
          const inputs = await resolve();
          return inputs.map(() => ({ status: 'queued' as const }));
        },
      );
    });

    it('publishes reminder notification when fighter has no effective doctor', async () => {
      repo.findFighterDoctorAssignmentState.mockResolvedValue({
        fighterId,
        hasEffectiveDoctor: false,
      });
      authorization.findActiveUserIdsWithPermission.mockResolvedValue([
        adminUserId,
      ]);

      let capturedInputs: readonly NotifyInput[] = [];
      notifications.notifyResolved.mockImplementation(
        async (resolve, context) => {
          capturedInputs = await resolve();
          expect(context).toEqual({ correlationId: requestId });
          return [{ status: 'queued' }];
        },
      );

      const results = await reminder.remind(
        fighterUserId,
        requestId,
        'actor-admin-id',
      );

      expect(results).toEqual([{ status: 'queued' }]);
      expect(capturedInputs).toHaveLength(1);
      expect(capturedInputs[0]).toEqual({
        recipientUserIds: [adminUserId],
        actorUserId: 'actor-admin-id',
        type: NOTIFICATION_TYPE.FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED,
        ...MEDICAL_NOTIFICATION_TEXT.DOCTOR_ASSIGNMENT_REQUIRED,
        target: { type: NOTIFICATION_TARGET.FIGHTER, id: fighterId },
        dedupeKey: `fighter:${fighterId}:doctor-assignment-required`,
      });
    });

    it('resolves empty list when fighter already has effective doctor', async () => {
      repo.findFighterDoctorAssignmentState.mockResolvedValue({
        fighterId,
        hasEffectiveDoctor: true,
      });
      authorization.findActiveUserIdsWithPermission.mockResolvedValue([
        adminUserId,
      ]);

      let capturedInputs: readonly NotifyInput[] = [];
      notifications.notifyResolved.mockImplementation(async (resolve) => {
        capturedInputs = await resolve();
        return [];
      });

      const results = await reminder.remind(fighterUserId, requestId);

      expect(results).toEqual([]);
      expect(capturedInputs).toEqual([]);
    });

    it('resolves empty list when fighter is not found', async () => {
      repo.findFighterDoctorAssignmentState.mockResolvedValue(null);
      authorization.findActiveUserIdsWithPermission.mockResolvedValue([
        adminUserId,
      ]);

      let capturedInputs: readonly NotifyInput[] = [];
      notifications.notifyResolved.mockImplementation(async (resolve) => {
        capturedInputs = await resolve();
        return [];
      });

      const results = await reminder.remind(fighterUserId, requestId);

      expect(results).toEqual([]);
      expect(capturedInputs).toEqual([]);
    });
  });
});
