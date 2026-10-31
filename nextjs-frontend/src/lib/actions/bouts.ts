"use server";

import { z } from "zod";
import type { WeightFeasibility } from "@/lib/domain/types";
import { getFeasibility as getFeasibilityService } from "@/lib/services/bouts";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { actionError, actionSuccess, type ActionState } from "@/lib/actions/state";
import { CANCEL_REASONS, SCHEDULED_ROUND_CHOICES, type CampBout, type CancelReason, type HydrationCheck, type NutritionPhaseKey, type SuspensionReason } from "@/lib/domain/bout";
import {
    canEnterFightWeek,
    HYDRATION_CHECKS,
    passesWeighIn,
    NOTES_MAX,
    readCatchweight,
    readDueDays,
    readOfficialWeight,
    validateBoutSchedule,
    validateNewRequirement,
    validateOutcome,
    validateRequirementUpdate,
    type BoutScheduleInput,
    type FightWeekCheck,
    type Gate1Gap,
} from "@/lib/domain/bout-rules";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { readPlanAnswer, readPlanAuthor, readPlanText } from "@/lib/domain/nutrition";
import { readClearanceNote, suggestSuspension, suspensionReasonFor, validateSuspension, MANUAL_SUSPENSION_REASONS, SUSPENSION_REASONS } from "@/lib/domain/bout-suspension-rules";
import type { TrainingType, User } from "@/lib/domain/types";
import { parseSelfWeight } from "@/lib/domain/weight-input";
import { dayKey, formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import {
    BOUTS_UNAVAILABLE,
    addRequirement,
    cancelBout,
    clearSuspension,
    createBout,
    createSuspension,
    enterFightWeek,
    getCampBout,
    getCurrentBout,
    getRuleset,
    getWeightTrack,
    knockoutHistory,
    linkCamp,
    listSuspensions,
    recordNutritionCheckin,
    recordResult,
    recordWeighIn,
    removeRequirement,
    saveNutritionPlan,
    unlockChecklist,
    updateBout,
    updateRequirement,
} from "@/lib/services/bouts";
import { getFighter, recordSelfWeight } from "@/lib/services/people";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const REASON_MAX = 300;

/** The bouts service answers in English; this recognises its words before they are said again in the viewer's language. */
const english = createTranslator("en");

/** What blocks fight week, one line per item, shown as a list beside the button. */
export interface BlockedLines {
    lines: string[];
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

/** The bout named in the form, if it is on this coach's roster. Pages answer 404 for the same check. */
async function coachBout(formData: FormData, t: Translator): Promise<{ user: User; bout: CampBout } | { error: ActionState<never> }> {
    const user = await requireRole("coach");
    const boutId = text(formData, "boutId");
    const bout = boutId ? await getCampBout(boutId) : null;
    if (!bout || !canAccessFighter(user, bout.fighterId)) return { error: actionError(t("boutMsg.common.notOnRoster")) };
    return { user, bout };
}

/** A refusal from the bouts service in the viewer's language when the action knows it; the server's own words stay as they came. */
function serviceMessage(message: string, t: Translator): string {
    return message === BOUTS_UNAVAILABLE ? t("boutMsg.service.unavailable") : message;
}

function gateLine(gap: Gate1Gap, t: Translator): string {
    return t("boutMsg.fightWeek.line", { label: gap.requirement.label, reason: t(`boutLabel.gate1Reason.${gap.reason}`) });
}

function fightWeekBlock(check: Extract<FightWeekCheck, { ok: false }>, t: Translator, locale: Locale): string {
    if (check.reason === "NOT_IN_CAMP") return t("boutMsg.fightWeek.notInCamp");
    if (check.reason === "TOO_EARLY") return t("boutMsg.fightWeek.tooEarly", { date: formatDate(check.opensOn, locale) });
    return t("boutMsg.fightWeek.gate1Closed");
}

/**
 * The service explains a fight-week refusal in English. Where its words are the ones this bout's own Gate 1 check
 * gives, they are said again in the viewer's language; anything else stays as it came.
 */
function fightWeekRefusal(bout: CampBout, refusal: { message: string; lines: string[] }, t: Translator, locale: Locale): { message: string; lines: string[] } {
    const check = canEnterFightWeek(bout, dayKey(new Date()));
    const missing = check.ok ? [] : check.missing;
    const lines = refusal.lines.map((line) => {
        const gap = missing.find((item) => gateLine(item, english) === line);
        return gap ? gateLine(gap, t) : line;
    });
    const known = !check.ok && refusal.message === fightWeekBlock(check, english, "en");
    return { message: known ? fightWeekBlock(check, t, locale) : serviceMessage(refusal.message, t), lines };
}

/** Every page that shows a bout, its weight or its fighter's camp. */
function revalidateBout(bout: Pick<CampBout, "id">) {
    revalidatePath(routes.coach.bouts);
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.bout(bout.id));
    revalidatePath(routes.coach.dashboard);
    revalidatePath(routes.fighter.bout);
    revalidatePath(routes.fighter.dashboard);
}

function scheduleInput(formData: FormData): BoutScheduleInput {
    return {
        event: text(formData, "event"),
        venue: text(formData, "venue"),
        opponent: text(formData, "opponent"),
        weightClassCode: text(formData, "weightClassCode"),
        weightLimitKg: text(formData, "weightLimitKg"),
        weighInAt: text(formData, "weighInAt"),
        boutAt: text(formData, "boutAt"),
    };
}

/* ─── Fighter: daily weight and plan answer (T-005, E1) ───────────────────── */

/** Saves today's kilograms. The plan question is optional and never blocks a blank skip. */
export async function recordWeightAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const user = await requireRole("fighter");
    if (!user.profileId) return actionError(t("boutMsg.action.profileMissing"));

    const parsed = parseSelfWeight(text(formData, "weightKg"), t);
    if (!parsed.ok) return actionError(t("form.fixFields"), { weightKg: parsed.message });

    const answer = readPlanAnswer(text(formData, "adherence"), text(formData, "note"), t);
    if (!answer.ok) return actionError(t("form.fixFields"), { [answer.field]: answer.message });

    try {
        await recordSelfWeight(user.profileId, parsed.kg);
        if (answer.adherence) await recordNutritionCheckin(user.profileId, answer.adherence, answer.note);
    } catch (error) {
        if (error instanceof ApiError) return actionError(error.message);
        throw error;
    }

    const bout = await getCurrentBout(user.profileId);
    const track = bout ? await getWeightTrack(bout.id) : null;
    revalidatePath(routes.fighter.dashboard);
    revalidatePath(routes.fighter.bout);
    revalidatePath(routes.coach.dashboard);
    revalidatePath(routes.coach.bouts);
    if (bout) revalidatePath(routes.coach.bout(bout.id));

    const params = new URLSearchParams({ saved: parsed.kg.toFixed(1) });
    if (track) params.set("status", track.status);
    redirect(bout ? `${routes.fighter.bout}?${params}` : `${routes.fighter.dashboard}?${params}`);
}

