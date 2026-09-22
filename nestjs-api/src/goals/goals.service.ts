import { Injectable } from '@nestjs/common';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  type DatabaseExecutor,
  setAuditContext,
} from '../shared/utils/audit-context.util.js';
import { goalNotFound, invalidGoalRange } from './goals.error.js';
import type {
  CreateGoalInput,
  GoalProgressInput,
  GoalResponse,
  GoalStatusType,
  ListGoalsQuery,
  UpdateGoalInput,
} from './goals.model.js';
import {
  type GoalHistoryRecord,
  type GoalListScope,
  type GoalRecord,
  GoalsRepository,
} from './goals.repo.js';

const dayMs = 86_400_000;
const minTrendDays = 7;

function reached(
  goal: Pick<GoalRecord, 'current' | 'target' | 'lowerIsBetter'>,
) {
  return goal.lowerIsBetter
    ? goal.current <= goal.target
    : goal.current >= goal.target;
}

function statusFor(
  goal: Pick<
    GoalRecord,
    | 'baseline'
    | 'target'
    | 'current'
    | 'lowerIsBetter'
    | 'startDate'
    | 'dueDate'
  >,
  now = new Date(),
): GoalStatusType {
  if (reached(goal)) return 'ACHIEVED';
  const daysLeft = (goal.dueDate.getTime() - now.getTime()) / dayMs;
  if (daysLeft < 0) return 'MISSED';
  const elapsed = (now.getTime() - goal.startDate.getTime()) / dayMs;
  if (elapsed < minTrendDays) return 'ON_TRACK';
  const projected =
    goal.current + ((goal.current - goal.baseline) / elapsed) * daysLeft;
  return reached({ ...goal, current: projected }) ? 'ON_TRACK' : 'AT_RISK';
}

function toPublicGoal(
  goal: GoalRecord,
  history: GoalHistoryRecord[],
): GoalResponse {
  return {
    id: goal.id,
    fighterId: goal.fighterId,
    coachId: goal.coachId,
    title: goal.title,
    technique: goal.technique,
    metricLabel: goal.metricLabel,
    unit: goal.unit,
    lowerIsBetter: goal.lowerIsBetter,
    baseline: goal.baseline,
    target: goal.target,
    current: goal.current,
    startDate: goal.startDate.toISOString(),
    dueDate: goal.dueDate.toISOString(),
    status: goal.status,
    history: history.map((item) => ({
      date: item.date.toISOString(),
      value: item.value,
    })),
    createdAt: goal.createdAt.toISOString(),
  };
}

@Injectable()
export class GoalsService {
  constructor(private readonly repository: GoalsRepository) {}

