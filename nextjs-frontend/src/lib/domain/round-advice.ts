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

/** T-037: what the corner tells the fighter for the next round. The backend sends codes; the UI words them. */
export const instructionCodeSchema = z.enum([
    "SAFETY_CHECK",
    "STOP_TACTIC",
    "USE_TACTIC",
    "RECHECK_OPPONENT",
    "MUST_WIN_ROUND",
    "HARD_TO_WIN_ON_POINTS",
    "CUSTOM",
]);
export type InstructionCode = z.infer<typeof instructionCodeSchema>;
export const TACTIC_INSTRUCTION_CODES: readonly InstructionCode[] = ["USE_TACTIC", "STOP_TACTIC", "RECHECK_OPPONENT"];
export const NEXT_ROUND_TEXT_MAX = 140;

export const instructionSchema = z
    .object({
        code: instructionCodeSchema,
        tacticId: analysisIdSchema.optional(),
        text: z.string().trim().min(1).max(NEXT_ROUND_TEXT_MAX).optional(),
    })
    .strict()
    .superRefine((instruction, ctx) => {
        if (instruction.code === "CUSTOM" && !instruction.text) ctx.addIssue({ code: "custom", path: ["text"], message: "CUSTOM requires text" });
        if (TACTIC_INSTRUCTION_CODES.includes(instruction.code) && !instruction.tacticId) {
            ctx.addIssue({ code: "custom", path: ["tacticId"], message: "Instruction requires tacticId" });
        }
    });
export type Instruction = z.infer<typeof instructionSchema>;

export const nextRoundPlanSchema = z
    .object({
        focusTacticIds: z.array(analysisIdSchema).max(2).default([]),
        addedTactics: z
            .array(
                z
                    .object({
                        id: analysisIdSchema,
                        text: z.string().trim().min(1).max(NEXT_ROUND_TEXT_MAX),
                        observationIds: z.array(analysisIdSchema).max(3).default([]),
                    })
                    .strict(),
            )
            .max(2)
            .default([]),
        instructions: z.array(instructionSchema).max(3).default([]),
    })
    .strict();
export type NextRoundPlan = z.infer<typeof nextRoundPlanSchema>;

export const roundInputSchema = z.object({
    nextRoundPlan: nextRoundPlanSchema.optional(),
    tacticMarks: z.record(z.string(), tacticOutcomeSchema).optional(),
    observationMarks: z.record(z.string(), observationMarkSchema).optional(),
    selfScore: selfScoreSchema.nullable().optional(),
    knockdownsAgainst: z.number().int().min(0).max(10).optional(),
    stunned: z.boolean().optional(),
    bleeding: z.boolean().optional(),
    fatigued: z.boolean().optional(),
    note: z.string().max(300).nullable().optional(),
});
export type RoundInput = z.input<typeof roundInputSchema>;
export type AnalysisRound = Omit<RoundInput, "nextRoundPlan"> & { roundNo: number; nextRoundPlan?: z.input<typeof nextRoundPlanSchema> | null };

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
    /** The coach picked it as a focus for the next round (T-037). */
    focus: z.boolean().default(false),
    /** The round whose break added it, or null for a tactic from the pre-bout analysis. */
    addedRound: z.number().nullable().default(null),
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
    nextRound: z.object({
        roundNo: z.number(),
        suggested: z.array(instructionSchema).max(5),
        plan: nextRoundPlanSchema.nullable(),
    }),
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
    nextRoundPlan: nextRoundPlanSchema.nullable().optional(),
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

/**
 * For the corner card (T-037 B), whose API doesn't carry the breaks: the latest round's focus tactics and every tactic
 * added at a break, with the round whose break added it.
 */
export function breakChanges(rounds: readonly AnalysisRound[]): { focusIds: string[]; added: { id: string; text: string; addedRound: number }[] } {
    const sorted = [...rounds].sort((a, b) => a.roundNo - b.roundNo);
    return {
        focusIds: nextRoundPlanSchema.parse(sorted.at(-1)?.nextRoundPlan ?? {}).focusTacticIds,
        added: sorted.flatMap((r) =>
            nextRoundPlanSchema.parse(r.nextRoundPlan ?? {}).addedTactics.map((t) => ({ id: t.id, text: t.text, addedRound: r.roundNo })),
        ),
    };
}

/**
 * R21–R24 plus T-037, mirrored from `buildRoundAdvice` in nestjs-api `bout-analysis.model.ts` so demo mode advises
 * exactly what the API does: tactics added at a break join the list, the latest round's plan puts its focus tactics
 * first, and `nextRound.suggested` lists safety, newly dropped, up to two to use, recheck and must-win, at most five.
 */