/* ─── Coach: meal plan (E1) ───────────────────────────────────────────────── */

/** Saves the three phase notes a coach typed. Empty text clears that phase. */
export async function saveNutritionPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const { user, bout } = found;

    const author = readPlanAuthor(text(formData, "authorName"), user.name, t);
    if (!author.ok) return actionError(t("form.fixFields"), { authorName: author.message });

    const texts = {} as Record<NutritionPhaseKey, string>;
    const fieldErrors: Record<string, string> = {};
    for (const phase of PHASES) {
        const value = readPlanText(text(formData, phase), t);
        if (!value.ok) fieldErrors[phase] = value.message;
        else texts[phase] = value.text;
    }
    if (Object.keys(fieldErrors).length > 0) return actionError(t("form.fixFields"), fieldErrors);

    const result = await saveNutritionPlan(bout.id, texts, author.authorName);
    if (!result.ok) return actionError(serviceMessage(result.message, t));

    revalidatePath(routes.coach.bout(bout.id));
    revalidatePath(routes.fighter.bout);
    redirect(`${routes.coach.bout(bout.id)}?notice=plan`);
}

/* ─── Coach: bout lifecycle (T-004) ───────────────────────────────────────── */

/** F1: create a scheduled bout for a fighter on this coach's roster, then open it. */
export async function createBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const user = await requireRole("coach");
    const fieldErrors: Record<string, string> = {};

    const fighterId = text(formData, "fighterId");
    const fighter = fighterId && canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    if (!fighter) fieldErrors.fighterId = t("boutMsg.common.fighterRequired");

    const ruleset = await getRuleset(text(formData, "rulesetId"));
    if (!ruleset) fieldErrors.rulesetId = t("boutMsg.action.rulesetRequired");

    const schedule = validateBoutSchedule(scheduleInput(formData), ruleset ?? { weightClasses: [] }, new Date(), {}, t);
    if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
    // Without a ruleset there is no class list to check against yet.
    if (!ruleset) delete fieldErrors.weightLimitKg;
    if (Object.keys(fieldErrors).length > 0 || !fighter || !ruleset || !schedule.ok) return actionError(t("form.fixFields"), fieldErrors);

    const result = await createBout(
        {
            fighterId: fighter.id,
            fighterName: fighter.name,
            rulesetId: ruleset.id,
            event: schedule.value.event,
            venue: schedule.value.venue,
            opponent: schedule.value.opponent,
            weightClass: schedule.value.weightClass,
            weighInAt: schedule.value.weighInAt,
            boutAt: schedule.value.boutAt,
            scheduledRounds: SCHEDULED_ROUND_CHOICES.find((n) => String(n) === text(formData, "scheduledRounds")) ?? null,
            coachId: user.profileId ?? user.id,
        },
        user,
    );
    if (!result.ok) return actionError(serviceMessage(result.message, t), result.fieldErrors);

    revalidateBout({ id: result.boutId });
    redirect(`${routes.coach.bout(result.boutId)}?notice=${result.warning ? "created-suspended" : "created"}`);
}

