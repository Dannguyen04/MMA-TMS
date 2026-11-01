import type { CampDetail, CampRound, CornerCard, NextRoundPlan, RoundInput, RoundInstruction, RoundsResponse } from "@/api/fight-camp";
import { betweenRound as t } from "@/i18n/between-round";
import { CampInputError } from "./camp-input-error";

export const emptyPlan = (): NextRoundPlan => ({ focusTacticIds: [], addedTactics: [], instructions: [] });
export const copyPlan = (p: NextRoundPlan): NextRoundPlan => ({ focusTacticIds: [...p.focusTacticIds], addedTactics: p.addedTactics.map(a => ({ ...a, observationIds: [...a.observationIds] })), instructions: p.instructions.map(i => ({ ...i })) });
export const instructionKey = (i: RoundInstruction) => `${i.code}:${i.tacticId ?? ""}:${i.text ?? ""}`;
export const hasPlan = (p: NextRoundPlan) => !!(p.focusTacticIds.length + p.addedTactics.length + p.instructions.length);

export function currentRound(data: RoundsResponse | null, total: number) {
  return Math.min(total, Math.max(1, data?.advice?.nextRound?.roundNo ?? (data?.rounds.length ? Math.max(...data.rounds.map(r => r.roundNo)) + 1 : 1)));
}
export type PlanTactic = CornerCard["tactics"][number] & { focus?: boolean; addedRound?: number | null; dropped?: boolean };
/** Only tactics introduced before the round may be marked in that round. Server ranking is retained. */
export function entryTactics(bout: CampDetail, data: RoundsResponse | null, round: number): PlanTactic[] {
  const added = (data?.rounds ?? []).filter(r => r.roundNo < round).flatMap(r => (r.nextRoundPlan?.addedTactics ?? []).map(a => ({ ...a, round: null, partnerBrief: null, trained: false, basis: "ONCE" as const, addedRound: r.roundNo })));
  const initial = (bout.opponentAnalysis.tactics ?? []).map(a => ({ ...a, trained: a.sessionIds.length > 0, basis: "ONCE" as const, partnerBrief: a.partnerBrief ?? null, addedRound: null }));
  const byId = new Map<string, PlanTactic>([...initial, ...added].map(a => [a.id, a]));
  const ranked = data?.advice?.tactics ?? [];
  const ordered = ranked.filter(a => byId.has(a.id)).map(a => { byId.delete(a.id); return a; });
  return [...ordered, ...byId.values()];
}
export function initialPlan(data: RoundsResponse | null, round: number): NextRoundPlan {
  const saved = data?.rounds.find(r => r.roundNo === round)?.nextRoundPlan;
  if (saved) return copyPlan(saved);
  return { ...emptyPlan(), instructions: (data?.advice?.nextRound?.suggested ?? []).filter(i => i.code === "SAFETY_CHECK").map(i => ({ ...i })) };
}
export function compactTactics(tactics: readonly PlanTactic[], data: RoundsResponse | null, round: number) {
  const previous = [...(data?.rounds ?? [])].filter(r => r.roundNo < round).sort((a, b) => b.roundNo - a.roundNo)[0];
  const focus = previous?.nextRoundPlan?.focusTacticIds ?? [];
  const focused = focus.flatMap(id => { const found = tactics.find(a => a.id === id); return found ? [found] : []; });
  return [...focused, ...tactics.filter(a => !focused.some(b => b.id === a.id))].slice(0, 2);
}
export function nextTacticId(bout: CampDetail, data: RoundsResponse | null, round: number, plan: NextRoundPlan) {
  const ids = new Set([...(bout.opponentAnalysis.tactics ?? []), ...(bout.opponentAnalysis.observations ?? []), ...(data?.rounds ?? []).flatMap(r => r.nextRoundPlan?.addedTactics ?? []), ...plan.addedTactics].map(a => a.id));
  let n = 1; while (ids.has(`r${round}-a${n}`)) n++;
  return `r${round}-a${n}`;
}
export function validatePlan(plan: NextRoundPlan, bout: CampDetail, rounds: readonly CampRound[], round: number): NextRoundPlan {
  if (plan.focusTacticIds.length > 2 || plan.addedTactics.length > 2 || plan.instructions.length > 3) throw new CampInputError(t.limitError);
  if (round === bout.scheduledRounds && hasPlan(plan)) throw new CampInputError(t.finalError);
  const normalized = copyPlan(plan);
  const observations = new Set((bout.opponentAnalysis.observations ?? []).map(o => o.id));
  const tactics = new Set([...(bout.opponentAnalysis.tactics ?? []).map(a => a.id), ...rounds.filter(r => r.roundNo < round).flatMap(r => (r.nextRoundPlan?.addedTactics ?? []).map(a => a.id))]);
  const ids = new Set([...tactics, ...observations, ...rounds.filter(r => r.roundNo !== round).flatMap(r => (r.nextRoundPlan?.addedTactics ?? []).map(a => a.id))]);
  for (const a of normalized.addedTactics) {
    a.text = a.text.trim();
    if (!a.text || a.text.length > 140) throw new CampInputError(t.textError);
    if (!/^[a-z0-9_-]{1,20}$/.test(a.id) || ids.has(a.id) || a.observationIds.length > 3 || a.observationIds.some(id => !observations.has(id)) || new Set(a.observationIds).size !== a.observationIds.length) throw new CampInputError(t.unknown);
    ids.add(a.id); tactics.add(a.id);
  }
  if (new Set(normalized.focusTacticIds).size !== normalized.focusTacticIds.length || normalized.focusTacticIds.some(id => !tactics.has(id))) throw new CampInputError(t.unknown);
  const codes = new Set(["SAFETY_CHECK", "STOP_TACTIC", "USE_TACTIC", "RECHECK_OPPONENT", "MUST_WIN_ROUND", "HARD_TO_WIN_ON_POINTS", "CUSTOM"]);
  for (const i of normalized.instructions) {
    if (!codes.has(i.code)) throw new CampInputError(t.invalid);
    if (i.text != null) { i.text = i.text.trim(); if (!i.text || i.text.length > 140) throw new CampInputError(t.textError); }
    if (i.code === "CUSTOM" && !i.text) throw new CampInputError(t.textError);
    if (["USE_TACTIC", "STOP_TACTIC", "RECHECK_OPPONENT"].includes(i.code) && !i.tacticId) throw new CampInputError(t.unknown);
    if (i.tacticId && !tactics.has(i.tacticId)) throw new CampInputError(t.unknown);
  }
  if (new Set(normalized.instructions.map(instructionKey)).size !== normalized.instructions.length) throw new CampInputError(t.invalid);
  const removed = (rounds.find(r => r.roundNo === round)?.nextRoundPlan?.addedTactics ?? []).filter(a => !normalized.addedTactics.some(b => b.id === a.id));
  if (removed.some(a => rounds.some(r => r.roundNo > round && (a.id in (r.tacticMarks ?? {}) || r.nextRoundPlan?.focusTacticIds.includes(a.id) || r.nextRoundPlan?.instructions.some(i => i.tacticId === a.id))))) throw new CampInputError(t.usedLater);
  return normalized;
}
export function validateRoundMarks(body: RoundInput, bout: CampDetail, data: RoundsResponse, round: number) {
  const ids = new Set(entryTactics(bout, data, round).map(a => a.id));
  const observations = new Set((bout.opponentAnalysis.observations ?? []).map(a => a.id));
  if (Object.keys(body.tacticMarks ?? {}).some(id => !ids.has(id)) || Object.keys(body.observationMarks ?? {}).some(id => !observations.has(id))) throw new CampInputError(t.unknown);
}

/** corner-card alone omits T-037 metadata; rounds supplies it, including at full time when advice is null. */
export function cornerPlanTactics(card: CornerCard, data: RoundsResponse): PlanTactic[] {
  if (data.advice) return data.advice.tactics;
  const rounds = [...data.rounds].sort((a, b) => a.roundNo - b.roundNo);
  const focus = rounds.at(-1)?.nextRoundPlan?.focusTacticIds ?? [];
  const added = rounds.flatMap(r => (r.nextRoundPlan?.addedTactics ?? []).map(a => ({ ...a, round: null, partnerBrief: null, trained: false, basis: "ONCE" as const, addedRound: r.roundNo })));
  return [...card.tactics.map(a => ({ ...a, addedRound: null })), ...added].map(a => ({ ...a, focus: focus.includes(a.id) }))
    .sort((a, b) => (focus.includes(a.id) ? focus.indexOf(a.id) : focus.length) - (focus.includes(b.id) ? focus.indexOf(b.id) : focus.length));
}
