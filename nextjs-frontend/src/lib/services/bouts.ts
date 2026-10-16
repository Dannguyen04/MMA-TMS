import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { CampBout, NutritionPhaseKey } from "@/lib/domain/bout";
import { isRunningPhase } from "@/lib/domain/bout";
import type { PlanAdherence, WeightStatus } from "@/lib/domain/weight-chart";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { wayOffCount } from "@/lib/domain/nutrition";
import type { WriteResult } from "@/lib/domain/write-result";
import { dayKey } from "@/lib/format";
import { nullIfServiceFails } from "./api-helpers";
import { getFighter } from "./people";

export interface WeightAlert {
    bout: CampBout;
    fighterName: string;
    track: WeightTrack;
    wayOff: number;
}

const STATUS_ORDER: Record<WeightStatus, number> = { RED: 0, YELLOW: 1, GREY: 2, GREEN: 3 };

const apiTrackSchema = z.object({
    limitKg: z.number().nullable(),
    points: z.array(z.object({ date: z.string(), kg: z.number() })),
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    remainingPct: z.number().nullable(),
    status: z.enum(["GREEN", "YELLOW", "RED", "GREY"]),
    referencePath: z.array(z.object({ date: z.string(), kg: z.number() })),
});

export async function listCampBouts(): Promise<CampBout[]> {
    if (isDemoAuthEnabled()) {
        const { listDemoBouts } = await import("./bouts.demo");
        return listDemoBouts();
    }
    return [];
}

export async function getCampBout(boutId: string): Promise<CampBout | null> {
    if (isDemoAuthEnabled()) {
        const { getDemoBout } = await import("./bouts.demo");
        return getDemoBout(boutId);
    }
    return null;
}

export async function getCurrentBout(fighterId: string): Promise<CampBout | null> {
    if (isDemoAuthEnabled()) {
        const { getDemoCurrentBout } = await import("./bouts.demo");
        return getDemoCurrentBout(fighterId);
    }
    const bouts = (await listCampBouts()).filter((bout) => bout.fighterId === fighterId && isRunningPhase(bout.phase));
    return bouts.sort((a, b) => (a.weighInAt < b.weighInAt ? -1 : 1))[0] ?? null;
}

export async function getWeightTrack(boutId: string, now = new Date()): Promise<WeightTrack | null> {
    if (isDemoAuthEnabled()) {
        const { demoWeightTrack } = await import("./bouts.demo");
        return demoWeightTrack(boutId, now);
    }
    const raw = await nullIfServiceFails(authenticatedApiRequest(`/bouts/${encodeURIComponent(boutId)}/weight-track`, apiTrackSchema));
    if (!raw) return null;
    const bout = await getCampBout(boutId);
    const weighInOn = bout ? dayKey(bout.weighInAt) : (raw.latestOn ?? dayKey(now));
    return {
        limitKg: raw.limitKg ?? bout?.limitKg ?? 0,
        points: raw.points,
        latestKg: raw.latestKg,
        latestOn: raw.latestOn,
        remainingPct: raw.remainingPct,
        status: raw.status,
        referencePath: raw.referencePath,
        weighInOn,
        daysToWeighIn: bout ? Math.round((Date.parse(`${weighInOn}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86_400_000) : 0,
        acuteLossLimitPct: bout?.acuteLossLimitPct ?? 8,
        acuteWindowDays: bout?.acuteWindowDays ?? 7,
    };
}

export async function listWeightAlerts(fighterIds: string[] | "all", now = new Date()): Promise<WeightAlert[]> {
    if (isDemoAuthEnabled()) {
        const { listDemoWeightAlerts } = await import("./bouts.demo");
        const alerts = listDemoWeightAlerts(fighterIds, now);
        return Promise.all(
            alerts.map(async (alert) => ({
                ...alert,
                fighterName: (await getFighter(alert.bout.fighterId))?.name ?? "Fighter",
            })),
        );
    }

    const bouts = (await listCampBouts()).filter((bout) => isRunningPhase(bout.phase) && (fighterIds === "all" || fighterIds.includes(bout.fighterId)));
    const rows = await Promise.all(
        bouts.map(async (bout) => {
            const track = await getWeightTrack(bout.id, now);
            if (!track || track.status === "GREEN") return null;
            const fighterName = (await getFighter(bout.fighterId))?.name ?? "Fighter";
            return { bout, fighterName, track, wayOff: 0 };
        }),
    );
    return rows
        .filter((row): row is WeightAlert => row !== null)
        .sort((a, b) => STATUS_ORDER[a.track.status] - STATUS_ORDER[b.track.status]);
}

export async function recordNutritionCheckin(fighterId: string, adherence: PlanAdherence, note: string | null, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) {
        const { recordDemoCheckin } = await import("./bouts.demo");
        return recordDemoCheckin(fighterId, adherence, note, now);
    }
    const bout = await getCurrentBout(fighterId);
    if (!bout) return { ok: false, message: "There is no upcoming bout to attach this answer to." };
    try {
        await authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(bout.id)}/nutrition-checkins`, z.unknown(), {
            method: "POST",
            body: JSON.stringify({ adherence, note, academyDate: dayKey(new Date(now.getTime() - 86_400_000)) }),
        });
        return { ok: true };
    } catch (error) {
        if (isUnavailable(error)) return { ok: false, message: "Plan check-ins are not available from the server yet." };
        throw error;
    }
}

export async function saveNutritionPlan(boutId: string, texts: Record<NutritionPhaseKey, string>, authorName: string, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) {
        const { saveDemoNutritionPlan } = await import("./bouts.demo");
        return saveDemoNutritionPlan(boutId, texts, authorName, now);
    }
    try {
        await authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(boutId)}/nutrition-plan`, z.unknown(), {
            method: "PUT",
            body: JSON.stringify({ ...texts, authorName }),
        });
        return { ok: true };
    } catch (error) {
        if (isUnavailable(error)) return { ok: false, message: "Meal plans are not available from the server yet." };
        throw error;
    }
}

export async function wayOffForBout(boutId: string, todayOn: string): Promise<number> {
    if (!isDemoAuthEnabled()) return 0;
    const { demoCheckinsFor } = await import("./bouts.demo");
    return wayOffCount(demoCheckinsFor(boutId), todayOn);
}

function isUnavailable(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
