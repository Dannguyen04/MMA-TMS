import type { CoachTodo, WeightFeasibility } from "@/lib/domain/types";
import { platformFeatureAvailable } from "./platform-features";
import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { authenticatedApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import type { BoutOutcome, CampBout, CancelReason, CompetitionRuleset, NutritionPhaseKey, Suspension } from "@/lib/domain/bout";
import { boutLimitKg, isRunningPhase } from "@/lib/domain/bout";
import { awaitsWeighInDecision, requirementCode, type RequirementUpdate } from "@/lib/domain/bout-rules";
import { wayOffCount } from "@/lib/domain/nutrition";
import { blockingSuspensions as findBlockingSuspensions, type SuspensionDraft } from "@/lib/domain/bout-suspension-rules";
import type { TrainingType, User } from "@/lib/domain/types";
import type { PlanAdherence, WeightStatus } from "@/lib/domain/weight-chart";
import type { WeightTrack } from "@/lib/domain/weight-track";
import type { WriteResult } from "@/lib/domain/write-result";
import { dayKey, daysBetweenKeys } from "@/lib/format";
import { nullIfServiceFails } from "./api-helpers";
import type { BoutEdit, CreateResult, FightWeekResult, NewBout, WeighInEntry } from "./bouts.demo";
import { getFighter, getUser } from "./people";
import { getPlan } from "./training";

export type { BoutEdit, CreateResult, FightWeekResult, NewBout, WeighInEntry } from "./bouts.demo";

/**
 * Bouts, their camp weight and checklist, and suspensions (T-003, T-004, T-006, T-007). Demo mode runs on
 * `bouts.demo.ts`. API mode calls the T-003 and T-006 contracts through `bouts.api.ts`; until the backend serves
 * them, reads come back empty and writes say so instead of failing. Suspensions (T-007) have no contract yet and
 * stay demo-only.
 */

export interface WeightAlert {
    bout: CampBout;
    fighterName: string;
    track: WeightTrack;
    wayOff: number;
}

const STATUS_ORDER: Record<WeightStatus, number> = { OVER_LIMIT: 0, ABOVE_TARGET: 1, NOT_WEIGHED: 2, ON_TRACK: 3, NEUTRAL: 4 };

/** Writes the backend does not serve yet refuse with this, never with an exception that blanks the page. */
export const BOUTS_UNAVAILABLE = "Bouts are not available from the server yet.";

const unavailable = (message = BOUTS_UNAVAILABLE): WriteResult => ({ ok: false, message });

function actorOf(user: Pick<User, "name">) {
    return { name: user.name };
}

const demo = () => import("./bouts.demo");
const api = () => import("./bouts.api");
const nutritionMock = () => import("./bouts.nutrition-mock");

const apiTrackSchema = z.object({
    limitKg: z.number().nullable(),
    points: z.array(z.object({ date: z.string(), kg: z.number() })),
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    remainingPct: z.number().nullable(),
    status: z.enum(["ON_TRACK", "ABOVE_TARGET", "OVER_LIMIT", "NOT_WEIGHED", "NEUTRAL"]),
    referencePath: z.array(z.object({ date: z.string(), kg: z.number() })),
});

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export async function listRulesets(): Promise<CompetitionRuleset[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoRulesets();
    return (await api()).listApiRulesets();
}

export async function getRuleset(id: string): Promise<CompetitionRuleset | null> {
    if (isDemoAuthEnabled()) return (await demo()).getDemoRuleset(id);
    return (await listRulesets()).find((item) => item.id === id) ?? null;
}

/** Bouts of the fighters in scope, in any phase. */
export async function listCampBouts(fighterIds: string[] | "all" = "all"): Promise<CampBout[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoBouts(fighterIds);
    const mock = await nutritionMock();
    return (await (await api()).listApiBouts(fighterIds)).map((bout) => ({ ...bout, nutritionPlan: mock.mockNutritionPlan(bout.id) }));
}

/** The service records who acted by account id. Coaches may not read other accounts, so those keep their id. */
async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const me = await getCurrentUser();
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const found = await Promise.all(
        unique.map((id) => (id === me?.id ? [id, me.name] as const : getUser(id).then((user) => user && ([id, user.name] as const), () => null))),
    );
    return new Map(found.filter((entry) => entry !== null));
}