export function buildRoundAdvice(
    analysis: OpponentAnalysis,
    inputRounds: readonly AnalysisRound[],
    scheduledRounds: number,
): RoundAdvice {
    const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
    const addedTactics = rounds.flatMap((r) =>
        nextRoundPlanSchema.parse(r.nextRoundPlan ?? {}).addedTactics.map((t) => ({
            ...t,
            sessionIds: [] as string[],
            round: null,
            partnerBrief: null,
            addedRound: r.roundNo,
        })),
    );
    const tactics = [...(analysis.tactics ?? []), ...addedTactics];
    const latest = rounds.at(-1);
    const latestPlan = nextRoundPlanSchema.parse(latest?.nextRoundPlan ?? {});
    const hasPlan = latestPlan.focusTacticIds.length + latestPlan.addedTactics.length + latestPlan.instructions.length > 0;
    const focusIds = latestPlan.focusTacticIds;
    const used = new Set(
        tactics.filter((t) => rounds.some((r) => ["EFFECTIVE", "INEFFECTIVE"].includes(r.tacticMarks?.[t.id] ?? ""))).map((t) => t.id),
    );
    const usedBasis = new Set(tactics.filter((t) => used.has(t.id)).flatMap((t) => t.observationIds));
    const demoted = new Set(
        (analysis.observations ?? []).filter((o) => unseenStreak(rounds, o.id) >= NOT_SEEN_STREAK_TO_DEMOTE).map((o) => o.id),
    );
    // An unused tactic sharing evidence with one that was used moves up; only the sort needs it.
    const promoted = new Set(
        tactics.filter((t) => !used.has(t.id) && t.observationIds.some((id) => usedBasis.has(id))).map((t) => t.id),
    );
    const ranked = buildCornerCard({ ...analysis, tactics }, rounds)
        .tactics.map((t) => {
            const source = tactics.find((x) => x.id === t.id)!;
            const changed = source.observationIds.length > 0 && source.observationIds.every((id) => demoted.has(id));
            return {
                ...t,
                focus: focusIds.includes(t.id),
                addedRound: addedTactics.find((added) => added.id === t.id)?.addedRound ?? null,
                score: rounds.reduce(
                    (sum, r) => sum + (r.tacticMarks?.[t.id] === "EFFECTIVE" ? 1 : r.tacticMarks?.[t.id] === "INEFFECTIVE" ? -1 : 0),
                    0,
                ),
                dropped: ineffectiveStreak(rounds, t.id) >= INEFFECTIVE_STREAK_TO_DROP,
                ...(changed ? { note: "OPPONENT_MAY_HAVE_CHANGED" as const } : {}),
            };
        })
        .sort(
            (a, b) =>
                (focusIds.includes(a.id) ? focusIds.indexOf(a.id) : focusIds.length) -
                    (focusIds.includes(b.id) ? focusIds.indexOf(b.id) : focusIds.length) ||
                Number(a.dropped || Boolean(a.note)) - Number(b.dropped || Boolean(b.note)) ||
                b.score - a.score ||
                Number(promoted.has(b.id)) - Number(promoted.has(a.id)),
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
    if (rounds.reduce((sum, r) => sum + (r.knockdownsAgainst ?? 0), 0) >= KNOCKDOWN_WARN_TOTAL) reasons.push("KNOCKDOWNS");
    let stunned = 0;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (!rounds[i]!.stunned || (i < rounds.length - 1 && rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)) break;
        stunned++;
    }
    if (stunned >= STUNNED_STREAK_WARN) reasons.push("STUNNED_STREAK");
    const suggested: Instruction[] = [];
    if (reasons.length) suggested.push({ code: "SAFETY_CHECK" });
    for (const t of ranked) {
        if (t.dropped && ineffectiveStreak(rounds.slice(0, -1), t.id) < INEFFECTIVE_STREAK_TO_DROP) suggested.push({ code: "STOP_TACTIC", tacticId: t.id });
    }
    for (const t of ranked.filter((t) => !t.dropped && !t.note).slice(0, 2)) suggested.push({ code: "USE_TACTIC", tacticId: t.id });
    for (const t of ranked.filter((t) => t.note)) suggested.push({ code: "RECHECK_OPPONENT", tacticId: t.id });
    if (standing.kind === "NEED_WINS") suggested.push({ code: "MUST_WIN_ROUND" });
    if (standing.kind === "HARD_TO_WIN_ON_POINTS") suggested.push({ code: "HARD_TO_WIN_ON_POINTS" });
    return {
        nextRound: { roundNo: (latest?.roundNo ?? 0) + 1, suggested: suggested.slice(0, 5), plan: hasPlan ? latestPlan : null },
        tactics: ranked,
        standing,
        safety: reasons.length ? { level: "RED", reasons } : null,
    };
}

