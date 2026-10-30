import "server-only";

import { z } from "zod";

import {
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
} from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { SAMPLE_OPPONENT_ANALYSIS, sampleOpponentAnalysisWithSessions } from "@/lib/domain/opponent-analysis-seed";
import {
    buildCornerCard,
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
import { listSessions } from "./training";

const backendBoutAnalysisEnvelopeSchema = z.object({
    id: z.string(),
    fighterId: z.string().optional(),
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

function analysisPath(boutId: string, rest = "") {
    return `/bouts/${encodeURIComponent(boutId)}${rest}`;
}

function analysisIsEmpty(analysis: OpponentAnalysis | undefined): boolean {
    return (analysis?.tactics?.length ?? 0) === 0;
}

const SAMPLE_TACTIC_IDS = new Set<string>(SAMPLE_OPPONENT_ANALYSIS.tactics.map((t) => t.id));

/** Still the untouched sample: exactly the sample's tactics and none linked to a session. A coach's own analysis never matches. */
function isUnlinkedSample(tactics: readonly { id: string }[], linked: (index: number) => boolean): boolean {
    return (
        tactics.length === SAMPLE_TACTIC_IDS.size &&
        tactics.every((t) => SAMPLE_TACTIC_IDS.has(t.id)) &&
        tactics.every((_, index) => !linked(index))
    );
}

/** The fighter's two most recent sessions, so sample tactics read as trained; empty when there are none or they can't be read. */
async function recentSessionIds(fighterId: string | undefined): Promise<string[]> {
    if (!fighterId) return [];
    try {
        const sessions = await listSessions({ fighterIds: [fighterId], order: "desc" });
        return sessions.slice(0, 2).map((session) => session.id);
    } catch {
        return [];
    }
}

async function saveSample(boutId: string, sessionIds: readonly string[]): Promise<boolean> {
    try {
        await authenticatedApiRequest(analysisPath(boutId, "/opponent-analysis"), z.unknown(), {
            method: "PUT",
            body: JSON.stringify(sessionIds.length > 0 ? sampleOpponentAnalysisWithSessions(sessionIds) : SAMPLE_OPPONENT_ANALYSIS),
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Saves the sample analysis for API-mode demos. With the bout's fighter, the sample's first and third
 * tactics are linked to that fighter's latest sessions (the backend only accepts the fighter's own sessions).
 */
export async function putOpponentAnalysis(boutId: string, fighterId?: string): Promise<boolean> {
    return saveSample(boutId, await recentSessionIds(fighterId));
}

/**
 * Seeds the sample when the analysis is empty, and links it to sessions when it is still the unlinked
 * sample. Returns whether anything was saved, so the caller knows to read the bout again.
 */
async function seedSampleAnalysis(boutId: string, fighterId: string | undefined, state: "empty" | "unlinked"): Promise<boolean> {
    const sessionIds = await recentSessionIds(fighterId);
    if (state === "unlinked" && sessionIds.length === 0) return false;
    return saveSample(boutId, sessionIds);
}

async function boutFighterId(boutId: string): Promise<string | undefined> {
    try {
        const bout = await nullIfNotFound(authenticatedApiRequest(analysisPath(boutId), backendBoutAnalysisEnvelopeSchema));
        return bout?.fighterId;
    } catch {
        return undefined;
    }
}

export async function getBoutAnalysisDetail(boutId: string): Promise<BoutAnalysisDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getBoutAnalysisDetail(boutId);
    if (!platformFeatureAvailable("bouts")) return null;

    const load = () =>
        nullIfNotFound(
            authenticatedApiRequest(analysisPath(boutId), backendBoutAnalysisEnvelopeSchema),
        );

    let bout = await load();
    if (!bout) return null;

    const analysis = bout.opponentAnalysis ?? { observations: [], tactics: [] };
    const tactics = analysis.tactics ?? [];
    const state = analysisIsEmpty(analysis) ? "empty" : isUnlinkedSample(tactics, (i) => tactics[i].sessionIds.length > 0) ? "unlinked" : null;
    if (state && (await seedSampleAnalysis(boutId, bout.fighterId, state))) {
        bout = (await load()) ?? bout;
    }

    const next = bout.opponentAnalysis ?? { observations: [], tactics: [] };
    return {
        scheduledRounds: bout.scheduledRounds ?? null,
        opponentAnalysis: next,
        tacticsWithoutSessions:
            bout.tacticsWithoutSessions ??
            (next.tactics ?? []).filter((t) => t.sessionIds.length === 0).map((t) => t.id),
    };
}

export async function getCornerCard(boutId: string): Promise<GetCornerCardResult> {
    if (isDemoAuthEnabled()) return (await demoService()).getCornerCard(boutId);
    if (!platformFeatureAvailable("bouts")) return { ok: false, error: "BOUT_NOT_FOUND" };

    const load = () => authenticatedApiRequest(analysisPath(boutId, "/corner-card"), cornerCardSchema);

    try {
        let card = await load();
        const state = card.tactics.length === 0 ? "empty" : isUnlinkedSample(card.tactics, (i) => card.tactics[i].trained) ? "unlinked" : null;
        if (state && (await seedSampleAnalysis(boutId, await boutFighterId(boutId), state))) {
            card = await load();
        } else if (state === "empty") {
            // Saving failed (e.g. the bout is past the stage that accepts an analysis): show the sample read-only.
            card = buildCornerCard(SAMPLE_OPPONENT_ANALYSIS);
        }
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
