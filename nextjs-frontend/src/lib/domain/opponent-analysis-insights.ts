import type { Stance } from "./types";
import { buildCornerCard, type CornerTactic, type OpponentAnalysis, type OpponentProfile } from "./round-advice";

// Proposed thresholds, pending specialist approval (T-033 P1–P7, C1–C3).
export const MIN_TACTICS = 3;
export const REACH_GAP_CM = 5;
export const HEIGHT_GAP_CM = 5;

/** NONE: no session linked; SCHEDULED: linked sessions, none completed yet; PRACTISED: at least one completed. */
export type PracticeState = "NONE" | "SCHEDULED" | "PRACTISED";

export type PlanFinding =
    | { code: "OPENING_UNUSED"; level: "warning"; observationId: string; text: string }
    | { code: "STRENGTH_UNANSWERED"; level: "warning"; observationId: string; text: string }
    | { code: "WEAK_BASIS"; level: "info"; tacticId: string; text: string }
    | { code: "UNTRAINED"; level: "warning"; tacticId: string; text: string }
    | { code: "NOT_YET_PRACTISED"; level: "info"; tacticId: string; text: string }
    | { code: "ROUND_GAP"; level: "info"; round: number }
    | { code: "TOO_FEW_TACTICS"; level: "info"; count: number };

export interface TacticInsight extends CornerTactic {
    /** 1-based position the tactic will take on the corner card. */
    cardOrder: number;
    practice: PracticeState;
}

function practiceState(sessionIds: readonly string[], completedSessionIds: ReadonlySet<string>): PracticeState {
    if (sessionIds.length === 0) return "NONE";
    return sessionIds.some((id) => completedSessionIds.has(id)) ? "PRACTISED" : "SCHEDULED";
}

/**
 * Labels computed from the unsaved draft. Order and basis follow buildCornerCard; practice
 * counts only completed sessions, stricter than the card's "trained" (any linked session).
 */
export function tacticInsights(
    analysis: OpponentAnalysis,
    completedSessionIds: ReadonlySet<string> = new Set(),
): Map<string, TacticInsight> {
    const card = buildCornerCard(analysis);
    const sessionsOf = new Map((analysis.tactics ?? []).map((t) => [t.id, t.sessionIds]));
    return new Map(
        card.tactics.map((t, index) => [
            t.id,
            { ...t, cardOrder: index + 1, practice: practiceState(sessionsOf.get(t.id) ?? [], completedSessionIds) },
        ]),
    );
}

/** What the plan still lacks: unused openings, unanswered strengths, weak basis, unpractised tactics, uncovered rounds. */
export function planFindings(
    analysis: OpponentAnalysis,
    scheduledRounds: number | null,
    completedSessionIds: ReadonlySet<string> = new Set(),
): PlanFinding[] {
    const observations = analysis.observations ?? [];
    const tactics = analysis.tactics ?? [];
    const used = new Set(tactics.flatMap((t) => t.observationIds));
    const insights = tacticInsights(analysis, completedSessionIds);
    const findings: PlanFinding[] = [];

    for (const o of observations) {
        if (used.has(o.id)) continue;
        if (o.kind === "OPENING") findings.push({ code: "OPENING_UNUSED", level: "warning", observationId: o.id, text: o.text });
        if (o.kind === "STRENGTH") findings.push({ code: "STRENGTH_UNANSWERED", level: "warning", observationId: o.id, text: o.text });
    }
    for (const t of tactics) {
        const insight = insights.get(t.id);
        if (t.observationIds.length > 0 && insight?.basis === "ONCE") {
            findings.push({ code: "WEAK_BASIS", level: "info", tacticId: t.id, text: t.text });
        }
        if (insight?.practice === "NONE") findings.push({ code: "UNTRAINED", level: "warning", tacticId: t.id, text: t.text });
        if (insight?.practice === "SCHEDULED") findings.push({ code: "NOT_YET_PRACTISED", level: "info", tacticId: t.id, text: t.text });
    }
    if (scheduledRounds !== null && tactics.length > 0 && tactics.every((t) => t.round !== null)) {
        const covered = new Set(tactics.map((t) => t.round));
        for (let round = 1; round <= scheduledRounds; round++) {
            if (!covered.has(round)) findings.push({ code: "ROUND_GAP", level: "info", round });
        }
    }
    if (tactics.length < MIN_TACTICS) findings.push({ code: "TOO_FEW_TACTICS", level: "info", count: tactics.length });
    return findings;
}

export interface FighterSide {
    stance: Stance | null;
    heightCm: number | null;
    reachCm: number | null;
}

export type MatchupRow =
    | { field: "stance"; opponent: NonNullable<OpponentProfile["stance"]>; fighter: Stance; notable: boolean }
    | { field: "heightCm" | "reachCm"; opponent: number; fighter: number; diffCm: number; notable: boolean };

const FIGHTER_STANCE = { orthodox: "ORTHODOX", southpaw: "SOUTHPAW", switch: "SWITCH" } as const;

/** Side-by-side figures where both values are known; `notable` marks a stance mismatch or a gap at the threshold. */
export function matchupRows(profile: OpponentProfile | undefined, fighter: FighterSide): MatchupRow[] {
    if (!profile) return [];
    const rows: MatchupRow[] = [];
    if (profile.stance && fighter.stance) {
        rows.push({
            field: "stance",
            opponent: profile.stance,
            fighter: fighter.stance,
            notable: profile.stance === "SWITCH" || profile.stance !== FIGHTER_STANCE[fighter.stance],
        });
    }
    for (const [field, gap] of [["heightCm", HEIGHT_GAP_CM], ["reachCm", REACH_GAP_CM]] as const) {
        const opponent = profile[field];
        const ours = fighter[field];
        if (opponent === undefined || ours === null) continue;
        const diffCm = Math.round(opponent - ours);
        rows.push({ field, opponent, fighter: ours, diffCm, notable: Math.abs(diffCm) >= gap });
    }
    return rows;
}