/** F8: event details any time before a result; dates, class and the deadline until the official weigh-in. */
export async function updateBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const { user, bout } = found;
    const ruleset = await getRuleset(bout.rulesetId);
    if (!ruleset) return actionError(t("boutMsg.action.rulesetGone"));

    const fieldErrors: Record<string, string> = {};
    const schedule = validateBoutSchedule(scheduleInput(formData), ruleset, new Date(), { allowPastBoutAt: bout.boutAt }, t);
    if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
    const dueDays = readDueDays(text(formData, "requirementsDueDays"), t);
    if (!dueDays.ok) fieldErrors.requirementsDueDays = dueDays.message;
    const notes = text(formData, "notes").trim();
    if (notes.length > NOTES_MAX) fieldErrors.notes = t("boutMsg.action.notesTooLong", { max: NOTES_MAX });
    const changeReason = text(formData, "changeReason").trim();
    if (changeReason.length > REASON_MAX) fieldErrors.changeReason = t("boutMsg.common.reasonTooLong", { max: REASON_MAX });
    if (Object.keys(fieldErrors).length > 0 || !schedule.ok || !dueDays.ok) return actionError(t("form.fixFields"), fieldErrors);

    const result = await updateBout(
        bout.id,
        {
            event: schedule.value.event,
            venue: schedule.value.venue,
            opponent: schedule.value.opponent,
            notes: notes || null,
            weightClass: schedule.value.weightClass,
            weighInAt: schedule.value.weighInAt,
            boutAt: schedule.value.boutAt,
            requirementsDueDays: dueDays.value,
            changeReason: changeReason || null,
        },
        user,
    );
    if (!result.ok) return actionError(serviceMessage(result.message, t), result.fieldErrors);
    revalidateBout(bout);
    return actionSuccess(t("boutMsg.action.updated"));
}

/** F2: link a fight-camp plan of the same fighter; the bout moves to camp. */
export async function linkCampAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const planId = text(formData, "trainingPlanId");
    if (!planId) return actionError(t("form.fixFields"), { trainingPlanId: t("boutMsg.action.campPlanRequired") });
    const result = await linkCamp(found.bout.id, planId, found.user);
    if (!result.ok) return actionError(serviceMessage(result.message, t), result.fieldErrors);
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.campStarted"));
}

