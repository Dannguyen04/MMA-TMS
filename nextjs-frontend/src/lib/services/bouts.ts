import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { BoutOutcome, CampBout, CancelReason, CompetitionRuleset, NutritionPhaseKey, Suspension } from "@/lib/domain/bout";
import { boutLimitKg, isRunningPhase } from "@/lib/domain/bout";
import type { RequirementUpdate } from "@/lib/domain/bout-rules";
import { wayOffCount } from "@/lib/domain/nutrition";
import type { SuspensionDraft } from "@/lib/domain/suspension-rules";
import type { TrainingType, User } from "@/lib/domain/types";
import type { PlanAdherence, WeightStatus } from "@/lib/domain/weight-chart";
import type { WeightTrack } from "@/lib/domain/weight-track";
import type { WriteResult } from "@/lib/domain/write-result";
import { dayKey, daysBetweenKeys } from "@/lib/format";
import { nullIfServiceFails } from "./api-helpers";
import type { BoutEdit, CreateResult, FightWeekResult, NewBout, WeighInEntry } from "./bouts.demo";
import { getFighter } from "./people";
import { getPlan } from "./training";

export type { BoutEdit, CreateResult, FightWeekResult, NewBout, WeighInEntry } from "./bouts.demo";

/**
 * Bouts, their camp weight and checklist, and suspensions (T-003, T-004, T-006, T-007). Demo mode runs on
 * `bouts.demo.ts`. API mode reads the weight track and writes the meal plan; the rest of the bouts contract is
 * not served by the backend on this branch, so reads come back empty and writes say so instead of failing.
 */

export interface WeightAlert {
    bout: CampBout;
    fighterName: string;
    track: WeightTrack;
    wayOff: number;
}

const STATUS_ORDER: Record<WeightStatus, number> = { RED: 0, YELLOW: 1, GREY: 2, GREEN: 3 };

/** Writes the backend does not serve yet refuse with this, never with an exception that blanks the page. */
export const BOUTS_UNAVAILABLE = "Bouts are not available from the server yet.";

const unavailable = (message = BOUTS_UNAVAILABLE): WriteResult => ({ ok: false, message });

function actorOf(user: Pick<User, "name">) {
    return { name: user.name };
}

const demo = () => import("./bouts.demo");

const apiTrackSchema = z.object({
    limitKg: z.number().nullable(),
    points: z.array(z.object({ date: z.string(), kg: z.number() })),
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    remainingPct: z.number().nullable(),
    status: z.enum(["GREEN", "YELLOW", "RED", "GREY"]),
    referencePath: z.array(z.object({ date: z.string(), kg: z.number() })),
});

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export async function listRulesets(): Promise<CompetitionRuleset[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoRulesets();
    return [];
}

export async function getRuleset(id: string): Promise<CompetitionRuleset | null> {
    if (isDemoAuthEnabled()) return (await demo()).getDemoRuleset(id);
    return null;
}

/** Bouts of the fighters in scope, in any phase. */
export async function listCampBouts(fighterIds: string[] | "all" = "all"): Promise<CampBout[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoBouts(fighterIds);
    return [];
}

export async function getCampBout(boutId: string): Promise<CampBout | null> {
    if (isDemoAuthEnabled()) return (await demo()).getDemoBout(boutId);
    return null;
}

/** The fighter's running bout with the earliest weigh-in. */
export async function getCurrentBout(fighterId: string): Promise<CampBout | null> {
    if (isDemoAuthEnabled()) return (await demo()).getDemoCurrentBout(fighterId);
    const bouts = (await listCampBouts([fighterId])).filter((bout) => isRunningPhase(bout.phase));
    return bouts.sort((a, b) => (a.weighInAt < b.weighInAt ? -1 : 1))[0] ?? null;
}

export async function getWeightTrack(boutId: string, now = new Date()): Promise<WeightTrack | null> {
    if (isDemoAuthEnabled()) return (await demo()).demoWeightTrack(boutId, now);
    const raw = await nullIfServiceFails(authenticatedApiRequest(`/bouts/${encodeURIComponent(boutId)}/weight-track`, apiTrackSchema));
    if (!raw) return null;
    const bout = await getCampBout(boutId);
    const weighInOn = bout ? dayKey(bout.weighInAt) : (raw.latestOn ?? dayKey(now));
    return {
        limitKg: raw.limitKg ?? (bout ? boutLimitKg(bout) : null),
        points: raw.points,
        latestKg: raw.latestKg,
        latestOn: raw.latestOn,
        remainingPct: raw.remainingPct,
        status: raw.status,
        referencePath: raw.referencePath,
        weighInOn,
        daysToWeighIn: bout ? daysBetweenKeys(dayKey(now), weighInOn) : 0,
        acuteLossLimitPct: bout?.acuteLossLimitPct ?? 8,
        acuteWindowDays: bout?.acuteWindowDays ?? 7,
    };
}

/** Running bouts whose weight is red, yellow or grey, red first. */
export async function listWeightAlerts(fighterIds: string[] | "all", now = new Date()): Promise<WeightAlert[]> {
    if (isDemoAuthEnabled()) {
        const alerts = (await demo()).listDemoWeightAlerts(fighterIds, now);
        return Promise.all(alerts.map(async (alert) => ({ ...alert, fighterName: (await getFighter(alert.bout.fighterId))?.name ?? "Fighter" })));
    }

    const bouts = (await listCampBouts(fighterIds)).filter((bout) => isRunningPhase(bout.phase));
    const rows = await Promise.all(
        bouts.map(async (bout) => {
            const track = await getWeightTrack(bout.id, now);
            if (!track || track.status === "GREEN") return null;
            const fighterName = (await getFighter(bout.fighterId))?.name ?? "Fighter";
            return { bout, fighterName, track, wayOff: 0 };
        }),
    );
    return rows.filter((row): row is WeightAlert => row !== null).sort((a, b) => STATUS_ORDER[a.track.status] - STATUS_ORDER[b.track.status]);
}

