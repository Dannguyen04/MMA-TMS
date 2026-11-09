import "server-only";

import { buildBoutReport, type TacticReviewsInput } from "@/lib/domain/bout-report";
import {
    buildCornerCard,
    buildRoundAdvice,
    nextRoundPlanSchema,
    type OpponentAnalysis,
    type RoundInput,
    type RoundRecord,
} from "@/lib/domain/round-advice";
import type { OpponentAnalysisInput } from "@/lib/domain/opponent-analysis-form";
import type { User } from "@/lib/domain/types";
import type {
    BoutAnalysisDetail,
    GetBoutReportResult,
    GetBoutRoundsResult,
    GetCornerCardResult,
    SaveOpponentAnalysisResult,
    SaveTacticReviewsResult,
    UpsertBoutRoundResult,
} from "./bout-analysis";
import { demoCampStore, type DemoBoutRecord } from "./bouts.demo";

function findBoutRecord(boutId: string): DemoBoutRecord | null {
    const bout = demoCampStore().bouts.find((b) => b.id === boutId);
    return bout ?? null;
}

function getAnalysis(bout: DemoBoutRecord): OpponentAnalysis {
    return bout.opponentAnalysis ?? { observations: [], tactics: [] };
}

function getRounds(bout: DemoBoutRecord): RoundRecord[] {
    if (!bout.boutRounds) {
        bout.boutRounds = [];
    }
    return [...bout.boutRounds].sort((a, b) => a.roundNo - b.roundNo);
}

export async function getBoutAnalysisDetail(boutId: string): Promise<BoutAnalysisDetail | null> {
    const bout = findBoutRecord(boutId);
    if (!bout) return null;

    const analysis = getAnalysis(bout);
    return {
        scheduledRounds: bout.scheduledRounds ?? null,
        opponentAnalysis: analysis,
        tacticsWithoutSessions: (analysis.tactics ?? [])
            .filter((t) => t.sessionIds.length === 0)
            .map((t) => t.id),
    };
}

export async function getCornerCard(boutId: string): Promise<GetCornerCardResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    if (bout.phase !== "WEIGHED_IN" && bout.phase !== "COMPLETED") {
        return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    }

    const analysis = getAnalysis(bout);
    const rounds = getRounds(bout);
    const card = buildCornerCard(analysis, rounds, bout.weighIn?.acuteLoss ?? null);
    return { ok: true, card };
}

export async function getBoutRounds(boutId: string): Promise<GetBoutRoundsResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    const scheduledRounds = bout.scheduledRounds ?? null;
    const rounds = getRounds(bout);
    const analysis = getAnalysis(bout);

    const advice =
        scheduledRounds !== null && rounds.length > 0 && rounds.length < scheduledRounds
            ? buildRoundAdvice(analysis, rounds, scheduledRounds)
            : null;

    return {
        ok: true,
        data: {
            scheduledRounds,
            rounds,
            advice,
        },
    };
}

export async function getBoutReport(boutId: string): Promise<GetBoutReportResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };
    if (bout.phase !== "COMPLETED") return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    return { ok: true, report: buildBoutReport(getAnalysis(bout), getRounds(bout), bout.outcome, bout.weighIn?.acuteLoss ?? null) };
}

export async function saveTacticReviews(boutId: string, input: TacticReviewsInput): Promise<SaveTacticReviewsResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };
    if (bout.phase !== "COMPLETED") return { ok: false, error: "BOUT_INVALID_TRANSITION" };

    const analysis = getAnalysis(bout);
    const tactics = analysis.tactics ?? [];
    if (input.reviews.some((r) => !tactics.some((t) => t.id === r.tacticId))) {
        return { ok: false, error: "OPPONENT_TACTIC_UNKNOWN" };
    }
    bout.opponentAnalysis = {
        ...analysis,
        tactics: tactics.map((t) => {
            const review = input.reviews.find((r) => r.tacticId === t.id);
            return review ? { ...t, review: { outcome: review.outcome, note: review.note ?? null, auto: false } } : t;
        }),
    };
    return { ok: true };
}

