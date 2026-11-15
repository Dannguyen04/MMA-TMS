import type { OpponentObservation, RoundAdvice, RoundRecord, SelfScore } from "./round-advice";

/**
 * T-037 B, between-round recording mode: which round the corner is recording, and which four taps the open round
 * shows by default (business flow 9): two tactics being coached, one main observation and the coach's self-score.
 */

type TacticLike = { id: string };
type ObservationLike = Pick<OpponentObservation, "id">;
type RoundLike = Pick<RoundRecord, "roundNo"> & { nextRoundPlan?: { focusTacticIds?: string[] } | null };

export const QUICK_TACTIC_COUNT = 2;

/**
 * The round being recorded: `advice.nextRound.roundNo`, or round 1 while nothing is recorded (the API sends no advice
 * then). Null once every scheduled round is recorded.
 */
export function openRoundNo(advice: Pick<RoundAdvice, "nextRound"> | null, scheduledRounds: number): number | null {
    const roundNo = advice?.nextRound.roundNo ?? 1;
    return roundNo >= 1 && roundNo <= scheduledRounds ? roundNo : null;
}

/**
 * The two tactics shown by default when recording `roundNo`: the focus the coach set at the previous break; without one,
 * the first two of the re-ranked advice; without advice, the first two of the pre-bout analysis. Only tactics that can
 * be marked in this round count.
 */
export function quickTacticIds(
    roundNo: number,
    rounds: readonly RoundLike[],
    advice: { tactics: readonly TacticLike[] } | null,
    available: readonly TacticLike[],
): string[] {
    const markable = new Set(available.map((t) => t.id));
    const focus = (rounds.find((r) => r.roundNo === roundNo - 1)?.nextRoundPlan?.focusTacticIds ?? []).filter((id) => markable.has(id));
    if (focus.length > 0) return focus.slice(0, QUICK_TACTIC_COUNT);
    const fromAdvice = (advice?.tactics ?? []).map((t) => t.id).filter((id) => markable.has(id));
    if (fromAdvice.length > 0) return fromAdvice.slice(0, QUICK_TACTIC_COUNT);
    return available.slice(0, QUICK_TACTIC_COUNT).map((t) => t.id);
}

/**
 * The one observation shown by default: the first (in analysis order) that a quick tactic rests on, else the first
 * observation. Null when the analysis has none.
 */
export function mainObservationId(
    observations: readonly ObservationLike[],
    quickTactics: readonly { observationIds?: readonly string[] }[],
): string | null {
    const basis = new Set(quickTactics.flatMap((t) => t.observationIds ?? []));
    return (observations.find((o) => basis.has(o.id)) ?? observations[0])?.id ?? null;
}

/** Whether a saved round holds anything outside the four default taps, so "Record more" opens on edit. */
export function hasExtraEntries(
    record: Pick<RoundRecord, "knockdownsAgainst" | "stunned" | "bleeding" | "fatigued" | "note" | "tacticMarks" | "observationMarks"> | null,
    quickTactics: readonly string[],
    mainObservation: string | null,
): boolean {
    if (!record) return false;
    return (
        record.knockdownsAgainst > 0 ||
        record.stunned ||
        record.bleeding ||
        record.fatigued ||
        Boolean(record.note?.trim()) ||
        Object.keys(record.tacticMarks).some((id) => !quickTactics.includes(id)) ||
        Object.keys(record.observationMarks).some((id) => id !== mainObservation)
    );
}

export type RoundCondition = "stunned" | "bleeding" | "fatigued";

export interface RoundSummary {
    selfScore: SelfScore | null;
    knockdowns: number;
    conditions: RoundCondition[];
    marks: number;
}

/** The one-line summary of a recorded round: self-score, knockdowns, condition and how many marks were made. */
export function summarizeRound(
    record: Pick<RoundRecord, "selfScore" | "knockdownsAgainst" | "stunned" | "bleeding" | "fatigued" | "tacticMarks" | "observationMarks">,
): RoundSummary {
    const conditions = (["stunned", "bleeding", "fatigued"] as const).filter((flag) => record[flag]);
    return {
        selfScore: record.selfScore,
        knockdowns: record.knockdownsAgainst,
        conditions,
        marks: Object.keys(record.tacticMarks).length + Object.keys(record.observationMarks).length,
    };
}