  async list(actor: AuthenticatedUser, query: ListGoalsQuery) {
    const scope = await this.listScope(actor);
    const page = await this.repository.findPage(query, scope);
    const history = await this.repository.findHistoryByGoalIds(
      page.items.map((item) => item.id),
    );
    return {
      ...page,
      items: page.items.map((item) =>
        toPublicGoal(item, history.get(item.id) ?? []),
      ),
    };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const goal = await this.repository.findById(id);
    if (!goal) throw goalNotFound();
    await this.assertRead(actor, goal.fighterId);
    return this.publicGoal(goal);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateGoalInput,
    requestId: string,
  ) {
    if (actor.role !== USER.COACH) throw forbidden();
    return this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const coachId = await this.repository.findActiveCoachIdByUserId(
        actor.id,
        transaction,
      );
      if (
        !coachId ||
        !(await this.repository.isCoachAssignedToFighter(
          actor.id,
          input.fighterId,
          transaction,
        ))
      )
        throw forbidden();
      const current = input.current ?? input.baseline;
      const candidate = {
        ...input,
        coachId,
        current,
        startDate: new Date(input.startDate),
        dueDate: new Date(input.dueDate),
      };
      this.assertRange(candidate);
      const goal = await this.repository.create(
        { ...input, coachId, current, status: statusFor(candidate) },
        transaction,
      );
      await this.repository.appendProgress(
        { goalId: goal.id, value: current, recordedById: actor.id },
        transaction,
      );
      return this.publicGoal(goal, transaction);
    });
  }

  async updateProgress(
    actor: AuthenticatedUser,
    id: string,
    input: GoalProgressInput,
    requestId: string,
  ) {
    return this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const goal = await this.repository.findById(id, transaction);
      if (!goal) throw goalNotFound();
      await this.assertWrite(actor, goal.fighterId, transaction);
      const status = statusFor({ ...goal, current: input.value });
      const updated = await this.repository.update(
        id,
        { current: input.value, status },
        transaction,
      );
      if (!updated) throw goalNotFound();
      await this.repository.appendProgress(
        { goalId: id, value: input.value, recordedById: actor.id },
        transaction,
      );
      return this.publicGoal(updated, transaction);
    });
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateGoalInput,
    requestId: string,
  ) {
    return this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const goal = await this.repository.findById(id, transaction);
      if (!goal) throw goalNotFound();
      await this.assertWrite(actor, goal.fighterId, transaction);
      if (input.coachId && input.coachId !== goal.coachId) throw forbidden();
      const candidate = {
        ...goal,
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : goal.startDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : goal.dueDate,
      };
      this.assertRange(candidate);
      const updated = await this.repository.update(
        id,
        { ...input, status: statusFor(candidate) },
        transaction,
      );
      if (!updated) throw goalNotFound();
      return this.publicGoal(updated, transaction);
    });
  }

  async delete(actor: AuthenticatedUser, id: string, requestId: string) {
    await this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const goal = await this.repository.findById(id, transaction);
      if (!goal) throw goalNotFound();
      await this.assertWrite(actor, goal.fighterId, transaction);
      if (!(await this.repository.softDelete(id, transaction)))
        throw goalNotFound();
    });
  }

  private async listScope(actor: AuthenticatedUser): Promise<GoalListScope> {
    if (actor.role === USER.FIGHTER) {
      const fighterId = await this.repository.findActiveFighterIdByUserId(
        actor.id,
      );
      return { fighterIds: fighterId ? [fighterId] : [] };
    }
    if (actor.role === USER.COACH) {
      const activeCoachId = await this.repository.findActiveCoachIdByUserId(
        actor.id,
      );
      return activeCoachId ? { activeCoachId } : { fighterIds: [] };
    }
    if (actor.role === USER.ADMIN) return {};
    throw forbidden();
  }

  private async assertRead(actor: AuthenticatedUser, fighterId: string) {
    if (actor.role === USER.ADMIN) return;
    if (
      actor.role === USER.FIGHTER &&
      (await this.repository.findActiveFighterIdByUserId(actor.id)) ===
        fighterId
    )
      return;
    if (
      actor.role === USER.COACH &&
      (await this.repository.isCoachAssignedToFighter(actor.id, fighterId))
    )
      return;
    throw forbidden();
  }

  private async assertWrite(
    actor: AuthenticatedUser,
    fighterId: string,
    database: DatabaseExecutor,
  ) {
    if (
      actor.role !== USER.COACH ||
      !(await this.repository.isCoachAssignedToFighter(
        actor.id,
        fighterId,
        database,
      ))
    )
      throw forbidden();
  }

  private assertRange(
    goal: Pick<
      GoalRecord,
      'baseline' | 'target' | 'lowerIsBetter' | 'startDate' | 'dueDate'
    >,
  ) {
    if (
      goal.dueDate <= goal.startDate ||
      goal.target === goal.baseline ||
      (goal.lowerIsBetter && goal.target > goal.baseline) ||
      (!goal.lowerIsBetter && goal.target < goal.baseline)
    )
      throw invalidGoalRange();
  }

  private async publicGoal(
    goal: GoalRecord,
    database?: DatabaseExecutor,
  ): Promise<GoalResponse> {
    return toPublicGoal(
      goal,
      await this.repository.findHistory(goal.id, database),
    );
  }
}
