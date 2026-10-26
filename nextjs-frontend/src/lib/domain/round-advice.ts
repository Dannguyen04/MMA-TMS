import { z } from "zod";

// Proposed thresholds, pending specialist approval (R21/R22/R24).
export const INEFFECTIVE_STREAK_TO_DROP = 2;
export const NOT_SEEN_STREAK_TO_DEMOTE = 2;
export const KNOCKDOWN_WARN_TOTAL = 2;
export const STUNNED_STREAK_WARN = 2;

export const analysisIdSchema = z.string().regex(/^[a-z0-9_-]{1,20}$/);
export const tacticOutcomeSchema = z.enum(["EFFECTIVE", "INEFFECTIVE", "NOT_USED"]);
export type TacticOutcome = z.infer<typeof tacticOutcomeSchema>;

export const observationMarkSchema = z.enum(["SEEN", "NOT_SEEN"]);
export type ObservationMark = z.infer<typeof observationMarkSchema>;

export const selfScoreSchema = z.enum(["WIN", "LOSS", "CLOSE"]);
export type SelfScore = z.infer<typeof selfScoreSchema>;

export const opponentProfileSchema = z.object({
    wins: z.number().int().nonnegative().optional(),
    losses: z.number().int().nonnegative().optional(),
    draws: z.number().int().nonnegative().optional(),
    stance: z.enum(["ORTHODOX", "SOUTHPAW", "SWITCH"]).optional(),
    style: z.enum(["STRIKER", "WRESTLER", "GRAPPLER", "ALL_ROUND"]).optional(),
    heightCm: z.number().positive().optional(),
    reachCm: z.number().positive().optional(),
    source: z.string().optional(),
});
export type OpponentProfile = z.infer<typeof opponentProfileSchema>;

export const observationSchema = z.object({
    id: analysisIdSchema,
    kind: z.enum(["STRENGTH", "OPENING", "HABIT"]),
    text: z.string().trim().min(1).max(300),
    evidenceUrl: z.string().nullable().optional(),
    evidenceTime: z.string().nullable().optional(),
    evidenceNote: z.string().nullable().optional(),
    confidence: z.enum(["ONCE", "REPEATED"]),
});
export type OpponentObservation = z.infer<typeof observationSchema>;

export const tacticReviewSchema = z.object({
    outcome: tacticOutcomeSchema,
    note: z.string().max(300).nullable().optional(),
    auto: z.boolean().optional(),
});
export type TacticReview = z.infer<typeof tacticReviewSchema>;

export const tacticSchema = z.object({
    id: analysisIdSchema,
    text: z.string().trim().min(1),
    round: z.number().int().min(1).max(12).nullable(),
    observationIds: z.array(analysisIdSchema).default([]),
    sessionIds: z.array(z.string()),
    partnerBrief: z.string().nullable().optional(),
    review: tacticReviewSchema.optional(),
});
export type OpponentTactic = z.infer<typeof tacticSchema>;

export const opponentAnalysisSchema = z.object({
    profile: opponentProfileSchema.optional(),
    observations: z.array(observationSchema).optional(),
    tactics: z.array(tacticSchema).optional(),
    updatedAt: z.string().optional(),
    updatedById: z.string().optional(),
});
export type OpponentAnalysis = z.infer<typeof opponentAnalysisSchema>;

export const roundInputSchema = z.object({
    tacticMarks: z.record(z.string(), tacticOutcomeSchema).optional(),
    observationMarks: z.record(z.string(), observationMarkSchema).optional(),
    selfScore: selfScoreSchema.nullable().optional(),
    knockdownsAgainst: z.number().int().min(0).max(10).optional(),
    stunned: z.boolean().optional(),
    bleeding: z.boolean().optional(),
    fatigued: z.boolean().optional(),
    note: z.string().max(300).nullable().optional(),
});
export type RoundInput = z.infer<typeof roundInputSchema>;
export type AnalysisRound = RoundInput & { roundNo: number };

export const cornerTacticSchema = z.object({
    id: analysisIdSchema,
    text: z.string(),
    round: z.number().nullable(),
    partnerBrief: z.string().nullable(),
    trained: z.boolean(),
    basis: z.enum(["REPEATED", "ONCE"]),
});
export type CornerTactic = z.infer<typeof cornerTacticSchema>;

