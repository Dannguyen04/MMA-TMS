import "server-only";

import { z } from "zod";

import {
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
} from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import {
    cornerCardSchema,
    opponentAnalysisSchema,
    roundsResponseSchema,
    type CornerCard,
    type OpponentAnalysis,
    type RoundInput,
    type RoundsResponse,
} from "@/lib/domain/round-advice";
import type { User } from "@/lib/domain/types";
import { isNotFound, nullIfNotFound, unsupportedOperation } from "./api-helpers";
import { platformFeatureAvailable } from "./platform-features";

const backendBoutAnalysisEnvelopeSchema = z.object({
    id: z.string(),
    scheduledRounds: z.number().nullable().optional(),
    opponentAnalysis: opponentAnalysisSchema.optional(),
    tacticsWithoutSessions: z.array(z.string()).optional(),
});

export interface BoutAnalysisDetail {
    scheduledRounds: number | null;
    opponentAnalysis: OpponentAnalysis;
    tacticsWithoutSessions: string[];
}

export type GetCornerCardResult =
    | { ok: true; card: CornerCard }
    | { ok: false; error: "BOUT_NOT_FOUND" | "BOUT_INVALID_TRANSITION" | "FORBIDDEN" };

export type GetBoutRoundsResult =
    | { ok: true; data: RoundsResponse }
    | { ok: false; error: "BOUT_NOT_FOUND" | "BOUT_INVALID_TRANSITION" | "FORBIDDEN" };

export type UpsertBoutRoundResult =
    | { ok: true; data: RoundsResponse }
    | { ok: false; error: string };

async function demoService(): Promise<typeof import("./bout-analysis.demo")> {
    return import("./bout-analysis.demo");
}

export async function getBoutAnalysisDetail(boutId: string): Promise<BoutAnalysisDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getBoutAnalysisDetail(boutId);
    if (!platformFeatureAvailable("bouts")) return null;

    const bout = await nullIfNotFound(
        authenticatedApiRequest(
            `/bouts/${encodeURIComponent(boutId)}`,
            backendBoutAnalysisEnvelopeSchema,
        ),
    );
    if (!bout) return null;

    const analysis = bout.opponentAnalysis ?? { observations: [], tactics: [] };
    return {
        scheduledRounds: bout.scheduledRounds ?? null,
        opponentAnalysis: analysis,
        tacticsWithoutSessions:
            bout.tacticsWithoutSessions ??
            (analysis.tactics ?? []).filter((t) => t.sessionIds.length === 0).map((t) => t.id),
    };
}

export async function getCornerCard(boutId: string): Promise<GetCornerCardResult> {
    if (isDemoAuthEnabled()) return (await demoService()).getCornerCard(boutId);
    if (!platformFeatureAvailable("bouts")) return { ok: false, error: "BOUT_NOT_FOUND" };

    try {
        const card = await authenticatedApiRequest(
            `/bouts/${encodeURIComponent(boutId)}/corner-card`,
            cornerCardSchema,
        );
        return { ok: true, card };
    } catch (error: unknown) {
        if (isNotFound(error)) return { ok: false, error: "BOUT_NOT_FOUND" };
        const err = error as { status?: number };
        if (err?.status === 409) return { ok: false, error: "BOUT_INVALID_TRANSITION" };
        if (err?.status === 403) return { ok: false, error: "FORBIDDEN" };
        throw error;
    }
}

export async function getBoutRounds(boutId: string): Promise<GetBoutRoundsResult> {
    if (isDemoAuthEnabled()) return (await demoService()).getBoutRounds(boutId);
    if (!platformFeatureAvailable("bouts")) return { ok: false, error: "BOUT_NOT_FOUND" };

    try {
        const data = await authenticatedApiRequest(
            `/bouts/${encodeURIComponent(boutId)}/rounds`,
            roundsResponseSchema,
        );
        return { ok: true, data };
    } catch (error: unknown) {
        if (isNotFound(error)) return { ok: false, error: "BOUT_NOT_FOUND" };
        const err = error as { status?: number };
        if (err?.status === 409) return { ok: false, error: "BOUT_INVALID_TRANSITION" };
        if (err?.status === 403) return { ok: false, error: "FORBIDDEN" };
        throw error;
    }
}

export async function upsertBoutRound(
    boutId: string,
    roundNo: number,
    input: RoundInput,
    actor: User,
): Promise<UpsertBoutRoundResult> {
    if (isDemoAuthEnabled()) return (await demoService()).upsertBoutRound(boutId, roundNo, input, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Recording bout round", "bouts");

    try {
        await authenticatedMutableApiRequest(
            `/bouts/${encodeURIComponent(boutId)}/rounds/${encodeURIComponent(String(roundNo))}`,
            z.unknown(),
            {
                method: "PUT",
                body: JSON.stringify(input),
            },
        );
        const updated = await getBoutRounds(boutId);
        if (!updated.ok) return { ok: false, error: updated.error };
        return { ok: true, data: updated.data };
    } catch (error: unknown) {
        if (isNotFound(error)) return { ok: false, error: "BOUT_NOT_FOUND" };
        const err = error as { status?: number; responseBody?: { code?: string } };
        if (err?.status === 409 || err?.status === 422) {
            return {
                ok: false,
                error: err.responseBody?.code ?? (err.status === 409 ? "BOUT_INVALID_TRANSITION" : "BOUT_ROUND_INVALID"),
            };
        }
        throw error;
    }
}
