import type { Stance } from "./types";
import { buildCornerCard, type CornerTactic, type OpponentAnalysis, type OpponentProfile } from "./round-advice";

// Proposed thresholds, pending specialist approval (T-033 P1–P6, C1–C4).
export const MIN_TACTICS = 3;
export const REACH_GAP_CM = 5;
export const HEIGHT_GAP_CM = 5;

export type PlanFinding =
    | { code: "OPENING_UNUSED"; level: "warning"; observationId: string; text: string }
    | { code: "STRENGTH_UNANSWERED"; level: "warning"; observationId: string; text: string }
    | { code: "WEAK_BASIS"; level: "info"; tacticId: string; text: string }
    | { code: "UNTRAINED"; level: "warning"; tacticId: string; text: string }
    | { code: "ROUND_GAP"; level: "info"; round: number }
    | { code: "TOO_FEW_TACTICS"; level: "info"; count: number };

export interface TacticInsight extends CornerTactic {
    /** 1-based position the tactic will take on the corner card. */
    cardOrder: number;
}

/** Labels the corner card will show, computed from the unsaved draft (same rules as buildCornerCard). */
export function tacticInsights(analysis: OpponentAnalysis): Map<string, TacticInsight> {
    const card = buildCornerCard(analysis);
    return new Map(card.tactics.map((t, index) => [t.id, { ...t, cardOrder: index + 1 }]));
}

/** What the plan still lacks: unused openings, unanswered strengths, weak basis, untrained tactics, uncovered rounds. */
export function planFindings(analysis: OpponentAnalysis, scheduledRounds: number | null): PlanFinding[] {
    const observations = analysis.observations ?? [];
    const tactics = analysis.tactics ?? [];
    const used = new Set(tactics.flatMap((t) => t.observationIds));
    const insights = tacticInsights(analysis);
    const findings: PlanFinding[] = [];

    for (const o of observations) {
        if (used.has(o.id)) continue;
        if (o.kind === "OPENING") findings.push({ code: "OPENING_UNUSED", level: "warning", observationId: o.id, text: o.text });
        if (o.kind === "STRENGTH") findings.push({ code: "STRENGTH_UNANSWERED", level: "warning", observationId: o.id, text: o.text });
    }
    for (const t of tactics) {
        if (t.observationIds.length > 0 && insights.get(t.id)?.basis === "ONCE") {
            findings.push({ code: "WEAK_BASIS", level: "info", tacticId: t.id, text: t.text });
        }
        if (t.sessionIds.length === 0) findings.push({ code: "UNTRAINED", level: "warning", tacticId: t.id, text: t.text });
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

export type MatchupNote =
    | { code: "OPPOSITE_STANCE"; opponentStance: "SOUTHPAW" | "ORTHODOX" }
    | { code: "SWITCH_STANCE" }
    | { code: "REACH_GAP"; diffCm: number }
    | { code: "HEIGHT_GAP"; diffCm: number }
    | { code: "EXPERIENCE"; opponentBouts: number; fighterBouts: number };

export interface FighterSide {
    stance: Stance | null;
    heightCm: number | null;
    reachCm: number | null;
    record: { wins: number; losses: number; draws: number } | null;
}

/** Compares the opponent profile with our fighter. Positive diffs mean the opponent is bigger. */
export function matchupNotes(profile: OpponentProfile | undefined, fighter: FighterSide): MatchupNote[] {
    if (!profile) return [];
    const notes: MatchupNote[] = [];
    if (profile.stance === "SWITCH") notes.push({ code: "SWITCH_STANCE" });
    else if (
        (profile.stance === "SOUTHPAW" && fighter.stance === "orthodox") ||
        (profile.stance === "ORTHODOX" && fighter.stance === "southpaw")
    ) {
        notes.push({ code: "OPPOSITE_STANCE", opponentStance: profile.stance });
    }
    if (profile.reachCm !== undefined && fighter.reachCm !== null) {
        const diffCm = Math.round(profile.reachCm - fighter.reachCm);
        if (Math.abs(diffCm) >= REACH_GAP_CM) notes.push({ code: "REACH_GAP", diffCm });
    }
    if (profile.heightCm !== undefined && fighter.heightCm !== null) {
        const diffCm = Math.round(profile.heightCm - fighter.heightCm);
        if (Math.abs(diffCm) >= HEIGHT_GAP_CM) notes.push({ code: "HEIGHT_GAP", diffCm });
    }
    const opponentBouts = (profile.wins ?? 0) + (profile.losses ?? 0) + (profile.draws ?? 0);
    if (opponentBouts > 0 && fighter.record) {
        const fighterBouts = fighter.record.wins + fighter.record.losses + fighter.record.draws;
        notes.push({ code: "EXPERIENCE", opponentBouts, fighterBouts });
    }
    return notes;
}