export async function getCampBout(boutId: string): Promise<CampBout | null> {
    if (isDemoAuthEnabled()) return (await demo()).getDemoBout(boutId);
    const found = await (await api()).getApiBout(boutId);
    if (!found) return null;
    const names = await userNames(found.history.map((entry) => entry.by));
    const bout = {
        ...found,
        history: found.history.map((entry) => ({ ...entry, by: names.get(entry.by) ?? entry.by })),
        nutritionPlan: (await nutritionMock()).mockNutritionPlan(found.id),
    };
    if (bout.phase !== "FIGHT_WEEK" && bout.phase !== "WEIGHED_IN") return bout;
    return { ...bout, checklistUnlock: await readChecklistUnlock(bout.id) };
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
            if (!track || (track.status === "ON_TRACK" || track.status === "NEUTRAL")) return null;
            const fighterName = (await getFighter(bout.fighterId))?.name ?? "Fighter";
            return { bout, fighterName, track, wayOff: await wayOffForBout(bout.id, dayKey(now)) };
        }),
    );
    return rows.filter((row): row is WeightAlert => row !== null).sort((a, b) => STATUS_ORDER[a.track.status] - STATUS_ORDER[b.track.status]);
}

export async function wayOffForBout(boutId: string, todayOn: string): Promise<number> {
    if (isDemoAuthEnabled()) return wayOffCount((await demo()).demoCheckinsFor(boutId), todayOn);
    return wayOffCount((await nutritionMock()).mockCheckins(boutId), todayOn);
}

export async function listSuspensions(fighterIds: string[] | "all"): Promise<Suspension[]> {
    if (isDemoAuthEnabled()) return (await demo()).listDemoSuspensions(fighterIds);
    const list = await (await api()).listApiSuspensions(fighterIds);
    const names = await userNames(list.flatMap((item) => [item.createdBy, item.clearedBy]));
    const named = (id: string | null) => (id ? (names.get(id) ?? id) : id);
    return list.map((item) => ({ ...item, createdBy: named(item.createdBy) ?? item.createdBy, clearedBy: named(item.clearedBy) }));
}

/** Start days of the fighter's earlier KO/TKO suspensions, hand-entered ones included (F7). */
export async function knockoutHistory(fighterId: string): Promise<string[]> {
    if (isDemoAuthEnabled()) return (await demo()).demoKnockoutHistory(fighterId);
    return (await listSuspensions([fighterId])).filter((item) => item.reason === "KO" || item.reason === "TKO").map((item) => item.startsOn);
}

/** Gate 2: active suspensions that block this kind of session for the fighter on that academy day. */
export async function blockingSuspensions(fighterId: string, type: TrainingType, day: string): Promise<Suspension[]> {
    if (isDemoAuthEnabled()) return (await demo()).demoBlockingSuspensions(fighterId, type, day);
    return findBlockingSuspensions(await listSuspensions([fighterId]), fighterId, type, day);
}

/* ─── Weigh-ins, plan answers, meal plan (T-005, E1) ──────────────────────── */

export async function recordNutritionCheckin(fighterId: string, adherence: PlanAdherence, note: string | null, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoCheckin(fighterId, adherence, note, now);
    const bout = await getCurrentBout(fighterId);
    if (!bout) return { ok: false, message: "There is no upcoming bout to attach this answer to." };
    const loggedOn = dayKey(now);
    (await nutritionMock()).recordMockCheckin(bout.id, dayKey(new Date(now.getTime() - 86_400_000)), loggedOn, adherence, note, now);
    return { ok: true };
}

/** The bouts service has no meal plan yet: API mode keeps it in this server's memory (`bouts.nutrition-mock.ts`). */
export async function saveNutritionPlan(boutId: string, texts: Record<NutritionPhaseKey, string>, authorName: string, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).saveDemoNutritionPlan(boutId, texts, authorName, now);
    const bout = await getCampBout(boutId);
    if (!bout) return unavailable();
    if (!isRunningPhase(bout.phase)) return { ok: false, message: "This bout is over, so its meal plan can no longer change." };
    (await nutritionMock()).saveMockNutritionPlan(boutId, texts, authorName, now);
    return { ok: true };
}

/* ─── Bout lifecycle (T-004) ──────────────────────────────────────────────── */

export async function createBout(input: NewBout, actor: User, now = new Date()): Promise<CreateResult> {
    if (isDemoAuthEnabled()) return (await demo()).createDemoBout(input, actorOf(actor), now);
    return (await api()).createApiBout(input, await usesCustomLimit(input.rulesetId));
}

