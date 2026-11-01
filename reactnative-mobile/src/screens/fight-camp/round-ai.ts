import { isApiError } from "@/api/errors";
import type { AiDecision, AiSuggestion, CampDetail, NextRoundPlan, RoundsResponse } from "@/api/fight-camp";
import { aiStatusBadge, backendErrorText } from "@/i18n/backend-codes";
import { roundAi } from "@/i18n/round-ai";

/** T-038B: the coach waits at most 12 s (same as Nest BOUT_AI_TIMEOUTS.BETWEEN_ROUNDS). */
export const AI_TIMEOUT_MS = 12_000;
/** nextRoundPlan instruction text limit (bout-analysis.model.ts instructionSchema). */
export const AI_TEXT_MAX = 140;
export const AI_LINE_MAX = 3;
export type AiLine = { id: string; text: string };

/**
 * Round n+1 that may ask AI from tab n, or null. Mirrors the server gate in generateAiSuggestion:
 * roundNo ≥ 2, roundNo = last saved round + 1, roundNo ≤ scheduledRounds, bout WEIGHED_IN or COMPLETED.
 */
export function aiTargetRound(bout: Pick<CampDetail, "status">, data: RoundsResponse | null, round: number, total: number | null | undefined): number | null {
  if (!data || total == null || round < 1 || round >= total) return null;
  if (bout.status !== "WEIGHED_IN" && bout.status !== "COMPLETED") return null;
  const last = Math.max(0, ...data.rounds.map(r => r.roundNo));
  return last === round ? round + 1 : null;
}

/** Displayable AI lines: ≤3, trimmed, 1–140 characters, with the server's stable item id. */
export function aiLines(suggestion: AiSuggestion | null | undefined): { lines: AiLine[]; hidden: number } {
  const list = suggestion?.status === "OK" ? suggestion.output?.instructions : null;
  if (!Array.isArray(list)) return { lines: [], hidden: 0 };
  const lines: AiLine[] = []; let hidden = 0;
  for (const item of list.slice(0, AI_LINE_MAX) as { id?: unknown; text?: unknown }[]) {
    const text = typeof item?.text === "string" ? item.text.trim() : "";
    if (typeof item?.id !== "string" || !text) continue;
    // Longer text would make PUT /rounds/n fail with 422, so it is never offered (T-049 B).
    if (text.length > AI_TEXT_MAX) { hidden++; continue; }
    if (!lines.some(l => l.text === text)) lines.push({ id: item.id, text });
  }
  return { lines, hidden };
}

export const isAiPicked = (plan: NextRoundPlan | undefined, line: AiLine) =>
  !!plan?.instructions.some(i => i.code === "CUSTOM" && i.text?.trim() === line.text);

/** 6A: every shown line picked → ACCEPTED, some → PARTIAL, none → REJECTED. No lines → nothing to decide. */
export function aiDecision(lines: readonly AiLine[], plan: NextRoundPlan | undefined): AiDecision | null {
  if (!lines.length) return null;
  const acceptedItemIds = lines.filter(l => isAiPicked(plan, l)).map(l => l.id);
  return { decision: acceptedItemIds.length === lines.length ? "ACCEPTED" : acceptedItemIds.length ? "PARTIAL" : "REJECTED", acceptedItemIds };
}

/** One Vietnamese line for a suggestion that cannot be shown, or null when there are lines to pick. */
export function aiProblem(suggestion: AiSuggestion): string | null {
  if (suggestion.status !== "OK") return (suggestion.errorCode && aiStatusBadge[suggestion.errorCode]) || aiStatusBadge.TIMEOUT;
  return aiLines(suggestion).lines.length ? null : aiStatusBadge.EMPTY;
}
/** Request errors (HTTP, network, local timeout) → Vietnamese; never the server or JS message. */
export function aiRequestError(error: unknown, timedOut: boolean): string {
  if (timedOut) return aiStatusBadge.TIMEOUT;
  return backendErrorText(isApiError(error) ? error : null);
}
export const isAlreadyDecided = (error: unknown) => isApiError(error) && error.status === 409 && error.code === "BOUT_AI_ALREADY_DECIDED";

/** Demo mode: fake sample suggestion labelled "Gợi ý mẫu (demo)". Never calls the server. */
export function sampleRoundAdvice(roundNo: number): AiSuggestion {
  return {
    id: `sample-ai-${roundNo}`, kind: "BETWEEN_ROUNDS", roundNo, status: "OK", errorCode: null, model: "sample", cached: false,
    createdAt: new Date(0).toISOString(), output: { instructions: roundAi.sampleLines.map((text, i) => ({ id: `ai${i + 1}`, text })) },
  };
}
