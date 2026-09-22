import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { NavigationBadgeCounts } from './navigation.model.js';
import { NavigationRepository } from './navigation.repo.js';

@Injectable()
export class NavigationService {
  constructor(private readonly repository: NavigationRepository) {}

  async getBadges(actor: AuthenticatedUser): Promise<NavigationBadgeCounts> {
    const notifications = await this.repository.countUnreadNotifications(
      actor.id,
    );

    if (actor.role === USER.COACH) {
      return {
        notifications,
        reviewQueue: await this.repository.countCoachReviewQueue(actor.id),
      };
    }
    if (actor.role === USER.DOCTOR) {
      return {
        notifications,
        newAlerts: await this.repository.countDoctorPendingAlerts(actor.id),
      };
    }
    if (actor.role === USER.ADMIN) {
      return {
        notifications,
        failedJobs: await this.repository.countFailedJobs(),
      };
    }
    return { notifications };
  }
}