export async function updateBout(boutId: string, edit: BoutEdit, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).updateDemoBout(boutId, edit, actorOf(actor), now);
    const bout = await getCampBout(boutId);
    return (await api()).updateApiBout(boutId, edit, bout ? await usesCustomLimit(bout.rulesetId) : false);
}

/** F2: the plan is read here so the store checks its fighter, phase and status. */
export async function linkCamp(boutId: string, trainingPlanId: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) {
        const plan = trainingPlanId ? await getPlan(trainingPlanId) : null;
        return (await demo()).linkDemoCamp(boutId, plan, actorOf(actor), now);
    }
    return (await api()).linkApiCamp(boutId, trainingPlanId);
}

export async function enterFightWeek(boutId: string, actor: User, now = new Date()): Promise<FightWeekResult> {
    if (isDemoAuthEnabled()) return (await demo()).enterDemoFightWeek(boutId, actorOf(actor), now);
    return (await api()).enterApiFightWeek(boutId);
}

export async function cancelBout(boutId: string, reason: CancelReason, note: string | null, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).cancelDemoBout(boutId, reason, note, actorOf(actor), now);
    return (await api()).cancelApiBout(boutId, note ? `${reason}: ${note}` : reason);
}

export async function addRequirement(boutId: string, item: { label: string; required: boolean; validityDays: number | null }): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).addDemoRequirement(boutId, item);
    const bout = await getCampBout(boutId);
    const code = requirementCode(item.label, bout?.requirements.map((requirement) => requirement.code) ?? []);
    return (await api()).addApiRequirement(boutId, { code, ...item }, bout?.checklistUnlock?.reason ?? null);
}

export async function updateRequirement(boutId: string, code: string, update: RequirementUpdate): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).updateDemoRequirement(boutId, code, update);
    return (await api()).updateApiRequirement(boutId, code, update, await unlockReasonFor(boutId));
}

export async function removeRequirement(boutId: string, code: string): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).removeDemoRequirement(boutId, code);
    return (await api()).removeApiRequirement(boutId, code, await unlockReasonFor(boutId));
}

/**
 * F5 in API mode: the service keeps no "unlocked" state, it wants a reason with every checklist change in fight
 * week (T-006 §2). The coach's reason is kept for an hour in a cookie for this bout, and goes with each change.
 * Call from a Server Action only, where cookies can be set.
 */
export async function unlockChecklist(boutId: string, reason: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).unlockDemoChecklist(boutId, reason, actorOf(actor), now);
    const bout = await getCampBout(boutId);
    if (!bout) return unavailable();
    if (bout.phase !== "FIGHT_WEEK" && bout.phase !== "WEIGHED_IN") return { ok: false, message: "Only a fight-week checklist is locked." };
    const value = Buffer.from(JSON.stringify({ at: now.toISOString(), by: actor.name, reason })).toString("base64url");
    (await cookies()).set(unlockCookie(boutId), value, { path: "/", sameSite: "lax", httpOnly: true, maxAge: UNLOCK_SECONDS });
    return { ok: true };
}

/* ─── Official weigh-in, result, suspensions (T-006, T-007) ───────────────── */

export async function recordWeighIn(boutId: string, entry: WeighInEntry, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoWeighIn(boutId, entry, actorOf(actor), now);
    // A miss the service already holds (the coach left before deciding) is not weighed again.
    const bout = await getCampBout(boutId);
    const recorded =
        bout !== null &&
        awaitsWeighInDecision(bout) &&
        bout.weighIn?.weightKg === entry.weightKg &&
        (bout.weighIn.hydrationCheck ?? "NOT_APPLICABLE") === (entry.hydrationCheck ?? "NOT_APPLICABLE");
    return (await api()).recordApiWeighIn(boutId, entry, recorded);
}

export async function recordResult(boutId: string, outcome: BoutOutcome, actor: User, now = new Date(), suspensionDays: number | null = null): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).recordDemoResult(boutId, outcome, actorOf(actor), now);
    return (await api()).recordApiResult(boutId, outcome, suspensionDays);
}

export async function createSuspension(fighterId: string, boutId: string | null, draft: SuspensionDraft, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).createDemoSuspension(fighterId, boutId, draft, actorOf(actor), now);
    // The service creates a bout's KO or TKO suspension with the result; what the coach adds here is entered by hand.
    const bout = boutId ? await getCampBout(boutId) : null;
    return (await api()).createApiSuspension(fighterId, draft, bout?.outcome?.lossOfConsciousness ?? null);
}

