import { Injectable } from '@nestjs/common';
import type { SuspensionRow } from '../database/schema.js';
import { fighterNotFound } from '../fighters/fighters.error.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import {
  mapSuspensionPersistenceError,
  suspensionAlreadyCleared,
  suspensionNotFound,
  suspensionValidationError,
} from './suspensions.error.js';
import {
  academyDateOf,
  clearSuspensionSchema,
  createSuspensionSchema,
  DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
  deriveRequiresClearance,
  encodeSuspensionCursor,
  endsOnFor,
  suspensionStatusOn,
  type ClearSuspensionInput,
  type CreateSuspensionInput,
  type ListSuspensionsQuery,
  type LossOfConsciousness,
  type SuspensionListResponse,
  type SuspensionResponse,
} from './suspensions.model.js';
import {
  SuspensionsRepository,
  type SuspensionScope,
} from './suspensions.repo.js';

@Injectable()
export class SuspensionsService {
  constructor(private readonly repo: SuspensionsRepository) {}

  async listSuspensions(
    actor: AuthenticatedUser,
    query: ListSuspensionsQuery,
  ): Promise<SuspensionListResponse> {
    const today = academyDateOf(new Date());
    const scope = await this.resolveListScope(actor, query.fighterId);
    const rows = await this.repo.listSuspensions({
      scope,
      fighterId: query.fighterId,
      active: query.active,
      today,
      cursor: query.cursor,
      limit: query.limit,
    });
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map((row) => toSuspensionResponse(row, today)),
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeSuspensionCursor({
              startsOn: last.startsOn,
              id: last.id,
            })
          : null,
    };
  }

  async createSuspension(
    actor: AuthenticatedUser,
    input: CreateSuspensionInput,
    requestId: string,
  ): Promise<SuspensionResponse> {
    const parsed = createSuspensionSchema.safeParse(input);
    if (!parsed.success) {
      throw suspensionValidationError(
        'Validation failed',
        parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path as (string | number)[],
          message: issue.message,
        })),
      );
    }
    const data = parsed.data;

    await this.assertCreateAccess(actor, data.fighterId);

    const today = academyDateOf(new Date());
    const startsOn = data.startsOn ?? today;
    const endsOn = endsOnFor(startsOn, data.days);
    const clearance = deriveRequiresClearance(
      data.reason,
      data.requiresClearance,
    );
    if (!clearance.ok) {
      throw suspensionValidationError('Invalid requiresClearance for reason');
    }
    const blockedSessionTypes = data.blockedSessionTypes ?? [
      ...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
    ];

    try {
      const created = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.repo.insertSuspension(
          {
            fighterId: data.fighterId,
            boutId: null,
            reason: data.reason,
            startsOn,
            endsOn,
            lossOfConsciousness: data.lossOfConsciousness ?? null,
            suggestedDays: null,
            overrideReason: null,
            blockedSessionTypes,
            requiresClearance: clearance.requiresClearance,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: actor.id,
          },
          tx,
        );
      });
      return toSuspensionResponse(created, today);
    } catch (error) {
      throw mapSuspensionPersistenceError(error);
    }
  }

  async clearSuspension(
    actor: AuthenticatedUser,
    id: string,
    input: ClearSuspensionInput,
    requestId: string,
  ): Promise<SuspensionResponse> {
    const parsed = clearSuspensionSchema.safeParse(input);
    if (!parsed.success) {
      throw suspensionValidationError(
        'Validation failed',
        parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path as (string | number)[],
          message: issue.message,
        })),
      );
    }

    if (actor.role !== USER.COACH && actor.role !== USER.DOCTOR) {
      throw forbidden();
    }

    const current = await this.requireSuspension(id);
    await this.assertClearAccess(actor, current.fighterId);

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const locked = await this.repo.lockSuspensionById(id, tx);
        if (!locked) throw suspensionNotFound();
        if (locked.clearedAt !== null) throw suspensionAlreadyCleared();
        const cleared = await this.repo.clearSuspension(
          id,
          {
            clearedAt: new Date(),
            clearedById: actor.id,
            clearanceNote: parsed.data.clearanceNote,
          },
          tx,
        );
        if (!cleared) throw suspensionAlreadyCleared();
        return cleared;
      });
      return toSuspensionResponse(updated, academyDateOf(new Date()));
    } catch (error) {
      throw mapSuspensionPersistenceError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async requireSuspension(id: string): Promise<SuspensionRow> {
    const row = await this.repo.findSuspensionById(id);
    if (!row) throw suspensionNotFound();
    return row;
  }

  private async resolveListScope(
    actor: AuthenticatedUser,
    fighterId: string | undefined,
  ): Promise<SuspensionScope> {
    switch (actor.role) {
      case USER.ADMIN:
        return { kind: 'ALL' };
      case USER.FIGHTER: {
        const own = await this.repo.findActiveFighterIdByUserId(actor.id);
        if (!own || (fighterId !== undefined && fighterId !== own)) {
          throw forbidden();
        }
        return { kind: 'FIGHTER', fighterId: own };
      }
      case USER.COACH:
        if (fighterId) await this.assertReadAccess(actor, fighterId);
        return { kind: 'COACH', userId: actor.id };
      case USER.DOCTOR:
        if (fighterId) await this.assertReadAccess(actor, fighterId);
        return { kind: 'DOCTOR', userId: actor.id };
      default:
        throw forbidden();
    }
  }

  private async assertReadAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.ADMIN) return;
    if (actor.role === USER.FIGHTER) {
      const own = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (own !== fighterId) throw forbidden();
    } else if (actor.role === USER.COACH) {
      if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
    } else if (actor.role === USER.DOCTOR) {
      if (!(await this.repo.isDoctorAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
    } else {
      throw forbidden();
    }
  }

  private async assertCreateAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.ADMIN) {
      if (!(await this.repo.isActiveFighter(fighterId))) {
        throw fighterNotFound();
      }
      return;
    }
    if (actor.role === USER.COACH) {
      if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
      return;
    }
    if (actor.role === USER.DOCTOR) {
      if (!(await this.repo.isDoctorAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
      return;
    }
    throw forbidden();
  }

  private async assertClearAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.COACH) {
      if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
      return;
    }
    if (actor.role === USER.DOCTOR) {
      if (!(await this.repo.isDoctorAssignedToFighter(actor.id, fighterId))) {
        throw forbidden();
      }
      return;
    }
    throw forbidden();
  }
}

export function toSuspensionResponse(
  row: SuspensionRow,
  today: string,
): SuspensionResponse {
  return {
    id: row.id,
    fighterId: row.fighterId,
    boutId: row.boutId,
    reason: row.reason,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    lossOfConsciousness:
      (row.lossOfConsciousness as LossOfConsciousness | null) ?? null,
    suggestedDays: row.suggestedDays,
    overrideReason: row.overrideReason,
    blockedSessionTypes: [...row.blockedSessionTypes],
    requiresClearance: row.requiresClearance,
    clearedAt: row.clearedAt ? row.clearedAt.toISOString() : null,
    clearedById: row.clearedById,
    clearanceNote: row.clearanceNote,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: suspensionStatusOn(row, today),
  };
}
