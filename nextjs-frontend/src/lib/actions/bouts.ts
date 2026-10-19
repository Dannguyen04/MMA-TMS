"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { actionError, actionSuccess, FIX_FIELDS, type ActionState } from "@/lib/actions/state";
import { CANCEL_REASONS, type CampBout, type CancelReason, type HydrationCheck, type NutritionPhaseKey, type SuspensionReason } from "@/lib/domain/bout";
import {
    HYDRATION_CHECKS,
    madeWeight,
    readCatchweight,
    readDueDays,
    readOfficialWeight,
    validateBoutSchedule,
    validateNewRequirement,
    validateOutcome,
    validateRequirementUpdate,
    type BoutScheduleInput,
} from "@/lib/domain/bout-rules";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { readPlanAnswer, readPlanAuthor, readPlanText } from "@/lib/domain/nutrition";
import { readClearanceNote, suggestSuspension, suspensionReasonFor, validateSuspension, MANUAL_SUSPENSION_REASONS, SUSPENSION_REASONS } from "@/lib/domain/suspension-rules";
import type { TrainingType, User } from "@/lib/domain/types";
import { parseSelfWeight } from "@/lib/domain/weight-input";
import { dayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
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
const NOT_ON_ROSTER = "That bout is not on your roster.";
const REASON_MAX = 300;

/** What blocks fight week, one line per item, shown as a list beside the button. */
export interface BlockedLines {
    lines: string[];
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

/** The bout named in the form, if it is on this coach's roster. Pages answer 404 for the same check. */
async function coachBout(formData: FormData): Promise<{ user: User; bout: CampBout } | { error: ActionState<never> }> {
    const user = await requireRole("coach");
    const boutId = text(formData, "boutId");
    const bout = boutId ? await getCampBout(boutId) : null;
    if (!bout || !canAccessFighter(user, bout.fighterId)) return { error: actionError(NOT_ON_ROSTER) };
    return { user, bout };
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
    const user = await requireRole("fighter");
    if (!user.profileId) return actionError("Your fighter profile is missing.");

    const parsed = parseSelfWeight(text(formData, "weightKg"));
    if (!parsed.ok) return actionError(FIX_FIELDS, { weightKg: parsed.message });

    const answer = readPlanAnswer(text(formData, "adherence"), text(formData, "note"));
    if (!answer.ok) return actionError(FIX_FIELDS, { [answer.field]: answer.message });

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
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const { user, bout } = found;

    const author = readPlanAuthor(text(formData, "authorName"), user.name);
    if (!author.ok) return actionError(FIX_FIELDS, { authorName: author.message });

    const texts = {} as Record<NutritionPhaseKey, string>;
    const fieldErrors: Record<string, string> = {};
    for (const phase of PHASES) {
        const value = readPlanText(text(formData, phase));
        if (!value.ok) fieldErrors[phase] = value.message;
        else texts[phase] = value.text;
    }
    if (Object.keys(fieldErrors).length > 0) return actionError(FIX_FIELDS, fieldErrors);

    const result = await saveNutritionPlan(bout.id, texts, author.authorName);
    if (!result.ok) return actionError(result.message);

    revalidatePath(routes.coach.bout(bout.id));
    revalidatePath(routes.fighter.bout);
    redirect(`${routes.coach.bout(bout.id)}?notice=plan`);
}

/* ─── Coach: bout lifecycle (T-004) ───────────────────────────────────────── */

/** F1: create a scheduled bout for a fighter on this coach's roster, then open it. */
export async function createBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireRole("coach");
    const fieldErrors: Record<string, string> = {};

    const fighterId = text(formData, "fighterId");
    const fighter = fighterId && canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    if (!fighter) fieldErrors.fighterId = "Choose a fighter on your roster.";

    const ruleset = await getRuleset(text(formData, "rulesetId"));
    if (!ruleset) fieldErrors.rulesetId = "Choose a ruleset.";

    const schedule = validateBoutSchedule(scheduleInput(formData), ruleset ?? { weightClasses: [] }, new Date());
    if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
    // Without a ruleset there is no class list to check against yet.
    if (!ruleset) delete fieldErrors.weightLimitKg;
    if (Object.keys(fieldErrors).length > 0 || !fighter || !ruleset || !schedule.ok) return actionError(FIX_FIELDS, fieldErrors);

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
            coachId: user.profileId ?? user.id,
        },
        user,
    );
    if (!result.ok) return actionError(result.message, result.fieldErrors);

    revalidateBout({ id: result.boutId });
    redirect(`${routes.coach.bout(result.boutId)}?notice=${result.warning ? "created-suspended" : "created"}`);
}

