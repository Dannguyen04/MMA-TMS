import { Injectable } from '@nestjs/common';
import { TtlCache } from '../auth/auth-cache.js';
import {
  TrainingRepository,
  type TrainingListResult,
  type TrainingListScope,
} from './training.repo.js';
import { fighterScopeRequired } from './training.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { forbidden } from '../shared/errors/access.error.js';

interface ScopableListQuery {
  fighterId?: string;
  fighterIds?: string[];
  coachId?: string;
}

/**
 * How long a user's own Coach/Fighter profile id is reused by list scoping
 * (T-067). Registered with the auth caches, so `invalidateAuthCache()` (called
 * when a user's state, role or permissions change) clears it too. Only found
 * ids are cached: a profile created later is seen at once.
 */
export const ACTOR_PROFILE_CACHE_TTL_MS = 60_000;

@Injectable()
export class TrainingAccessService {
  private readonly coachIdCache = new TtlCache<string>(
    ACTOR_PROFILE_CACHE_TTL_MS,
  );
  private readonly fighterIdCache = new TtlCache<string>(
    ACTOR_PROFILE_CACHE_TTL_MS,
  );

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
   * Fighter: the active fighter of the user (`fighterId`/`fighterIds` are
   *   replaced by it, as before)
   * Coach: the active coach of the user, or a specific coach if provided. A
   *   requested `fighterId`/`fighterIds` is not checked here: the list query
   *   itself reports whether each one is assigned (`listScope`), and
   *   `assertListScope` turns an unassigned one into 403 (T-067)
   * Doctor: must provide `fighterId` or `fighterIds`; all of them are checked
   *   against the doctor's assignments in one query (T-063)
   *
   * Throws if the actor is not allowed to access the requested scope.
   */
  async scopeListQuery<T extends ScopableListQuery>(
    actor: AuthenticatedUser,
    query: T,
  ): Promise<{
    scopedQuery: T;
    activeCoachId: string | undefined;
    listScope: TrainingListScope;
  }> {
    const scopedQuery = { ...query };
    const requested = [
      ...new Set([
        ...(query.fighterId ? [query.fighterId] : []),
        ...(query.fighterIds ?? []),
      ]),
    ];
    let activeCoachId: string | undefined;
    const listScope: TrainingListScope = {};

    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.cachedActiveFighterId(actor.id);
      if (!activeFighterId) throw forbidden();
      scopedQuery.fighterId = activeFighterId;
      delete scopedQuery.fighterIds;
    } else if (actor.role === USER.COACH) {
      if (scopedQuery.coachId) {
        const ownCoachId = this.coachIdCache.get(actor.id);
        const owns =
          ownCoachId === scopedQuery.coachId ||
          (await this.repo.isCoachProfileOwnedByUser(
            actor.id,
            scopedQuery.coachId,
          ));
        if (!owns) throw forbidden();
        activeCoachId = scopedQuery.coachId;
      } else {
        const coachId = await this.cachedActiveCoachId(actor.id);
        if (!coachId) throw forbidden();
        scopedQuery.coachId = coachId;
        activeCoachId = coachId;
      }
      listScope.activeCoachId = activeCoachId;
      if (requested.length > 0) listScope.requiredFighterIds = requested;
    } else if (actor.role === USER.DOCTOR) {
      if (requested.length === 0) throw fighterScopeRequired();
      const assigned = await this.repo.findDoctorAssignedFighterIds(
        actor.id,
        requested,
      );
      if (requested.some((id) => !assigned.has(id))) throw forbidden();
    }

    return { scopedQuery, activeCoachId, listScope };
  }

  /**
   * Completes the COACH check folded into the list query: 403 when a
   * requested Fighter is not assigned. The rows of such a Fighter were never
   * selected (assignment `EXISTS`), so nothing leaks either way.
   */
  assertListScope<E>(
    result: TrainingListResult<E>,
  ): { data: E[]; total: number } {
    const { requiredFightersAssigned, ...page } = result;
    if (requiredFightersAssigned === false) throw forbidden();
    return page;
  }

  private async cachedActiveCoachId(userId: string): Promise<string | undefined> {
    const cached = this.coachIdCache.get(userId);
    if (cached) return cached;
    const coachId = await this.repo.findActiveCoachIdByUserId(userId);
    if (coachId) this.coachIdCache.set(userId, coachId);
    return coachId;
  }

  private async cachedActiveFighterId(userId: string): Promise<string | undefined> {
    const cached = this.fighterIdCache.get(userId);
    if (cached) return cached;
    const fighterId = await this.repo.findActiveFighterIdByUserId(userId);
    if (fighterId) this.fighterIdCache.set(userId, fighterId);
    return fighterId;
  }
}
