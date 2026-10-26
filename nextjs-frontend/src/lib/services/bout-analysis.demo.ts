import "server-only";

import {
    buildCornerCard,
    buildRoundAdvice,
    type OpponentAnalysis,
    type RoundInput,
    type RoundRecord,
} from "@/lib/domain/round-advice";
import type { User } from "@/lib/domain/types";
import type { MockBoutRecord } from "@/lib/mocks/bouts";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import type {
    BoutAnalysisDetail,
    GetBoutRoundsResult,
    GetCornerCardResult,
    UpsertBoutRoundResult,
} from "./bout-analysis";

function findBoutRecord(boutId: string): MockBoutRecord | null {
    const bout = db().bouts.find((b) => b.id === boutId && b.deletedAt === null);
    return (bout as MockBoutRecord | undefined) ?? null;
}

function getAnalysis(bout: MockBoutRecord): OpponentAnalysis {
    return bout.opponentAnalysis ?? { observations: [], tactics: [] };
}

function getRounds(bout: MockBoutRecord): RoundRecord[] {
    if (!bout.boutRounds) {
        bout.boutRounds = [];
    }
    return [...bout.boutRounds].sort((a, b) => a.roundNo - b.roundNo);
}

export async function getBoutAnalysisDetail(boutId: string): Promise<BoutAnalysisDetail | null> {
    await simulateLatency(0.3);
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
    await simulateLatency(0.3);
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    if (bout.status !== "WEIGHED_IN" && bout.status !== "COMPLETED") {
        return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    }

    const analysis = getAnalysis(bout);
    const rounds = getRounds(bout);
    const card = buildCornerCard(analysis, rounds, null);
    return { ok: true, card };
}

export async function getBoutRounds(boutId: string): Promise<GetBoutRoundsResult> {
    await simulateLatency(0.3);
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

export async function upsertBoutRound(
    boutId: string,
    roundNo: number,
    input: RoundInput,
    actor: User,
): Promise<UpsertBoutRoundResult> {
    await simulateLatency(0.4);
    const bout = findBoutRecord(boutId);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };

    if (bout.status !== "WEIGHED_IN" && bout.status !== "COMPLETED") {
        return { ok: false, error: "BOUT_INVALID_TRANSITION" };
    }

    const scheduledRounds = bout.scheduledRounds ?? null;
    if (scheduledRounds === null) {
        return { ok: false, error: "BOUT_ROUNDS_NOT_SET" };
    }

    if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > scheduledRounds) {
        return { ok: false, error: "BOUT_ROUND_OUT_OF_RANGE" };
    }

    const analysis = getAnalysis(bout);
    const validTacticIds = new Set((analysis.tactics ?? []).map((t) => t.id));
    const validObsIds = new Set((analysis.observations ?? []).map((o) => o.id));

    if (input.tacticMarks) {
        for (const key of Object.keys(input.tacticMarks)) {
            if (!validTacticIds.has(key)) {
                return { ok: false, error: "BOUT_ROUND_MARK_UNKNOWN" };
            }
        }
    }

    if (input.observationMarks) {
        for (const key of Object.keys(input.observationMarks)) {
            if (!validObsIds.has(key)) {
                return { ok: false, error: "BOUT_ROUND_MARK_UNKNOWN" };
            }
        }
    }

    if (!bout.boutRounds) {
        bout.boutRounds = [];
    }

    const now = nowIso();
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
            recordedById: actor.id,
            updatedAt: now,
        };
    } else {
        bout.boutRounds.push({
            id: newId("round"),
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
            recordedById: actor.id,
            createdAt: now,
            updatedAt: now,
        });
    }

    bout.boutRounds.sort((a, b) => a.roundNo - b.roundNo);
    return getBoutRounds(boutId);
}