export const cornerCardSchema = z.object({
    tactics: z.array(cornerTacticSchema),
    acuteLossFlag: z.boolean(),
});
export type CornerCard = z.infer<typeof cornerCardSchema>;

export const roundAdviceTacticSchema = cornerTacticSchema.extend({
    score: z.number(),
    dropped: z.boolean(),
    note: z.literal("OPPONENT_MAY_HAVE_CHANGED").optional(),
});
export type RoundAdviceTactic = z.infer<typeof roundAdviceTacticSchema>;

export const roundAdviceStandingSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("HARD_TO_WIN_ON_POINTS"),
        selfScored: z.literal(true),
    }),
    z.object({
        kind: z.literal("NEED_WINS"),
        needed: z.number(),
        remaining: z.number(),
        selfScored: z.literal(true),
    }),
    z.object({
        kind: z.literal("AHEAD"),
        selfScored: z.literal(true),
    }),
]);
export type RoundAdviceStanding = z.infer<typeof roundAdviceStandingSchema>;

export const roundAdviceSafetySchema = z
    .object({
        level: z.literal("RED"),
        reasons: z.array(z.enum(["KNOCKDOWNS", "STUNNED_STREAK"])),
    })
    .nullable();
export type RoundAdviceSafety = z.infer<typeof roundAdviceSafetySchema>;

export const roundAdviceSchema = z.object({
    tactics: z.array(roundAdviceTacticSchema),
    standing: roundAdviceStandingSchema,
    safety: roundAdviceSafetySchema,
});
export type RoundAdvice = z.infer<typeof roundAdviceSchema>;

