import {
    buildRoundAdvice,
    type AnalysisRound,
    type OpponentAnalysis,
    type RoundAdviceSafety,
    type RoundAdviceStanding,
    type RoundRecord,
    type SelfScore,
    type TacticOutcome,
} from "@/lib/domain/round-advice";

/**
 * What the round replay plays back, built on the server from the rounds the coach recorded and the
 * opponent analysis. Nothing here is invented: each break's advice is `buildRoundAdvice` run on the
 * rounds recorded up to that break, the same rules the rounds page applies live.
 */

export interface ReplayTactic {
    id: string;
    text: string;
}

export interface ReplayRound {
    roundNo: number;
    marks: Record<string, TacticOutcome>;
    selfScore: SelfScore | null;
    knockdownsAgainst: number;
    stunned: boolean;
    bleeding: boolean;
    fatigued: boolean;
    note: string | null;
}

/** The corner break after a round: the advice as it stood then. */
export interface ReplayBreak {
    afterRound: number;
    /** Tactics to lead with next round, best score first (at most three). */
    keep: string[];
    /** Tactics dropped at this break (two ineffective rounds in a row). */
    dropped: string[];
    /** Tactics whose basis the coach stopped seeing for two rounds. */
    opponentChanged: string[];
    standing: RoundAdviceStanding;
    safety: RoundAdviceSafety;
}

export interface ReplayData {
    scheduledRounds: number;
    tactics: ReplayTactic[];
    rounds: ReplayRound[];
    breaks: ReplayBreak[];
    /** Round after which each dropped tactic left the plan. */
    droppedAfter: Record<string, number>;
}

const KEEP_LINES = 3;

/** Null when there is nothing to play: no recorded round or no scheduled length. */
export function buildReplay(analysis: OpponentAnalysis, records: readonly RoundRecord[], scheduledRounds: number | null): ReplayData | null {
    if (!scheduledRounds || records.length === 0) return null;
    const rounds = [...records].sort((a, b) => a.roundNo - b.roundNo).filter((r) => r.roundNo <= scheduledRounds);
    if (rounds.length === 0) return null;
    const tactics = (analysis.tactics ?? []).map((t) => ({ id: t.id, text: t.text }));
    const textOf = new Map(tactics.map((t) => [t.id, t.text]));
    const asInput = (r: RoundRecord): AnalysisRound => ({
        roundNo: r.roundNo,
        tacticMarks: r.tacticMarks,
        observationMarks: r.observationMarks,
        selfScore: r.selfScore,
        knockdownsAgainst: r.knockdownsAgainst,
        stunned: r.stunned,
        bleeding: r.bleeding,
        fatigued: r.fatigued,
        note: r.note,
    });

    const breaks: ReplayBreak[] = [];
    const droppedAfter: Record<string, number> = {};
    let droppedBefore = new Set<string>();
    for (const round of rounds) {
        // No corner break after the final scheduled round.
        if (round.roundNo >= scheduledRounds) break;
        const advice = buildRoundAdvice(analysis, rounds.filter((r) => r.roundNo <= round.roundNo).map(asInput), scheduledRounds);
        const droppedNow = advice.tactics.filter((t) => t.dropped && !droppedBefore.has(t.id));
        for (const t of droppedNow) droppedAfter[t.id] = round.roundNo;
        droppedBefore = new Set(advice.tactics.filter((t) => t.dropped).map((t) => t.id));
        breaks.push({
            afterRound: round.roundNo,
            keep: advice.tactics
                .filter((t) => !t.dropped && t.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, KEEP_LINES)
                .map((t) => textOf.get(t.id) ?? t.text),
            dropped: droppedNow.map((t) => textOf.get(t.id) ?? t.text),
            opponentChanged: advice.tactics.filter((t) => t.note === "OPPONENT_MAY_HAVE_CHANGED").map((t) => textOf.get(t.id) ?? t.text),
            standing: advice.standing,
            safety: advice.safety,
        });
    }

    return {
        scheduledRounds,
        tactics,
        rounds: rounds.map((r) => ({
            roundNo: r.roundNo,
            marks: r.tacticMarks,
            selfScore: r.selfScore,
            knockdownsAgainst: r.knockdownsAgainst,
            stunned: r.stunned,
            bleeding: r.bleeding,
            fatigued: r.fatigued,
            note: r.note,
        })),
        breaks,
        droppedAfter,
    };
}

