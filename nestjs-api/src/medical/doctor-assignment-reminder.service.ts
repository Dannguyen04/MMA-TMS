import { Inject, Injectable } from '@nestjs/common';
import { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
  type NotifyResult,
} from '../shared/contracts/notification.contract.js';
import { USER } from '../shared/types/user.role.js';
import {
  MEDICAL_NOTIFICATION_TEXT,
  MEDICAL_PERMISSIONS,
} from './medical.constants.js';
import { MedicalRepository } from './medical.repo.js';

/**
 * Asks the Admins who can assign Doctors to do so for a new Fighter, because
 * the baseline examination required before training needs an assigned Doctor.
 * Call only after the Fighter's creation has committed. Never throws: the
 * publisher reports failures instead, so a notification problem never undoes
 * an activation or an account creation.
 */
@Injectable()
export class DoctorAssignmentReminder {
  constructor(
    private readonly repo: MedicalRepository,
    private readonly authorization: AuthorizationService,
    private readonly academySettingsRepo: AcademySettingsRepository,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  /**
   * Nothing is sent when the user has no Fighter profile or the Fighter
   * already has an effective Doctor assignment. Recipients are only Admins
   * with effective `fighter.doctor:assign`; a lookup error fails this
   * notification and never widens it to every Admin. One reminder per
   * Fighter: a replay or retry reuses the same dedupe key.
   */
  async remind(
    fighterUserId: string,
    requestId: string,
    actorUserId?: string,
  ): Promise<readonly NotifyResult[]> {
    const supervision = await this.academySettingsRepo.getMedicalSupervision();
    if (supervision === 'NONE') {
      return [{ status: 'skipped', reason: 'SUPERVISION_DISABLED' }];
    }

    return this.notifications.notifyResolved(
      async () => {
        const [fighter, recipientUserIds] = await Promise.all([
          this.repo.findFighterDoctorAssignmentState(fighterUserId),
          this.authorization.findActiveUserIdsWithPermission(
            USER.ADMIN,
            MEDICAL_PERMISSIONS.DOCTOR_ASSIGN,
          ),
        ]);
        if (!fighter || fighter.hasEffectiveDoctor) return [];
        return [
          {
            recipientUserIds,
            ...(actorUserId ? { actorUserId } : {}),
            type: NOTIFICATION_TYPE.FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED,
            ...MEDICAL_NOTIFICATION_TEXT.DOCTOR_ASSIGNMENT_REQUIRED,
            target: { type: NOTIFICATION_TARGET.FIGHTER, id: fighter.fighterId },
            dedupeKey: `fighter:${fighter.fighterId}:doctor-assignment-required`,
          },
        ];
      },
      { correlationId: requestId },
    );
  }
}