export async function upsertBoutRound(
    boutId: string,
    roundNo: number,
    input: RoundInput,
    actor: User,
): Promise<UpsertBoutRoundResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    if (bout.phase !== "WEIGHED_IN" && bout.phase !== "COMPLETED") {
        return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    }

    const scheduledRounds = bout.scheduledRounds ?? null;
    if (scheduledRounds === null) {
        return { ok: false, error: "BOUT_ROUNDS_NOT_SET" };
    }

    if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > scheduledRounds) {
        return { ok: false, error: "BOUT_ROUND_OUT_OF_RANGE" };
    }

    // The same checks as BoutsService.upsertRound (T-037): tactics added at an earlier break can be marked, a plan
    // can't follow the last round, and every id a plan names must exist.
    const analysis = getAnalysis(bout);
    const recorded = getRounds(bout);
    const addedBy = (rounds: RoundRecord[]) => rounds.flatMap((r) => r.nextRoundPlan?.addedTactics ?? []).map((t) => t.id);
    const tactics = new Set([...(analysis.tactics ?? []).map((t) => t.id), ...addedBy(recorded.filter((r) => r.roundNo < roundNo))]);
    const observations = new Set((analysis.observations ?? []).map((o) => o.id));
    const parsedPlan = input.nextRoundPlan === undefined ? undefined : nextRoundPlanSchema.safeParse(input.nextRoundPlan);
    if (parsedPlan && !parsedPlan.success) return { ok: false, error: "BOUT_ROUND_INVALID" };
    const plan = parsedPlan?.data;
    if (plan && roundNo === scheduledRounds && plan.focusTacticIds.length + plan.addedTactics.length + plan.instructions.length > 0) {
        return { ok: false, error: "BOUT_NEXT_ROUND_PLAN_LAST_ROUND" };
    }
    const existingIds = new Set([...tactics, ...observations, ...addedBy(recorded.filter((r) => r.roundNo !== roundNo))]);
    for (const added of plan?.addedTactics ?? []) {
        if (existingIds.has(added.id) || added.observationIds.some((id) => !observations.has(id))) return { ok: false, error: "BOUT_ROUND_MARK_UNKNOWN" };
        existingIds.add(added.id);
    }
    const planTactics = new Set([...tactics, ...(plan?.addedTactics ?? []).map((t) => t.id)]);
    if (
        plan?.focusTacticIds.some((id) => !planTactics.has(id)) ||
        plan?.instructions.some((instruction) => instruction.tacticId && !planTactics.has(instruction.tacticId)) ||
        Object.keys(input.tacticMarks ?? {}).some((id) => !tactics.has(id)) ||
        Object.keys(input.observationMarks ?? {}).some((id) => !observations.has(id))
    ) {
        return { ok: false, error: "BOUT_ROUND_MARK_UNKNOWN" };
    }

    if (!bout.boutRounds) {
        bout.boutRounds = [];
    }

    const store = demoCampStore();
    const now = new Date().toISOString();
    const existingIdx = bout.boutRounds.findIndex((r) => r.roundNo === roundNo);

    if (existingIdx >= 0) {
        const current = bout.boutRounds[existingIdx]!;
        bout.boutRounds[existingIdx] = {
            ...current,
            tacticMarks: input.tacticMarks !== undefined ? input.tacticMarks : current.tacticMarks,
            observationMarks: input.observationMarks !== undefined ? input.observationMarks : current.observationMarks,
            selfScore: input.selfScore !== undefined ? input.selfScore : current.selfScore,
            knockdownsAgainst: input.knockdownsAgainst !== undefined ? input.knockdownsAgainst : current.knockdownsAgainst,
            stunned: input.stunned !== undefined ? input.stunned : current.stunned,
            bleeding: input.bleeding !== undefined ? input.bleeding : current.bleeding,
            fatigued: input.fatigued !== undefined ? input.fatigued : current.fatigued,
            note: input.note !== undefined ? input.note : current.note,
            nextRoundPlan: plan !== undefined ? plan : current.nextRoundPlan,
            recordedById: actor.id,
            updatedAt: now,
        };
    } else {
        bout.boutRounds.push({
            id: `round-${boutId}-${roundNo}-${store.sequence++}`,
            boutId,
            roundNo,
            tacticMarks: input.tacticMarks ?? {},
            observationMarks: input.observationMarks ?? {},
            selfScore: input.selfScore ?? null,
            knockdownsAgainst: input.knockdownsAgainst ?? 0,
            stunned: input.stunned ?? false,
            bleeding: input.bleeding ?? false,
            fatigued: input.fatigued ?? false,
            note: input.note ?? null,
            nextRoundPlan: plan ?? null,
            recordedById: actor.id,
            createdAt: now,
            updatedAt: now,
        });
    }

    bout.boutRounds.sort((a, b) => a.roundNo - b.roundNo);
    return getBoutRounds(boutId);
}

export async function saveOpponentAnalysis(
    boutId: string,
    input: OpponentAnalysisInput,
    actor: User,
): Promise<SaveOpponentAnalysisResult> {
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    if (bout.phase === "COMPLETED" || bout.phase === "CANCELLED") {
        return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    }

    // Reviews are written after the bout, so a pre-bout edit keeps them as they were.
    const previous = getAnalysis(bout);
    bout.opponentAnalysis = {
        profile: input.profile,
        observations: input.observations,
        tactics: input.tactics.map((t) => {
            const review = previous.tactics?.find((old) => old.id === t.id)?.review;
            return review ? { ...t, review } : t;
        }),
        updatedAt: new Date().toISOString(),
        updatedById: actor.id,
    };
    return { ok: true };
}