export async function wayOffForBout(boutId: string, todayOn: string): Promise<number> {
    if (!isDemoAuthEnabled()) return 0;
    return wayOffCount((await demo()).demoCheckinsFor(boutId), todayOn);
}

export async function listSuspensions(fighterIds: string[] | "all"): Promise<Suspension[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoSuspensions(fighterIds);
    return [];
}

/** Start days of the fighter's earlier KO/TKO suspensions, hand-entered ones included (F7). */
export async function knockoutHistory(fighterId: string): Promise<string[]> {
    if (isDemoAuthEnabled()) return (await demo()).demoKnockoutHistory(fighterId);
    return [];
}

/** Gate 2: active suspensions that block this kind of session for the fighter on that academy day. */
export async function blockingSuspensions(fighterId: string, type: TrainingType, day: string): Promise<Suspension[]> {
    if (isDemoAuthEnabled()) return (await demo()).demoBlockingSuspensions(fighterId, type, day);
    return [];
}

/* ─── Weigh-ins, plan answers, meal plan (T-005, E1) ──────────────────────── */

export async function recordNutritionCheckin(fighterId: string, adherence: PlanAdherence, note: string | null, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoCheckin(fighterId, adherence, note, now);
    const bout = await getCurrentBout(fighterId);
    if (!bout) return { ok: false, message: "There is no upcoming bout to attach this answer to." };
    try {
        const academyDate = dayKey(new Date(now.getTime() - 86_400_000));
        await authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(bout.id)}/nutrition-checkins/${academyDate}`, z.unknown(), {
            method: "PUT",
            body: JSON.stringify({ adherence, note }),
        });
        return { ok: true };
    } catch (error) {
        if (isUnavailable(error)) return unavailable("Plan check-ins are not available from the server yet.");
        throw error;
    }
}

export async function saveNutritionPlan(boutId: string, texts: Record<NutritionPhaseKey, string>, authorName: string, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).saveDemoNutritionPlan(boutId, texts, authorName, now);
    try {
        await authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(boutId)}/nutrition-plan`, z.unknown(), {
            method: "PUT",
            body: JSON.stringify({ ...texts, authorName }),
        });
        return { ok: true };
    } catch (error) {
        if (isUnavailable(error)) return unavailable("Meal plans are not available from the server yet.");
        throw error;
    }
}

/* ─── Bout lifecycle (T-004) ──────────────────────────────────────────────── */

export async function createBout(input: NewBout, actor: User, now = new Date()): Promise<CreateResult> {
    if (isDemoAuthEnabled()) return (await demo()).createDemoBout(input, actorOf(actor), now);
    return { ok: false, message: BOUTS_UNAVAILABLE };
}

export async function updateBout(boutId: string, edit: BoutEdit, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).updateDemoBout(boutId, edit, actorOf(actor), now);
    return unavailable();
}

/** F2: the plan is read here so the store checks its fighter, phase and status. */
export async function linkCamp(boutId: string, trainingPlanId: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) {
        const plan = trainingPlanId ? await getPlan(trainingPlanId) : null;
        return (await demo()).linkDemoCamp(boutId, plan, actorOf(actor), now);
    }
    return unavailable();
}

export async function enterFightWeek(boutId: string, actor: User, now = new Date()): Promise<FightWeekResult> {
    if (isDemoAuthEnabled()) return (await demo()).enterDemoFightWeek(boutId, actorOf(actor), now);
    return { ok: false, message: BOUTS_UNAVAILABLE, lines: [] };
}

export async function cancelBout(boutId: string, reason: CancelReason, note: string | null, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).cancelDemoBout(boutId, reason, note, actorOf(actor), now);
    return unavailable();
}

export async function addRequirement(boutId: string, item: { label: string; required: boolean; validityDays: number | null }): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).addDemoRequirement(boutId, item);
    return unavailable();
}

export async function updateRequirement(boutId: string, code: string, update: RequirementUpdate): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).updateDemoRequirement(boutId, code, update);
    return unavailable();
}

export async function removeRequirement(boutId: string, code: string): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).removeDemoRequirement(boutId, code);
    return unavailable();
}

export async function unlockChecklist(boutId: string, reason: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).unlockDemoChecklist(boutId, reason, actorOf(actor), now);
    return unavailable();
}

/* ─── Official weigh-in, result, suspensions (T-006, T-007) ───────────────── */

export async function recordWeighIn(boutId: string, entry: WeighInEntry, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoWeighIn(boutId, entry, actorOf(actor), now);
    return unavailable();
}

export async function recordResult(boutId: string, outcome: BoutOutcome, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoResult(boutId, outcome, actorOf(actor), now);
    return unavailable();
}

export async function createSuspension(fighterId: string, boutId: string | null, draft: SuspensionDraft, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).createDemoSuspension(fighterId, boutId, draft, actorOf(actor), now);
    return unavailable("Suspensions are not available from the server yet.");
}

export async function clearSuspension(id: string, note: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).clearDemoSuspension(id, note, actorOf(actor), now);
    return unavailable("Suspensions are not available from the server yet.");
}

function isUnavailable(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
