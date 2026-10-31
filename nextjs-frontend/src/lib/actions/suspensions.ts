"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import type {
    Suspension,
    SuspensionCreation,
} from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import {
    clearSuspension as clearSuspensionService,
    createSuspension as createSuspensionService,
} from "@/lib/services/suspensions";
import { getPlan, getSession } from "@/lib/services/training";
import {
    buildClearSuspensionSchema,
    buildCreateSuspensionSchema,
} from "./suspension-schemas";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function revalidateSuspensionPaths(fighterId?: string) {
    revalidatePath(routes.coach.bouts);
    revalidatePath(routes.coach.suspensions);
    revalidatePath(routes.coach.readiness);
    revalidatePath(routes.coach.sessions);
    revalidatePath(routes.coach.dashboard);
    if (fighterId) {
        revalidatePath(routes.coach.fighter(fighterId));
    }
}

function mapSuspensionActionError(
    error: unknown,
    t: Translator,
    context?: { reason?: string },
): ActionState<never> {
    if (error instanceof ApiError) {
        if (error.code === "SUSPENSION_NOT_FOUND") {
            return actionError(t("suspensions.action.notFound"));
        }
        if (error.code === "SUSPENSION_ALREADY_CLEARED") {
            return actionError(t("suspensions.action.alreadyCleared"));
        }
        if (error.code === "VALIDATION_ERROR" || error.status === 422) {
            const fieldMap: Record<string, string> = {
                clearanceNote: t("suspensions.action.clearanceNoteLength"),
                days: t("suspensions.action.daysRange"),
                startsOn: t("suspensions.action.startsOnNotBeforeToday"),
                maxTier: t("suspensions.action.maxTierAndTypesExclusive"),
                blockedSessionTypes: t("suspensions.action.blockedSessionTypesMin"),
                fighterId: t("coachBouts.action.selectFighterFromRoster"),
            };
            const fieldErrors: Record<string, string> = {};
            if (Array.isArray(error.details)) {
                for (const item of error.details) {
                    if (item && typeof item === "object" && "path" in item) {
                        const rawKey = Array.isArray(item.path) ? item.path[0] : item.path;
                        const keyStr = String(rawKey ?? "");
                        if (keyStr) {
                            if (keyStr === "requiresClearance") {
                                const msg = typeof item.message === "string" ? item.message : "";
                                const isDqOrMandatory =
                                    context?.reason === "DQ" ||
                                    context?.reason === "MANDATORY_REST" ||
                                    msg.includes("DQ") ||
                                    msg.includes("MANDATORY_REST");
                                fieldErrors[keyStr] = isDqOrMandatory
                                    ? t("suspensions.action.requiresClearanceDqForbidden")
                                    : t("suspensions.action.requiresClearanceKoMandatory");
                            } else {
                                fieldErrors[keyStr] = fieldMap[keyStr] ?? t("form.fixFields");
                            }
                        }
                    }
                }
            }
            return actionError(
                t("form.fixFields"),
                Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
            );
        }
        if (error.code === "FORBIDDEN" || error.status === 403) {
            return actionError(t("suspensions.action.unauthorized"));
        }
        return actionError(t("suspensions.action.failed"));
    }
    return actionError(t("suspensions.action.failed"));
}

/* ─── Server Actions ──────────────────────────────────────────────────────── */

export async function createSuspensionAction(
    _prev: ActionState<SuspensionCreation>,
    formData: FormData,
): Promise<ActionState<SuspensionCreation>> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("suspensions.action.unauthorized"));

    if (user.role === "fighter") {
        return actionError(t("suspensions.action.unauthorized"));
    }

    const raw = Object.fromEntries(formData.entries());
    const blockedFromForm = formData.getAll("blockedSessionTypes");
    if (blockedFromForm.length > 0) {
        (raw as Record<string, unknown>).blockedSessionTypes = blockedFromForm;
    }

    const schema = buildCreateSuspensionSchema(t);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const input = parsed.data;
    if (user.role !== "admin" && !canAccessFighter(user, input.fighterId)) {
        return actionError(t("coachBouts.action.notOnRoster"), {
            fighterId: t("coachBouts.action.selectFighterFromRoster"),
        });
    }

    try {
        const result = await createSuspensionService(input, user);
        if (result.affectedSessions && result.affectedSessions.length > 0) {
            result.affectedSessions = await Promise.all(
                result.affectedSessions.map(async (item) => {
                    const session = await getSession(item.sessionId).catch(() => null);
                    return {
                        ...item,
                        name: session?.title ?? undefined,
                        scheduledAt: session?.scheduledAt ?? undefined,
                        type: session?.type ?? undefined,
                    };
                }),
            );
        }
        if (result.affectedPlans && result.affectedPlans.length > 0) {
            result.affectedPlans = await Promise.all(
                result.affectedPlans.map(async (item) => {
                    const plan = await getPlan(item.planId).catch(() => null);
                    return {
                        ...item,
                        name: plan?.title ?? undefined,
                    };
                }),
            );
        }
        revalidateSuspensionPaths(input.fighterId);
        return actionSuccess(t("suspensions.action.created"), result);
    } catch (error: unknown) {
        return mapSuspensionActionError(error, t, { reason: input.reason });
    }
}

export async function clearSuspensionAction(
    _prev: ActionState<Suspension>,
    formData: FormData,
): Promise<ActionState<Suspension>> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("suspensions.action.unauthorized"));

    // Business rule: ADMIN is forbidden from clearing suspensions. Only assigned Coach or Doctor.
    if (user.role === "admin") {
        return actionError(t("suspensions.action.adminClearForbidden"));
    }

    if (user.role !== "coach" && user.role !== "doctor") {
        return actionError(t("suspensions.action.unauthorized"));
    }

    const raw = Object.fromEntries(formData.entries());
    const schema = buildClearSuspensionSchema(t);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const { id, clearanceNote } = parsed.data;

    try {
        const cleared = await clearSuspensionService(id, clearanceNote, user);
        revalidateSuspensionPaths(cleared.fighterId);
        return actionSuccess(t("suspensions.action.cleared"), cleared);
    } catch (error: unknown) {
        return mapSuspensionActionError(error, t);
    }
}