/** F8: event details any time before a result; dates, class and the deadline until the official weigh-in. */
export async function updateBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const { user, bout } = found;
    const ruleset = await getRuleset(bout.rulesetId);
    if (!ruleset) return actionError("This bout's ruleset is no longer available.");

    const fieldErrors: Record<string, string> = {};
    const schedule = validateBoutSchedule(scheduleInput(formData), ruleset, new Date());
    if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
    const dueDays = readDueDays(text(formData, "requirementsDueDays"));
    if (!dueDays.ok) fieldErrors.requirementsDueDays = dueDays.message;
    const notes = text(formData, "notes").trim();
    if (notes.length > 500) fieldErrors.notes = "Keep the notes under 500 characters.";
    const changeReason = text(formData, "changeReason").trim();
    if (changeReason.length > REASON_MAX) fieldErrors.changeReason = `Keep the reason under ${REASON_MAX} characters.`;
    if (Object.keys(fieldErrors).length > 0 || !schedule.ok || !dueDays.ok) return actionError(FIX_FIELDS, fieldErrors);

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
    if (!result.ok) return actionError(result.message, result.fieldErrors);
    revalidateBout(bout);
    return actionSuccess("Bout updated");
}

/** F2: link a fight-camp plan of the same fighter; the bout moves to camp. */
export async function linkCampAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const planId = text(formData, "trainingPlanId");
    if (!planId) return actionError(FIX_FIELDS, { trainingPlanId: "Choose a camp plan." });
    const result = await linkCamp(found.bout.id, planId, found.user);
    if (!result.ok) return actionError(result.message, result.fieldErrors);
    revalidateBout(found.bout);
    return actionSuccess("Camp started");
}

/** CAMP → FIGHT_WEEK through Gate 1. A refusal keeps the bout in camp and lists what is missing. */
export async function enterFightWeekAction(_prev: ActionState<BlockedLines>, formData: FormData): Promise<ActionState<BlockedLines>> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const result = await enterFightWeek(found.bout.id, found.user);
    if (!result.ok) return { status: "error", message: result.message, data: { lines: result.lines } };
    revalidateBout(found.bout);
    redirect(`${routes.coach.bout(found.bout.id)}?notice=fight-week`);
}

export async function cancelBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const reason = text(formData, "reason") as CancelReason;
    const note = text(formData, "note").trim();
    const fieldErrors: Record<string, string> = {};
    if (!(CANCEL_REASONS as readonly string[]).includes(reason)) fieldErrors.reason = "Choose why the bout is cancelled.";
    if (reason === "OTHER" && !note) fieldErrors.note = "Say what happened.";
    if (note.length > REASON_MAX) fieldErrors.note = `Keep the note under ${REASON_MAX} characters.`;
    if (Object.keys(fieldErrors).length > 0) return actionError(FIX_FIELDS, fieldErrors);
    const result = await cancelBout(found.bout.id, reason, note || null, found.user);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    return actionSuccess("Bout cancelled");
}

/* ─── Coach: medical checklist (F4) ───────────────────────────────────────── */

export async function addRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const item = validateNewRequirement(
        { label: text(formData, "label"), required: formData.get("required") === "on", validityDays: text(formData, "validityDays") },
        found.bout.requirements.map((requirement) => requirement.label),
    );
    if (!item.ok) return actionError(FIX_FIELDS, item.fieldErrors);
    const result = await addRequirement(found.bout.id, item.value);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    return actionSuccess(`${item.value.label} added`);
}

export async function updateRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const code = text(formData, "code");
    const item = found.bout.requirements.find((requirement) => requirement.code === code);
    if (!item) return actionError("That document is no longer on the checklist.");
    const update = validateRequirementUpdate({
        state: text(formData, "state"),
        issuedOn: text(formData, "issuedOn"),
        validUntil: text(formData, "validUntil"),
        statusReason: text(formData, "statusReason"),
    });
    if (!update.ok) return actionError(FIX_FIELDS, update.fieldErrors);
    const result = await updateRequirement(found.bout.id, code, update.value);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    return actionSuccess(`${item.label} updated`);
}

/** For `useConfirmAction`: removes one item, by code. */
export async function removeRequirementAction(payload: { boutId: string; code: string }): Promise<ActionState> {
    const formData = new FormData();
    formData.set("boutId", payload.boutId);
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const result = await removeRequirement(found.bout.id, payload.code);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    return actionSuccess("Removed from the checklist");
}

/** F5: in fight week the checklist is locked; reopening it needs a reason. */
export async function unlockChecklistAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const reason = text(formData, "reason").trim();
    if (!reason) return actionError(FIX_FIELDS, { reason: "Say why the checklist has to change in fight week." });
    if (reason.length > REASON_MAX) return actionError(FIX_FIELDS, { reason: `Keep the reason under ${REASON_MAX} characters.` });
    const result = await unlockChecklist(found.bout.id, reason, found.user);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    return actionSuccess("Checklist unlocked");
}

/* ─── Coach: official weigh-in and result (T-006) ─────────────────────────── */