/**
 * R29, mirrored from `evaluateTactics` in nestjs-api `bout-analysis.model.ts` so demo mode reports what the API does:
 * a tactic is INEFFECTIVE when it failed in more rounds than it worked, EFFECTIVE when it worked at least once,
 * otherwise NOT_USED. An observation is "not seen in the bout" only when every round that marked it said NOT_SEEN.
 */
export function evaluateTactics(analysis: OpponentAnalysis, rounds: readonly AnalysisRound[]) {
    return {
        tactics: (analysis.tactics ?? []).map((t) => {
            const effectiveRounds = rounds.filter((r) => r.tacticMarks?.[t.id] === "EFFECTIVE").length;
            const ineffectiveRounds = rounds.filter((r) => r.tacticMarks?.[t.id] === "INEFFECTIVE").length;
            const outcome: TacticOutcome =
                ineffectiveRounds > effectiveRounds ? "INEFFECTIVE" : effectiveRounds > 0 ? "EFFECTIVE" : "NOT_USED";
            return { id: t.id, text: t.text, effectiveRounds, ineffectiveRounds, outcome };
        }),
        observations: (analysis.observations ?? []).map((o) => {
            const marks = rounds.map((r) => r.observationMarks?.[o.id]).filter((m) => m !== undefined);
            return { id: o.id, text: o.text, notSeenInBout: marks.length > 0 && marks.every((m) => m === "NOT_SEEN") };
        }),
    };
}

/**
 * What `BoutsService.recordResult` saves with the result: every tactic the coach hasn't reviewed gets its R29
 * outcome as an `auto` review, so later edits to the rounds no longer move the verdict. Unchanged without rounds.
 */
export function withAutoReviews(analysis: OpponentAnalysis, rounds: readonly AnalysisRound[]): OpponentAnalysis {
    if (!rounds.length || !analysis.tactics?.length) return analysis;
    const evaluation = evaluateTactics(analysis, rounds);
    return {
        ...analysis,
        tactics: analysis.tactics.map((t) =>
            t.review ? t : { ...t, review: { outcome: evaluation.tactics.find((e) => e.id === t.id)!.outcome, note: null, auto: true } },
        ),
    };
}

export const improvementPointSchema = z.union([
    z.object({ code: z.literal("TACTIC_INEFFECTIVE"), tacticId: analysisIdSchema, text: z.string() }),
    z.object({ code: z.literal("ACUTE_LOSS_EXCEEDED") }),
    z.object({
        code: z.string().regex(/^FATIGUE_FROM_ROUND_([1-9]|1[0-2])$/),
        fromRound: z.number().int().min(1).max(12),
    }),
]);
export type ImprovementPoint = z.infer<typeof improvementPointSchema>;

/**
 * R30, mirrored from `buildImprovementPoints` in nestjs-api: tactics the coach (or, failing that, R29) judged
 * ineffective, an exceeded acute weight cut, and fatigue in the last two or more consecutive rounds.
 */
export function buildImprovementPoints(
    analysis: OpponentAnalysis,
    inputRounds: readonly AnalysisRound[],
    acuteLoss: { status: string } | null,
): ImprovementPoint[] {
    const points: ImprovementPoint[] = [];
    // Without round records R25 only permits the acute-loss flag, even with saved reviews.
    if (inputRounds.length) {
        const evaluation = evaluateTactics(analysis, inputRounds);
        for (const t of analysis.tactics ?? []) {
            const outcome = t.review?.outcome ?? evaluation.tactics.find((e) => e.id === t.id)!.outcome;
            if (outcome === "INEFFECTIVE") points.push({ code: "TACTIC_INEFFECTIVE", tacticId: t.id, text: t.text });
        }
    }
    if (acuteLoss?.status === "EXCEEDED") points.push({ code: "ACUTE_LOSS_EXCEEDED" });
    const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
    let streak = 0;
    for (let i = rounds.length - 1; i >= 0; i--) {
        if (!rounds[i]!.fatigued || (i < rounds.length - 1 && rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)) break;
        streak++;
    }
    if (streak >= 2) {
        const fromRound = rounds[rounds.length - streak]!.roundNo;
        points.push({ code: `FATIGUE_FROM_ROUND_${fromRound}`, fromRound });
    }
    return points;
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