/** CAMP → FIGHT_WEEK through Gate 1. A refusal keeps the bout in camp and lists what is missing. */
export async function enterFightWeekAction(_prev: ActionState<BlockedLines>, formData: FormData): Promise<ActionState<BlockedLines>> {
    const { t, locale } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const result = await enterFightWeek(found.bout.id, found.user);
    if (!result.ok) {
        const refusal = fightWeekRefusal(found.bout, result, t, locale);
        return { status: "error", message: refusal.message, data: { lines: refusal.lines } };
    }
    revalidateBout(found.bout);
    redirect(`${routes.coach.bout(found.bout.id)}?notice=fight-week`);
}

export async function cancelBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const reason = text(formData, "reason") as CancelReason;
    const note = text(formData, "note").trim();
    const fieldErrors: Record<string, string> = {};
    if (!(CANCEL_REASONS as readonly string[]).includes(reason)) fieldErrors.reason = t("boutMsg.action.cancelReasonRequired");
    if (reason === "OTHER" && !note) fieldErrors.note = t("boutMsg.action.cancelNoteRequired");
    if (note.length > REASON_MAX) fieldErrors.note = t("boutMsg.common.noteTooLong", { max: REASON_MAX });
    if (Object.keys(fieldErrors).length > 0) return actionError(t("form.fixFields"), fieldErrors);
    const result = await cancelBout(found.bout.id, reason, note || null, found.user);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.cancelled"));
}

/* ─── Coach: medical checklist (F4) ───────────────────────────────────────── */

export async function addRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const item = validateNewRequirement(
        { label: text(formData, "label"), required: formData.get("required") === "on", validityDays: text(formData, "validityDays") },
        found.bout.requirements.map((requirement) => requirement.label),
        t,
    );
    if (!item.ok) return actionError(t("form.fixFields"), item.fieldErrors);
    const result = await addRequirement(found.bout.id, item.value);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.requirementAdded", { label: item.value.label }));
}

export async function updateRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const code = text(formData, "code");
    const item = found.bout.requirements.find((requirement) => requirement.code === code);
    if (!item) return actionError(t("boutMsg.action.requirementGone"));
    const update = validateRequirementUpdate(
        {
            state: text(formData, "state"),
            issuedOn: text(formData, "issuedOn"),
            validUntil: text(formData, "validUntil"),
            statusReason: text(formData, "statusReason"),
        },
        t,
    );
    if (!update.ok) return actionError(t("form.fixFields"), update.fieldErrors);
    const result = await updateRequirement(found.bout.id, code, update.value);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.requirementUpdated", { label: item.label }));
}

/** For `useConfirmAction`: removes one item, by code. */
export async function removeRequirementAction(payload: { boutId: string; code: string }): Promise<ActionState> {
    const { t } = await getTranslator();
    const formData = new FormData();
    formData.set("boutId", payload.boutId);
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const result = await removeRequirement(found.bout.id, payload.code);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.requirementRemoved"));
}

/** F5: in fight week the checklist is locked; reopening it needs a reason. */
export async function unlockChecklistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const reason = text(formData, "reason").trim();
    if (!reason) return actionError(t("form.fixFields"), { reason: t("boutMsg.action.unlockReasonRequired") });
    if (reason.length > REASON_MAX) return actionError(t("form.fixFields"), { reason: t("boutMsg.common.reasonTooLong", { max: REASON_MAX }) });
    const result = await unlockChecklist(found.bout.id, reason, found.user);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    return actionSuccess(t("boutMsg.action.checklistUnlocked"));
}

/* ─── Coach: official weigh-in and result (T-006) ─────────────────────────── */

