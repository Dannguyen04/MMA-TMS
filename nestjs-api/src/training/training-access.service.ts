import { Injectable } from '@nestjs/common';
import { TrainingRepository } from './training.repo.js';
import { fighterScopeRequired } from './training.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { forbidden } from '../shared/errors/access.error.js';

interface ScopableListQuery {
  fighterId?: string;
  coachId?: string;
}

@Injectable()
export class TrainingAccessService {
  constructor(private readonly repo: TrainingRepository) {}

  /**
   * DOCTOR handles medical work and must never write Training data.
   *
   * Enforced in the use case rather than only through route metadata: the
   * Authorization Guard gives an individually granted permission precedence
   * over role metadata, so a manually assigned `training.*` permission would
   * otherwise let a DOCTOR through. Reads are unaffected and stay governed by
   * the existing fighter assignment scope.
   */
  assertTrainingWriteAllowed(actor: AuthenticatedUser): void {
    if (actor.role === USER.DOCTOR) throw forbidden();
  }

  async assertFighterAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (activeFighterId !== fighterId) throw forbidden();
    } else if (actor.role === USER.COACH) {
      const isAssigned = await this.repo.isCoachAssignedToFighter(actor.id, fighterId);
      if (!isAssigned) throw forbidden();
    } else if (actor.role === USER.DOCTOR) {
      const isAssigned = await this.repo.isDoctorAssignedToFighter(actor.id, fighterId);
      if (!isAssigned) throw forbidden();
    }
  }

  /**
   * Narrows a plan/session list query to
   * Fighter: the active fighter of the user
   * Coach: the active coach of the user, or a specific coach if provided
   * Doctor: must provide a fighterId to scope to
   *
   * Throws if the actor is not allowed to access the requested scope.
   */
  async scopeListQuery<T extends ScopableListQuery>(
    actor: AuthenticatedUser,
    query: T,
  ): Promise<{ scopedQuery: T; activeCoachId: string | undefined }> {
    const scopedQuery = { ...query };
    let activeCoachId: string | undefined;

    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (!activeFighterId) throw forbidden();
      scopedQuery.fighterId = activeFighterId;
    } else if (actor.role === USER.COACH) {
      if (scopedQuery.coachId) {
        const owns = await this.repo.isCoachProfileOwnedByUser(
          actor.id,
          scopedQuery.coachId,
        );
        if (!owns) throw forbidden();
        activeCoachId = scopedQuery.coachId;
      } else {
        const coachId = await this.repo.findActiveCoachIdByUserId(actor.id);
        if (!coachId) throw forbidden();
        scopedQuery.coachId = coachId;
        activeCoachId = coachId;
      }
    } else if (actor.role === USER.DOCTOR && !scopedQuery.fighterId) {
      throw fighterScopeRequired();
    }

    if (scopedQuery.fighterId) {
      await this.assertFighterAccess(actor, scopedQuery.fighterId);
    }

    return { scopedQuery, activeCoachId };
  }
}