export async function clearSuspension(id: string, note: string, actor: User, now = new Date()): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demo()).clearDemoSuspension(id, note, actorOf(actor), now);
    return (await api()).clearApiSuspension(id, note);
}

/* ─── Checklist unlock in API mode (T-006 §2) ─────────────────────────────── */

const UNLOCK_SECONDS = 60 * 60;
const unlockCookie = (boutId: string) => `mma_checklist_unlock_${boutId}`;
const unlockSchema = z.object({ at: z.string(), by: z.string(), reason: z.string().min(1) });

/** The coach's reason for reopening this bout's checklist, while the cookie lasts. */
async function readChecklistUnlock(boutId: string): Promise<CampBout["checklistUnlock"]> {
    const raw = (await cookies()).get(unlockCookie(boutId))?.value;
    if (!raw) return null;
    try {
        const parsed = unlockSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** The reason to send with a checklist change: only in fight week, where the service asks for one. */
async function unlockReasonFor(boutId: string): Promise<string | null> {
    const bout = await getCampBout(boutId);
    return bout?.checklistUnlock?.reason ?? null;
}

/** A ruleset without classes ("Tự nhập") takes the coach's own limit in kg instead of a class code. */
async function usesCustomLimit(rulesetId: string): Promise<boolean> {
    const ruleset = await getRuleset(rulesetId);
    return !ruleset || ruleset.weightClasses.length === 0;
}

/** Camp weight status; the suspensions service reads it on the readiness board too. */
export const weightWarningStatusSchema = z.enum(["ON_TRACK", "ABOVE_TARGET", "OVER_LIMIT", "NOT_WEIGHED", "NEUTRAL"]);
export const feasibilitySchema = z.object({
    status: weightWarningStatusSchema,
    remainingPct: z.number().nullable(),
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    daysToWeighIn: z.number(),
    limitKg: z.number(),
    acuteLossLimitPct: z.number(),
    warnings: z.array(z.object({ code: z.enum(["WEIGHT_AT_RISK", "WEIGHT_INSUFFICIENT_DATA"]) })),
});

export const coachTodoSchema = z.object({
    items: z.array(
        z.object({
            source: z.enum([
                "REQUIREMENTS_DUE",
                "REQUIREMENTS_OVERDUE",
                "WEIGHT_OVER_LIMIT",
                "WEIGHT_ABOVE_TARGET",
                "WEIGHT_NOT_WEIGHED",
                "TACTICS_WITHOUT_SESSIONS",
                "CAN_ENTER_FIGHT_WEEK",
                "WEIGH_IN_TODAY",
                "RESULT_OVERDUE",
                "WEIGHT_NOT_LOGGED",
                "SUSPENSION_AWAITING_CLEARANCE",
                "TRAINING_CONFLICTS_WITH_SUSPENSION",
            ]),
            phase: z.enum(["BEFORE", "DURING", "AFTER"]),
            fighterId: z.string(),
            boutId: z.string(),
            eventName: z.string(),
            dueOn: z.string().nullable(),
            count: z.number().nullable(),
        }),
    ),
    truncated: z.boolean(),
});


export interface FeasibilityInput {
    fighterId: string;
    rulesetId: string;
    weightClassCode: string;
    weightLimitKg: number;
    weighInAt: string;
    boutAt: string;
}


export async function getFeasibility(input: FeasibilityInput): Promise<WeightFeasibility | null> {
    if (isDemoAuthEnabled()) return (await demo()).getFeasibility(input);
    if (!platformFeatureAvailable("bouts")) return null;

    const params = new URLSearchParams({
        fighterId: input.fighterId,
        rulesetId: input.rulesetId,
        weightClassCode: input.weightClassCode,
        weightLimitKg: String(input.weightLimitKg),
        weighInAt: input.weighInAt,
        boutAt: input.boutAt,
    });
    return authenticatedApiRequest(`/bouts/feasibility?${params.toString()}`, feasibilitySchema);
}

/** The coach's to-do card. The backend scopes it to the signed-in coach; demo mode reads `scope`. */
export async function getCoachTodo(scope: string[] | "all"): Promise<CoachTodo | null> {
    if (isDemoAuthEnabled()) return (await demo()).getCoachTodo(scope);
    if (!platformFeatureAvailable("bouts")) return null;

    return authenticatedApiRequest("/coach/todo", coachTodoSchema);
}
