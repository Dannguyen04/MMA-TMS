import { z } from "zod";

import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import type { AcuteLoss, BoutOutcome } from "./bout";
import { BOUT_METHODS, BOUT_RESULTS } from "./bout-rules";
import { apiAcuteLossSchema } from "./bouts-contract";
import {
    analysisIdSchema,
    buildImprovementPoints,
    evaluateTactics,
    improvementPointSchema,
    tacticOutcomeSchema,
    tacticReviewSchema,
    type AnalysisRound,
    type ImprovementPoint,
    type OpponentAnalysis,
    type TacticOutcome,
} from "./round-advice";

/** Business flow 14 (T-041): the post-bout report, `GET /bouts/:id/report`. */

export const TACTIC_REVIEW_NOTE_MAX = 300;

/** A code this build doesn't know (a newer backend) is left out rather than failing the page (T-041 R2). */
const knownImprovementPoints = z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
        const parsed = improvementPointSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
    }),
);

const reportTacticSchema = z.object({
    id: analysisIdSchema,
    text: z.string(),
    effectiveRounds: z.number().int().nonnegative(),
    ineffectiveRounds: z.number().int().nonnegative(),
    /** R29; null when no round was recorded. */
    outcome: tacticOutcomeSchema.nullable(),
    review: tacticReviewSchema.nullable(),
});
export type ReportTactic = z.infer<typeof reportTacticSchema>;

export const boutReportSchema = z.object({
    result: z.object({
        result: z.enum(BOUT_RESULTS).nullable(),
        method: z.enum(BOUT_METHODS).nullable(),
        resultRound: z.number().int().nullable(),
        knockedDown: z.boolean().nullable(),
    }),
    tactics: z.array(reportTacticSchema),
    observations: z.array(z.object({ id: analysisIdSchema, text: z.string(), notSeenInBout: z.boolean() })),
    acuteLoss: apiAcuteLossSchema.nullable(),
    improvementPoints: knownImprovementPoints,
    roundsRecorded: z.number().int().nonnegative(),
});
export type BoutReport = z.infer<typeof boutReportSchema>;

/** Body of `PUT /bouts/:id/opponent-analysis/review`. */
export const tacticReviewsInputSchema = z
    .object({
        reviews: z
            .array(
                z.object({
                    tacticId: analysisIdSchema,
                    outcome: tacticOutcomeSchema,
                    note: z.string().max(TACTIC_REVIEW_NOTE_MAX).optional(),
                }),
            )
            .max(5),
    })
    .refine((value) => new Set(value.reviews.map((r) => r.tacticId)).size === value.reviews.length);
export type TacticReviewsInput = z.infer<typeof tacticReviewsInputSchema>;

/** The report demo mode builds from its store, the same way `BoutsService.getReport` does. */
export function buildBoutReport(
    analysis: OpponentAnalysis,
    rounds: readonly AnalysisRound[],
    outcome: BoutOutcome | null,
    acuteLoss: AcuteLoss | null,
): BoutReport {
    const evaluation = evaluateTactics(analysis, rounds);
    return {
        result: {
            result: outcome?.result ?? null,
            method: outcome?.method ?? null,
            resultRound: outcome?.round ?? null,
            knockedDown: outcome?.knockedDown ?? null,
        },
        tactics: evaluation.tactics.map((t) => ({
            ...t,
            outcome: rounds.length ? t.outcome : null,
            review: analysis.tactics?.find((source) => source.id === t.id)?.review ?? null,
        })),
        observations: evaluation.observations,
        acuteLoss,
        improvementPoints: buildImprovementPoints(analysis, rounds, acuteLoss),
        roundsRecorded: rounds.length,
    };
}

/** The coach's verdict when they saved one, otherwise what the rounds say (R29). */
export function reportedOutcome(tactic: ReportTactic): TacticOutcome | null {
    return tactic.review?.outcome ?? tactic.outcome;
}

/** "Filled in by the app" until the coach saves a review of their own. */
export function isPrefilled(tactic: ReportTactic): boolean {
    return tactic.review === null || tactic.review.auto === true;
}

/** Dictionary key and values for one improvement point, so the page never shows a raw code (T-041 R1). */
export function improvementPointMessage(point: ImprovementPoint): { key: MessageKey; values?: MessageParams } {
    if ("tacticId" in point) return { key: "boutAnalysis.report.point.tacticIneffective", values: { tactic: point.text } };
    if ("fromRound" in point) return { key: "boutAnalysis.report.point.fatigue", values: { round: point.fromRound } };
    return { key: "boutAnalysis.report.point.acuteLoss" };
}