export async function recordWeighInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const { bout } = found;
    const fieldErrors: Record<string, string> = {};

    const weight = readOfficialWeight(text(formData, "weightKg"), t);
    if (!weight.ok) fieldErrors.weightKg = weight.message;
    const hydrationRaw = text(formData, "hydrationCheck");
    const hydrationCheck = (HYDRATION_CHECKS as readonly string[]).includes(hydrationRaw) ? (hydrationRaw as HydrationCheck) : null;
    if (hydrationRaw && !hydrationCheck) fieldErrors.hydrationCheck = t("boutMsg.action.hydrationInvalid");

    const limit = bout.catchweightKg ?? bout.limitKg;
    const made = weight.ok ? passesWeighIn(weight.kg, limit, hydrationCheck) : true;
    const decisionRaw = text(formData, "decision");
    const decision = decisionRaw === "CATCHWEIGHT" || decisionRaw === "CANCEL" ? decisionRaw : null;
    let catchweightKg: number | null = null;
    const note = text(formData, "note").trim();
    if (!made) {
        if (!decision) fieldErrors.decision = t("boutMsg.action.missedDecision");
        if (decision === "CATCHWEIGHT") {
            const catchweight = readCatchweight(text(formData, "catchweightKg"), t);
            if (!catchweight.ok) fieldErrors.catchweightKg = catchweight.message;
            else if (weight.ok && catchweight.kg < weight.kg) fieldErrors.catchweightKg = t("boutMsg.action.catchweightBelow");
            // T-006 §3: the service only takes a catchweight above the original limit.
            else if (bout.limitKg !== null && catchweight.kg <= bout.limitKg)
                fieldErrors.catchweightKg = t("boutMsg.action.catchweightAboveLimit", { kg: formatNumber(bout.limitKg, 1) });
            else catchweightKg = catchweight.kg;
            if (!note) fieldErrors.note = t("boutMsg.action.catchweightNote");
        }
    }
    if (note.length > REASON_MAX) fieldErrors.note = t("boutMsg.common.noteTooLong", { max: REASON_MAX });
    if (Object.keys(fieldErrors).length > 0 || !weight.ok) return actionError(t("form.fixFields"), fieldErrors);

    const result = await recordWeighIn(bout.id, { weightKg: weight.kg, hydrationCheck, decision: made ? null : decision, catchweightKg, note: note || null }, found.user);
    // Even a refusal may follow a saved weigh-in (the service holds a miss until the coach decides).
    revalidateBout(bout);
    if (!result.ok) return actionError(serviceMessage(result.message, t), result.fieldErrors);
    return actionSuccess(
        made ? t("boutMsg.action.madeWeight") : decision === "CANCEL" ? t("boutMsg.action.cancelledMissedWeight") : t("boutMsg.action.weighedInCatchweight"),
    );
}

export async function recordResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const found = await coachBout(formData, t);
    if ("error" in found) return found.error;
    const outcome = validateOutcome(
        {
            result: text(formData, "result"),
            method: text(formData, "method"),
            round: text(formData, "round"),
            knockedDown: text(formData, "knockedDown") === "yes",
            lossOfConsciousness: text(formData, "lossOfConsciousness"),
            stoppedByHeadStrikes: text(formData, "stoppedByHeadStrikes"),
            injuryNote: text(formData, "injuryNote"),
            notes: text(formData, "notes"),
        },
        found.bout.sport,
        new Date().toISOString(),
        t,
    );
    if (!outcome.ok) return actionError(t("form.fixFields"), outcome.fieldErrors);
    let suspensionDays: number | null = null;
    const daysText = text(formData, "suspensionDays");
    if (daysText && suspensionReasonFor(outcome.value)) {
        suspensionDays = Number(daysText);
        if (!Number.isInteger(suspensionDays) || suspensionDays < 1 || suspensionDays > 365) {
            return actionError(t("form.fixFields"), { suspensionDays: t("boutMsg.action.suspensionDaysRange") });
        }
    }
    const result = await recordResult(found.bout.id, outcome.value, found.user, new Date(), suspensionDays);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidateBout(found.bout);
    revalidatePath(routes.coach.sessions);
    return actionSuccess(t("boutMsg.action.resultRecorded"));
}

/* ─── Coach: suspensions and Gate 2 (T-007) ───────────────────────────────── */

/**
 * After a result (`boutId` set), or by hand for a fighter on the roster. The suggestion is worked out again here
 * from the ruleset and the fighter's knockout history, never taken from the form.
 */
