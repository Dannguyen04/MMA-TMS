import { Inject, Injectable } from '@nestjs/common';
import type { GoalCheckpoint } from '../database/schema.js';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
} from '../shared/contracts/notification.contract.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  setAuditContext,
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  GOAL_LIST_SCAN_LIMIT,
  GOAL_NOTIFICATION_TEXT,
  GOAL_STATUS_ORDER,
} from './goals.constants.js';
import {
  goalCoachNotAssigned,
  goalDueDateInPast,
  goalFighterNotFound,
  goalNotFound,
  goalScopeTooLarge,
  invalidGoalCursor,
  invalidGoalDefinition,
  mapGoalPersistenceError,
} from './goals.error.js';
import {
  academyDay,
  academyDayEnd,
  academyDayStart,
  deriveGoalStatus,
  goalDefinitionIssues,
  type CreateGoalInput,
  type GoalResponse,
  type GoalStatusType,
  type ListGoalsQuery,
  type UpdateGoalInput,
} from './goals.model.js';
import {
  GoalsRepository,
  type GoalChanges,
  type GoalReadScope,
  type GoalRow,
} from './goals.repo.js';

type GoalStatusFields = Pick<
  GoalRow,
  'baseline' | 'target' | 'current' | 'lowerIsBetter' | 'startDate' | 'dueDate'
>;

function statusOf(goal: GoalStatusFields, now: Date): GoalStatusType {
  return deriveGoalStatus(goal, now);
}

/** Adds a measurement, replacing one already taken on the same academy day. */
function withCheckpoint(
  history: readonly GoalCheckpoint[],
  value: number,
  now: Date,
): GoalCheckpoint[] {
  const next = [...history];
  const last = next[next.length - 1];
  const checkpoint = { date: now.toISOString(), value };
  if (last && academyDay(new Date(last.date)) === academyDay(now)) {
    next[next.length - 1] = checkpoint;
  } else {
    next.push(checkpoint);
  }
  return next;
}

/** Position in the list order: status urgency, then due date, then id. */
type GoalSortKey = [rank: number, dueDate: string, id: string];

