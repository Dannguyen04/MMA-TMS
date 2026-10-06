import {
  TRAINING_PLAN_PHASES,
  type CreateTrainingPlanBody,
  type TrainingPlanPhase,
} from "@/api/types";

const LABELS: Record<TrainingPlanPhase, string> = {
  base: "Nền tảng",
  build: "Xây dựng",
  fight_camp: "Chuẩn bị thi đấu",
  taper: "Giảm tải",
  rehab: "Phục hồi",
  maintenance: "Duy trì",
};

export function isTrainingPlanPhase(value: string): value is TrainingPlanPhase {
  return (TRAINING_PLAN_PHASES as readonly string[]).includes(value);
}

/** Vietnamese label plus the lowercase enum the API stores. */
export function planPhaseLabel(phase: string | null | undefined): string {
  if (!phase || !isTrainingPlanPhase(phase)) return phase ?? "";
  return `${LABELS[phase]} (${phase})`;
}

export function planPhaseOptions(): { value: TrainingPlanPhase; label: string }[] {
  return TRAINING_PLAN_PHASES.map((value) => ({ value, label: planPhaseLabel(value) }));
}

export function buildCreateTrainingPlanBody(input: {
  fighterId: string;
  coachId: string;
  title: string;
  startDate: string;
  phase: string;
  endDate?: string;
  description?: string;
  goals?: string;
}): { ok: true; body: CreateTrainingPlanBody } | { ok: false; reason: "phase" | "required" } {
  if (!input.fighterId || !input.coachId || !input.title.trim() || !input.startDate) {
    return { ok: false, reason: "required" };
  }
  if (!isTrainingPlanPhase(input.phase)) {
    return { ok: false, reason: "phase" };
  }
  const body: CreateTrainingPlanBody = {
    fighterId: input.fighterId,
    coachId: input.coachId,
    title: input.title.trim(),
    startDate: input.startDate,
    phase: input.phase,
  };
  if (input.endDate?.trim()) body.endDate = input.endDate.trim();
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.goals?.trim()) body.goals = input.goals.trim();
  return { ok: true, body };
}