export async function createSuspensionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const user = await requireRole("coach");
    const boutId = text(formData, "boutId");
    let fighterId = text(formData, "fighterId");
    let suggestedDays: number | null = null;
    let allowed: readonly SuspensionReason[] = MANUAL_SUSPENSION_REASONS;

    if (boutId) {
        const bout = await getCampBout(boutId);
        if (!bout || !canAccessFighter(user, bout.fighterId)) return actionError(t("boutMsg.common.notOnRoster"));
        if (bout.phase !== "COMPLETED" || !bout.outcome) return actionError(t("boutMsg.action.resultFirst"));
        fighterId = bout.fighterId;
        const reason = suspensionReasonFor(bout.outcome);
        allowed = reason ? [reason] : SUSPENSION_REASONS;
        const ruleset = await getRuleset(bout.rulesetId);
        if (reason && ruleset) {
            const suggestion = suggestSuspension(ruleset.suspensionRules, {
                reason,
                lossOfConsciousness: bout.outcome.lossOfConsciousness,
                priorKnockoutStarts: await knockoutHistory(bout.fighterId),
                on: dayKey(bout.boutAt),
            });
            suggestedDays = suggestion?.days ?? null;
        }
    } else if (!fighterId || !canAccessFighter(user, fighterId)) {
        return actionError(t("form.fixFields"), { fighterId: t("boutMsg.common.fighterRequired") });
    }

    const draft = validateSuspension(
        {
            reason: text(formData, "reason"),
            startsOn: text(formData, "startsOn"),
            days: text(formData, "days"),
            suggestedDays,
            overrideReason: text(formData, "overrideReason"),
            blockedSessionTypes: formData.getAll("blockedSessionTypes").map(String),
            requiresClearance: formData.get("requiresClearance") === "on",
            note: text(formData, "note"),
        },
        allowed,
        TRAINING_TYPES,
        t,
    );
    if (!draft.ok) return actionError(t("form.fixFields"), draft.fieldErrors);
    const result = await createSuspension(fighterId, boutId || null, draft.value, user);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    if (boutId) revalidateBout({ id: boutId });
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.sessions);
    return actionSuccess(t("boutMsg.action.suspensionSaved"));
}

/** F7: after the last suspended day, a coach confirms the fighter may train again and writes the basis. */
export async function clearSuspensionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const user = await requireRole("coach");
    const id = text(formData, "suspensionId");
    const suspension = (await listSuspensions("all")).find((item) => item.id === id);
    if (!suspension || !canAccessFighter(user, suspension.fighterId)) return actionError(t("boutMsg.action.suspensionNotOnRoster"));
    const note = readClearanceNote(text(formData, "clearanceNote"), t);
    if (!note.ok) return actionError(t("form.fixFields"), { clearanceNote: note.message });
    const result = await clearSuspension(id, note.value, user);
    if (!result.ok) return actionError(serviceMessage(result.message, t));
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.sessions);
    if (suspension.boutId) revalidatePath(routes.coach.bout(suspension.boutId));
    return actionSuccess(t("boutMsg.action.cleared"));
}

const feasibilityInputSchema = z.object({
    fighterId: z.string().min(1),
    rulesetId: z.string().min(1),
    weightClassCode: z.string().min(1),
    weightLimitKg: z.number().finite().min(30).max(200),
    weighInAt: z.string().min(1),
    boutAt: z.string().min(1),
});

/**
 * Read-only: how far the fighter's latest weight is from the class, for the create form to show
 * before saving. Returns null when the preview is not available (half-filled form, a fighter
 * outside the roster, an invalid schedule): the form then simply shows nothing.
 */
export async function previewFeasibilityAction(input: z.input<typeof feasibilityInputSchema>): Promise<WeightFeasibility | null> {
    const user = await requireRole("coach");
    const parsed = feasibilityInputSchema.safeParse(input);
    if (!parsed.success || !canAccessFighter(user, parsed.data.fighterId)) return null;

    const weighInMs = new Date(parsed.data.weighInAt).getTime();
    const boutMs = new Date(parsed.data.boutAt).getTime();
    if (Number.isNaN(weighInMs) || Number.isNaN(boutMs) || weighInMs >= boutMs) return null;

    try {
        return await getFeasibilityService({
            ...parsed.data,
            weighInAt: new Date(weighInMs).toISOString(),
            boutAt: new Date(boutMs).toISOString(),
        });
    } catch {
        return null;
    }
}