export async function recordWeighInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
    if ("error" in found) return found.error;
    const { bout } = found;
    const fieldErrors: Record<string, string> = {};

    const weight = readOfficialWeight(text(formData, "weightKg"));
    if (!weight.ok) fieldErrors.weightKg = weight.message;
    const hydrationRaw = text(formData, "hydrationCheck");
    const hydrationCheck = (HYDRATION_CHECKS as readonly string[]).includes(hydrationRaw) ? (hydrationRaw as HydrationCheck) : null;
    if (hydrationRaw && !hydrationCheck) fieldErrors.hydrationCheck = "Choose a hydration result, or leave it empty.";

    const limit = bout.catchweightKg ?? bout.limitKg;
    const made = weight.ok ? madeWeight(weight.kg, limit) : true;
    const decisionRaw = text(formData, "decision");
    const decision = decisionRaw === "CATCHWEIGHT" || decisionRaw === "CANCEL" ? decisionRaw : null;
    let catchweightKg: number | null = null;
    const note = text(formData, "note").trim();
    if (!made) {
        if (!decision) fieldErrors.decision = "Missed the limit: choose a catchweight or cancel the bout.";
        if (decision === "CATCHWEIGHT") {
            const catchweight = readCatchweight(text(formData, "catchweightKg"));
            if (!catchweight.ok) fieldErrors.catchweightKg = catchweight.message;
            else if (weight.ok && catchweight.kg < weight.kg) fieldErrors.catchweightKg = "The catchweight must be at or above the official weight.";
            else catchweightKg = catchweight.kg;
            if (!note) fieldErrors.note = "Note what was agreed, such as a purse penalty.";
        }
    }
    if (note.length > REASON_MAX) fieldErrors.note = `Keep the note under ${REASON_MAX} characters.`;
    if (Object.keys(fieldErrors).length > 0 || !weight.ok) return actionError(FIX_FIELDS, fieldErrors);

    const result = await recordWeighIn(bout.id, { weightKg: weight.kg, hydrationCheck, decision: made ? null : decision, catchweightKg, note: note || null }, found.user);
    if (!result.ok) return actionError(result.message, result.fieldErrors);
    revalidateBout(bout);
    return actionSuccess(made ? "Made weight" : decision === "CANCEL" ? "Bout cancelled: missed weight" : "Weighed in at a catchweight");
}

export async function recordResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const found = await coachBout(formData);
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
    );
    if (!outcome.ok) return actionError(FIX_FIELDS, outcome.fieldErrors);
    const result = await recordResult(found.bout.id, outcome.value, found.user);
    if (!result.ok) return actionError(result.message);
    revalidateBout(found.bout);
    revalidatePath(routes.coach.sessions);
    return actionSuccess("Result recorded");
}

/* ─── Coach: suspensions and Gate 2 (T-007) ───────────────────────────────── */

/**
 * After a result (`boutId` set), or by hand for a fighter on the roster. The suggestion is worked out again here
 * from the ruleset and the fighter's knockout history, never taken from the form.
 */
export async function createSuspensionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireRole("coach");
    const boutId = text(formData, "boutId");
    let fighterId = text(formData, "fighterId");
    let suggestedDays: number | null = null;
    let allowed: readonly SuspensionReason[] = MANUAL_SUSPENSION_REASONS;

    if (boutId) {
        const bout = await getCampBout(boutId);
        if (!bout || !canAccessFighter(user, bout.fighterId)) return actionError(NOT_ON_ROSTER);
        if (bout.phase !== "COMPLETED" || !bout.outcome) return actionError("Record the result before the suspension.");
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
        return actionError(FIX_FIELDS, { fighterId: "Choose a fighter on your roster." });
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
    );
    if (!draft.ok) return actionError(FIX_FIELDS, draft.fieldErrors);
    const result = await createSuspension(fighterId, boutId || null, draft.value, user);
    if (!result.ok) return actionError(result.message);
    if (boutId) revalidateBout({ id: boutId });
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.sessions);
    return actionSuccess("Suspension saved");
}

/** F7: after the last suspended day, a coach confirms the fighter may train again and writes the basis. */
export async function clearSuspensionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireRole("coach");
    const id = text(formData, "suspensionId");
    const suspension = (await listSuspensions("all")).find((item) => item.id === id);
    if (!suspension || !canAccessFighter(user, suspension.fighterId)) return actionError("That suspension is not on your roster.");
    const note = readClearanceNote(text(formData, "clearanceNote"));
    if (!note.ok) return actionError(FIX_FIELDS, { clearanceNote: note.message });
    const result = await clearSuspension(id, note.value, user);
    if (!result.ok) return actionError(result.message);
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.sessions);
    if (suspension.boutId) revalidatePath(routes.coach.bout(suspension.boutId));
    return actionSuccess("Cleared to train");
}