export const roundResponseSchema = z.object({
    id: z.string(),
    boutId: z.string(),
    roundNo: z.number(),
    tacticMarks: z.record(z.string(), tacticOutcomeSchema),
    observationMarks: z.record(z.string(), observationMarkSchema),
    selfScore: selfScoreSchema.nullable(),
    knockdownsAgainst: z.number(),
    stunned: z.boolean(),
    bleeding: z.boolean(),
    fatigued: z.boolean(),
    note: z.string().nullable(),
    recordedById: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type RoundRecord = z.infer<typeof roundResponseSchema>;

export const roundsResponseSchema = z.object({
    scheduledRounds: z.number().nullable(),
    rounds: z.array(roundResponseSchema),
    advice: roundAdviceSchema.nullable(),
});
export type RoundsResponse = z.infer<typeof roundsResponseSchema>;

export function buildCornerCard(
    analysis: OpponentAnalysis,
    roundsSoFar: readonly AnalysisRound[] = [],
    acuteLoss: { status: string } | null = null,
): CornerCard {
    const repeated = new Set(
        (analysis.observations ?? [])
            .filter(
                (o) =>
                    o.confidence === "REPEATED" ||
                    roundsSoFar.some((r) => r.observationMarks?.[o.id] === "SEEN"),
            )
            .map((o) => o.id),
    );
    return {
        tactics: (analysis.tactics ?? [])
            .map((t) => ({
                id: t.id,
                text: t.text,
                round: t.round,
                partnerBrief: t.partnerBrief ?? null,
                trained: t.sessionIds.length > 0,
                basis: t.observationIds.some((id) => repeated.has(id))
                    ? ("REPEATED" as const)
                    : ("ONCE" as const),
            }))
            .sort(
                (a, b) =>
                    Number(b.basis === "REPEATED") - Number(a.basis === "REPEATED") ||
                    Number(b.trained) - Number(a.trained),
            ),
        acuteLossFlag: acuteLoss?.status === "EXCEEDED",
    };
}

/** Missing tactic marks and NOT_USED neither add to nor reset an ineffective streak. */
function ineffectiveStreak(rounds: readonly AnalysisRound[], id: string): number {
    let count = 0;
    for (const r of [...rounds].reverse()) {
        const mark = r.tacticMarks?.[id];
        if (mark === "EFFECTIVE") break;
        if (mark === "INEFFECTIVE") count++;
    }
    return count;
}

function unseenStreak(rounds: readonly AnalysisRound[], id: string): number {
    let count = 0;
    for (let i = rounds.length - 1; i >= 0; i--) {
        const r = rounds[i]!;
        if (r.observationMarks?.[id] !== "NOT_SEEN") break;
        if (i < rounds.length - 1 && rounds[i + 1]!.roundNo !== r.roundNo + 1) break;
        count++;
    }
    return count;
}

export function buildRoundAdvice(
    analysis: OpponentAnalysis,
    inputRounds: readonly AnalysisRound[],
    scheduledRounds: number,
): RoundAdvice {
    const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
    const tactics = analysis.tactics ?? [];
    const used = new Set(
        tactics
            .filter((t) =>
                rounds.some((r) =>
                    ["EFFECTIVE", "INEFFECTIVE"].includes(r.tacticMarks?.[t.id] ?? ""),
                ),
            )
            .map((t) => t.id),
    );
    const usedBasis = new Set(
        tactics.filter((t) => used.has(t.id)).flatMap((t) => t.observationIds),
    );
    const demoted = new Set(
        (analysis.observations ?? [])
            .filter((o) => unseenStreak(rounds, o.id) >= NOT_SEEN_STREAK_TO_DEMOTE)
            .map((o) => o.id),
    );
    const ranked = buildCornerCard(analysis, rounds)
        .tactics.map((t) => {
            const source = tactics.find((x) => x.id === t.id)!;
            const changed =
                source.observationIds.length > 0 &&
                source.observationIds.every((id) => demoted.has(id));
            return {
                item: {
                    ...t,
                    score: rounds.reduce(
                        (sum, r) =>
                            sum +
                            (r.tacticMarks?.[t.id] === "EFFECTIVE"
                                ? 1
                                : r.tacticMarks?.[t.id] === "INEFFECTIVE"
                                  ? -1
                                  : 0),
                        0,
                    ),
                    dropped: ineffectiveStreak(rounds, t.id) >= INEFFECTIVE_STREAK_TO_DROP,
                    ...(changed ? { note: "OPPONENT_MAY_HAVE_CHANGED" as const } : {}),
                },
                promote:
                    !used.has(t.id) &&
                    source.observationIds.some((id) => usedBasis.has(id)),
            };
        })
        .sort(
            (a, b) =>
                Number(a.item.dropped || Boolean(a.item.note)) -
                    Number(b.item.dropped || Boolean(b.item.note)) ||
                b.item.score - a.item.score ||
                Number(b.promote) - Number(a.promote),
        );
    const w = rounds.filter((r) => r.selfScore === "WIN").length;
    const l = rounds.filter((r) => r.selfScore === "LOSS").length;
    const remaining = scheduledRounds - rounds.length;
    const needed = l - w + 1;
    const standing: RoundAdvice["standing"] =
        l < w
            ? { kind: "AHEAD", selfScored: true }
            : needed > remaining
              ? { kind: "HARD_TO_WIN_ON_POINTS", selfScored: true }
              : { kind: "NEED_WINS", needed, remaining, selfScored: true };
    const reasons: ("KNOCKDOWNS" | "STUNNED_STREAK")[] = [];
    if (
        rounds.reduce((sum, r) => sum + (r.knockdownsAgainst ?? 0), 0) >=
        KNOCKDOWN_WARN_TOTAL
    ) {
        reasons.push("KNOCKDOWNS");
    }
    let stunned = 0;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (
            !rounds[i]!.stunned ||
            (i < rounds.length - 1 &&
                rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)
        ) {
            break;
        }
        stunned++;
    }
    if (stunned >= STUNNED_STREAK_WARN) reasons.push("STUNNED_STREAK");
    return {
        tactics: ranked.map((entry) => entry.item),
        standing,
        safety: reasons.length ? { level: "RED", reasons } : null,
    };
}

/**
 * Filters corner card tactics by round while strictly preserving the backend order (T-010B §1).
 * Tactics with `round === null` apply to all rounds; tactics with a specific `round`
 * are kept when viewing all rounds (`selectedRound === null`) or that exact round.
 */
export function filterCornerCardTactics<T extends { round: number | null }>(
    tactics: readonly T[],
    selectedRound: number | null,
): T[] {
    if (selectedRound === null) return [...tactics];
    return tactics.filter((t) => t.round === null || t.round === selectedRound);
}
