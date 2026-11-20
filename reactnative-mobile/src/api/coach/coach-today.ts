import { apiFetch } from "@/api/core/client";
import type { CampStatus } from "@/features/fight-camp/api";

/**
 * Coach "Hôm nay" sources. Verified against nestjs-api, 11 November 2026:
 * - GET /coach/todo: bouts-todo.controller.ts, bouts-todo.model.ts (todoItemSchema, coachTodoResponseSchema).
 * - GET /readiness: bouts.controller.ts:114, bouts.model.ts readinessRowSchema (no query needed for the board).
 * Both need bout:get_all (COACH sees assigned fighters, ADMIN the whole club).
 */
export const TODO_PHASES = ["BEFORE", "DURING", "AFTER"] as const;
export type TodoPhase = (typeof TODO_PHASES)[number];
export type TodoSource =
  | "REQUIREMENTS_DUE" | "REQUIREMENTS_OVERDUE" | "WEIGHT_OVER_LIMIT" | "WEIGHT_ABOVE_TARGET" | "WEIGHT_NOT_WEIGHED"
  | "TACTICS_WITHOUT_SESSIONS" | "CAN_ENTER_FIGHT_WEEK" | "WEIGH_IN_TODAY" | "RESULT_OVERDUE" | "WEIGHT_NOT_LOGGED"
  | "SUSPENSION_AWAITING_CLEARANCE" | "TRAINING_CONFLICTS_WITH_SUSPENSION";
export type TodoItem = {
  source: TodoSource; phase: TodoPhase; fighterId: string; boutId: string; eventName: string;
  /** Date-only (YYYY-MM-DD) the item is about, when it has one. */
  dueOn: string | null;
  count: number | null;
};
export type CoachTodo = { items: TodoItem[]; truncated: boolean };

export type ReadinessStatus = "SUSPENDED" | "AWAITING_CLEARANCE" | "IN_BOUT" | "READY";
export type ReadinessRow = {
  fighterId: string; fighterName: string; ready: boolean; status: ReadinessStatus;
  latestWeightKg: number | null; latestWeightOn: string | null;
  activeBout: { id: string; eventName: string; status: CampStatus; boutAt: string } | null;
  suspension: { startsOn: string; endsOn: string; expectedResumeOn: string | null } | null;
  fullReturnOn: string | null;
  gradedReturn: { ceiling: number; fullReturnOn: string } | null;
};

export const coachTodayApi = {
  todo: () => apiFetch<CoachTodo>("/coach/todo"),
  readiness: () => apiFetch<ReadinessRow[]>("/readiness"),
};