function sortKey(row: GoalRow, status: GoalStatusType): GoalSortKey {
  return [GOAL_STATUS_ORDER.indexOf(status), row.dueDate, row.id];
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function compareKeys(a: GoalSortKey, b: GoalSortKey): number {
  return a[0] - b[0] || compareText(a[1], b[1]) || compareText(a[2], b[2]);
}

function encodeCursor(key: GoalSortKey): string {
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeCursor(cursor: string): GoalSortKey {
  try {
    const key: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(key) &&
      key.length === 3 &&
      Number.isInteger(key[0]) &&
      typeof key[1] === 'string' &&
      typeof key[2] === 'string'
    ) {
      return key as GoalSortKey;
    }
  } catch {
    // Falls through to the invalid-cursor error.
  }
  throw invalidGoalCursor();
}

function toResponse(row: GoalRow, now: Date): GoalResponse {
  return {
    id: row.id,
    fighterId: row.fighterId,
    coachId: row.coachId,
    title: row.title,
    technique: row.technique,
    metricLabel: row.metricLabel,
    unit: row.unit,
    lowerIsBetter: row.lowerIsBetter,
    baseline: row.baseline,
    target: row.target,
    current: row.current,
    startDate: academyDayStart(row.startDate).toISOString(),
    dueDate: academyDayEnd(row.dueDate).toISOString(),
    status: statusOf(row, now),
    history: row.history,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly repo: GoalsRepository,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  /**
   * Goals in the actor's scope, most urgent first. Requested fighters outside
   * the scope narrow the result instead of failing, so a roster that changed
   * since the client loaded it still lists what remains visible.
   */
  async listGoals(actor: AuthenticatedUser, query: ListGoalsQuery) {
    try {
      const scope = await this.readScope(actor, query.fighterId);
      const rows = scope
        ? await this.repo.findGoals(
            scope,
            { coachId: query.coachId, technique: query.technique },
            GOAL_LIST_SCAN_LIMIT + 1,
          )
        : [];
      if (rows.length > GOAL_LIST_SCAN_LIMIT) {
        throw goalScopeTooLarge(GOAL_LIST_SCAN_LIMIT);
      }

      const now = new Date();
      const entries = rows
        .map((row) => {
          const status = statusOf(row, now);
          return { row, key: sortKey(row, status), status };
        })
        .filter((entry) => !query.status || query.status.includes(entry.status))
        .sort((a, b) => compareKeys(a.key, b.key));

      const after = query.cursor ? decodeCursor(query.cursor) : undefined;
      const start = after
        ? entries.findIndex((entry) => compareKeys(entry.key, after) > 0)
        : 0;
      const page =
        start === -1 ? [] : entries.slice(start, start + query.limit);
      const hasNextPage =
        start !== -1 && start + query.limit < entries.length;

      return {
        items: page.map((entry) => toResponse(entry.row, now)),
        pageInfo: {
          hasNextPage,
          endCursor: hasNextPage
            ? encodeCursor(page[page.length - 1].key)
            : null,
        },
        total: entries.length,
      };
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  async getGoal(actor: AuthenticatedUser, id: string): Promise<GoalResponse> {
    try {
      const row = await this.repo.findGoalById(id);
      if (!row || !(await this.canRead(actor, row.fighterId))) {
        throw goalNotFound();
      }
      return toResponse(row, new Date());
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  /** Creates the goal with the starting value as its first checkpoint, then tells the fighter. */
  async createGoal(
    actor: AuthenticatedUser,
    input: CreateGoalInput,
    requestId: string,
  ): Promise<GoalResponse> {
    this.assertWriteRole(actor);
    const now = new Date();
    if (input.dueDate < academyDay(now)) throw goalDueDateInPast();

    try {
      const row = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        if (!(await this.repo.isFighterActive(input.fighterId, tx))) {
          throw goalFighterNotFound();
        }
        if (
          actor.role === USER.COACH &&
          !(await this.repo.isCoachUserAssignedToFighter(
            actor.id,
            input.fighterId,
            tx,
          ))
        ) {
          throw forbidden();
        }
        await this.assertGoalCoach(actor, input.coachId, input.fighterId, tx);

        const definition = {
          baseline: input.baseline,
          target: input.target,
          current: input.current ?? input.baseline,
          lowerIsBetter: input.lowerIsBetter,
          startDate: input.startDate,
          dueDate: input.dueDate,
        };
        return this.repo.insertGoal(
          {
            ...definition,
            fighterId: input.fighterId,
            coachId: input.coachId,
            title: input.title,
            technique: input.technique,
            metricLabel: input.metricLabel,
            unit: input.unit,
            status: statusOf(definition, now),
            history: withCheckpoint([], definition.current, now),
          },
          tx,
        );
      });

      await this.notifications.notifyResolved(async () => [
        {
          recipientUserIds: await this.repo.findParticipantUserIds(
            row.fighterId,
            null,
          ),
          actorUserId: actor.id,
          type: NOTIFICATION_TYPE.GOAL_SET,
          ...GOAL_NOTIFICATION_TEXT.GOAL_SET,
          target: { type: NOTIFICATION_TARGET.GOAL, id: row.id },
          dedupeKey: `goal:${row.id}:set`,
        },
      ]);
      return toResponse(row, now);
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  /** Edits the definition; rules spanning fields are checked on the merged goal. */
  async updateGoal(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateGoalInput,
    requestId: string,
  ): Promise<GoalResponse> {
    this.assertWriteRole(actor);
    const now = new Date();
    try {
      const row = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const existing = await this.lockManagedGoal(actor, id, tx);

        const merged = {
          baseline: input.baseline ?? existing.baseline,
          target: input.target ?? existing.target,
          current: existing.current,
          lowerIsBetter: input.lowerIsBetter ?? existing.lowerIsBetter,
          startDate: input.startDate ?? existing.startDate,
          dueDate: input.dueDate ?? existing.dueDate,
        };
        const issues = goalDefinitionIssues(merged);
        if (issues.length > 0) throw invalidGoalDefinition(issues);
        if (input.coachId !== undefined && input.coachId !== existing.coachId) {
          await this.assertGoalCoach(actor, input.coachId, existing.fighterId, tx);
        }

        const changes: GoalChanges = {
          coachId: input.coachId,
          title: input.title,
          technique: input.technique,
          metricLabel: input.metricLabel,
          unit: input.unit,
          lowerIsBetter: input.lowerIsBetter,
          baseline: input.baseline,
          target: input.target,
          startDate: input.startDate,
          dueDate: input.dueDate,
          status: statusOf(merged, now),
        };
        const row = await this.repo.updateGoal(id, changes, tx);
        if (!row) throw goalNotFound();
        return row;
      });
      return toResponse(row, now);
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  /**
   * Records a measurement as the current value and in the history, replacing
   * one taken earlier the same academy day. Tells the fighter and the goal
   * coach when it first reaches the target.
   */
  async logProgress(
    actor: AuthenticatedUser,
    id: string,
    value: number,
    requestId: string,
  ): Promise<GoalResponse> {
    this.assertWriteRole(actor);
    const now = new Date();
    try {
      const { row, reached } = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const existing = await this.lockManagedGoal(actor, id, tx);
        const previousStatus = statusOf(existing, now);
        const status = statusOf({ ...existing, current: value }, now);

        const row = await this.repo.updateGoal(
          id,
          {
            current: value,
            history: withCheckpoint(existing.history, value, now),
            status,
          },
          tx,
        );
        if (!row) throw goalNotFound();
        return {
          row,
          reached: status === 'ACHIEVED' && previousStatus !== 'ACHIEVED',
        };
      });

      if (reached) {
        await this.notifications.notifyResolved(async () => [
          {
            recipientUserIds: await this.repo.findParticipantUserIds(
              row.fighterId,
              row.coachId,
            ),
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.GOAL_ACHIEVED,
            ...GOAL_NOTIFICATION_TEXT.GOAL_ACHIEVED,
            target: { type: NOTIFICATION_TARGET.GOAL, id: row.id },
            // A goal that drops back and is reached again is a new event.
            dedupeKey: `goal:${row.id}:achieved:${now.toISOString()}`,
          },
        ]);
      }
      return toResponse(row, now);
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  /** Soft-deletes the goal; it no longer appears anywhere. */
  async deleteGoal(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
  ): Promise<null> {
    this.assertWriteRole(actor);
    try {
      await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        await this.lockManagedGoal(actor, id, tx);
        if (!(await this.repo.deleteGoal(id, tx))) throw goalNotFound();
      });
      return null;
    } catch (error) {
      throw mapGoalPersistenceError(error);
    }
  }

  // --- Access ---

  /**
   * Coaches and Admins manage goals. Enforced here as well as by permission:
   * the Authorization Guard lets an individually granted permission through
   * regardless of role, and Fighters and Doctors must not write goals.
   */
  private assertWriteRole(actor: AuthenticatedUser): void {
    if (actor.role !== USER.COACH && actor.role !== USER.ADMIN) {
      throw forbidden();
    }
  }

  /** Null when the actor's scope cannot contain any of the requested fighters. */
  private async readScope(
    actor: AuthenticatedUser,
    requestedFighterIds: readonly string[] | undefined,
  ): Promise<GoalReadScope | null> {
    switch (actor.role) {
      case USER.ADMIN:
        return { fighterIds: requestedFighterIds };
      case USER.FIGHTER: {
        const ownFighterId = await this.repo.findActiveFighterIdByUserId(actor.id);
        if (!ownFighterId) throw forbidden();
        if (requestedFighterIds && !requestedFighterIds.includes(ownFighterId)) {
          return null;
        }
        return { fighterIds: [ownFighterId] };
      }
      case USER.COACH:
        return {
          fighterIds: requestedFighterIds,
          assignedCoachUserId: actor.id,
        };
      case USER.DOCTOR:
        return {
          fighterIds: requestedFighterIds,
          assignedDoctorUserId: actor.id,
        };
      default:
        throw forbidden();
    }
  }

  private async canRead(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<boolean> {
    switch (actor.role) {
      case USER.ADMIN:
        return true;
      case USER.FIGHTER:
        return (
          (await this.repo.findActiveFighterIdByUserId(actor.id)) === fighterId
        );
      case USER.COACH:
        return this.repo.isCoachUserAssignedToFighter(actor.id, fighterId);
      case USER.DOCTOR:
        return this.repo.isDoctorUserAssignedToFighter(actor.id, fighterId);
      default:
        return false;
    }
  }

  /**
   * Locks a goal the actor may change. A goal of a fighter the coach doesn't
   * coach reads as missing, so other rosters aren't revealed.
   */
  private async lockManagedGoal(
    actor: AuthenticatedUser,
    id: string,
    database: Transaction,
  ): Promise<GoalRow> {
    const goal = await this.repo.lockGoalById(id, database);
    if (
      !goal ||
      (actor.role === USER.COACH &&
        !(await this.repo.isCoachUserAssignedToFighter(
          actor.id,
          goal.fighterId,
          database,
        )))
    ) {
      throw goalNotFound();
    }
    return goal;
  }

  /**
   * The goal coach is an active coach assigned to the fighter. A Coach sets
   * goals in their own name; an Admin may name any assigned coach.
   */
  private async assertGoalCoach(
    actor: AuthenticatedUser,
    coachId: string,
    fighterId: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    if (
      actor.role === USER.COACH &&
      (await this.repo.findActiveCoachIdByUserId(actor.id, database)) !== coachId
    ) {
      throw forbidden();
    }
    if (!(await this.repo.isCoachAssignedToFighter(coachId, fighterId, database))) {
      throw goalCoachNotAssigned();
    }
  }
}
