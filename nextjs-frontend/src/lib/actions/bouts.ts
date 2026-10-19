"use server";

import { revalidatePath } from "next/cache";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import type { User } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import {
    addRequirement as addRequirementService,
    cancelBout as cancelBoutService,
    createBout as createBoutService,
    enterFightWeek as enterFightWeekService,
    getBout,
    linkCamp as linkCampService,
    removeRequirement as removeRequirementService,
    updateBout as updateBoutService,
    updateRequirement as updateRequirementService,
} from "@/lib/services/bouts";
import {
    buildAddRequirementSchema,
    buildCreateBoutSchema,
    buildUpdateBoutSchema,
    buildUpdateRequirementSchema,
} from "./bout-schemas";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

async function authorizeCoach(t: Translator): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(t("coachBouts.action.noCoachProfile")) };
    return { ok: true, user: auth.user, coachId: auth.user.profileId };
}

function revalidateBoutPaths(boutId: string, fighterId?: string) {
    revalidatePath(routes.coach.bouts);
    revalidatePath(routes.coach.bout(boutId));
    revalidatePath(routes.coach.dashboard);
    if (fighterId) {
        revalidatePath(routes.coach.fighter(fighterId));
    }
}

/* ─── Create Bout ─────────────────────────────────────────────────────────── */

export async function createBoutAction(_prev: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = buildCreateBoutSchema(t).safeParse(raw);
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const input = parsed.data;
    if (!canAccessFighter(auth.user, input.fighterId)) {
        return actionError(t("coachBouts.action.notOnRoster"), { fighterId: t("coachBouts.action.selectFighterFromRoster") });
    }

    try {
        const bout = await createBoutService(
            {
                ...input,
                coachId: auth.coachId,
                weighInAt: new Date(input.weighInAt).toISOString(),
                boutAt: new Date(input.boutAt).toISOString(),
            },
            auth.user,
        );

        revalidateBoutPaths(bout.id, bout.fighterId);
        return actionSuccess(t("coachBouts.action.boutCreated"), { id: bout.id });
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToCreateBout"));
    }
}

/* ─── Update Bout ─────────────────────────────────────────────────────────── */

export async function updateBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = buildUpdateBoutSchema(t).safeParse(raw);
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const { boutId, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        await updateBoutService(
            boutId,
            {
                ...input,
                weighInAt: input.weighInAt ? new Date(input.weighInAt).toISOString() : undefined,
                boutAt: input.boutAt ? new Date(input.boutAt).toISOString() : undefined,
            },
            auth.user,
        );

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.boutUpdated"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToUpdateBout"));
    }
}

/* ─── Link Camp Plan ──────────────────────────────────────────────────────── */

export async function linkCampAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const trainingPlanId = formData.get("trainingPlanId") as string;

    if (!boutId || !trainingPlanId) {
        return actionError(t("coachBouts.action.selectCampPlan"));
    }

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        await linkCampService(boutId, trainingPlanId, auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.campLinked"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToLinkCamp"));
    }
}

/* ─── Enter Fight Week ────────────────────────────────────────────────────── */

export async function enterFightWeekAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    if (!boutId) return actionError(t("coachBouts.action.boutIdRequired"));

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        const result = await enterFightWeekService(boutId, auth.user);
        if (!result.ok) {
            if (result.error === "BOUT_REQUIREMENTS_INCOMPLETE") {
                const missingList = [...(result.missing ?? []), ...(result.expiring ?? [])];
                return actionError(t("coachBouts.action.requirementsIncomplete", { items: missingList.join(", ") }));
            }
            if (result.error === "BOUT_FIGHT_WEEK_TOO_EARLY") {
                return actionError(t("coachBouts.action.fightWeekTooEarly"));
            }
            return actionError(t("coachBouts.action.failedToEnterFightWeekWithCode", { code: result.error }));
        }

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.enteredFightWeek"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToEnterFightWeek"));
    }
}

/* ─── Cancel Bout ─────────────────────────────────────────────────────────── */

export async function cancelBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const reason = formData.get("reason") as string;

    if (!boutId || !reason?.trim()) {
        return actionError(t("coachBouts.action.cancelReasonRequired"), { reason: t("coachBouts.action.enterCancelReason") });
    }

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        await cancelBoutService(boutId, reason.trim(), auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.boutCancelled"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToCancelBout"));
    }
}

/* ─── Requirement Actions ─────────────────────────────────────────────────── */

export async function addRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = buildAddRequirementSchema(t).safeParse({
        ...raw,
        required: raw.required === "on" || raw.required === "true",
    });
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const { boutId, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        const req = await addRequirementService(boutId, input, auth.user);
        if (!req) return actionError(t("coachBouts.action.requirementCodeExists"));

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.requirementAdded"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToAddRequirement"));
    }
}

export async function updateRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = buildUpdateRequirementSchema(t).safeParse({
        ...raw,
        required: raw.required !== undefined ? raw.required === "on" || raw.required === "true" : undefined,
    });
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const { boutId, code, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        await updateRequirementService(
            boutId,
            code,
            {
                ...input,
                issuedOn: input.issuedOn || null,
                validUntil: input.validUntil || null,
            },
            auth.user,
        );

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.requirementUpdated"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToUpdateRequirement"));
    }
}

export async function removeRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const code = formData.get("code") as string;

    if (!boutId || !code) return actionError(t("coachBouts.action.missingRequirementParams"));

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("coachBouts.action.boutNotFoundOrNotOnRoster"));
    }

    try {
        await removeRequirementService(boutId, code, auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess(t("coachBouts.action.requirementRemoved"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("coachBouts.action.failedToRemoveRequirement"));
    }
}
