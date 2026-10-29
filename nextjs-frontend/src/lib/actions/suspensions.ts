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
    applyConflicts as applyConflictsService,
    clearSuspension as clearSuspensionService,
    createSuspension as createSuspensionService,
} from "@/lib/services/suspensions";
import {
    buildApplyConflictsSchema,
    buildClearSuspensionSchema,
    buildCreateSuspensionSchema,
} from "./suspension-schemas";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function revalidateSuspensionPaths(fighterId?: string) {
    revalidatePath(routes.coach.bouts);
    revalidatePath("/coach/bouts/suspensions");
    revalidatePath("/coach/bouts/readiness");
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
            const isDqForbiddenReason =
                context?.reason === "DQ" || context?.reason === "MANDATORY_REST";
            const fieldMap: Record<string, string> = {
                clearanceNote: t("suspensions.action.clearanceNoteLength"),
                days: t("suspensions.action.daysRange"),
                startsOn: t("suspensions.action.startsOnNotBeforeToday"),
                maxTier: t("suspensions.action.maxTierAndTypesExclusive"),
                blockedSessionTypes: t("suspensions.action.blockedSessionTypesMin"),
                requiresClearance: isDqForbiddenReason
                    ? t("suspensions.action.requiresClearanceDqForbidden")
                    : t("suspensions.action.requiresClearanceKoMandatory"),
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

export async function applyConflictsAction(
    _prev: ActionState<{ count: number }>,
    formData: FormData,
): Promise<ActionState<{ count: number }>> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("suspensions.action.unauthorized"));

    if (user.role === "fighter" || user.role === "doctor") {
        return actionError(t("suspensions.action.unauthorized"));
    }

    const raw = Object.fromEntries(formData.entries());
    const sessionIdsFromForm = formData.getAll("sessionIds") as string[];
    let sessionIds: string[] = sessionIdsFromForm.filter((s) => typeof s === "string" && s.length > 0);

    if (sessionIds.length === 0 && typeof raw.sessionIds === "string") {
        try {
            const parsedArray = JSON.parse(raw.sessionIds);
            if (Array.isArray(parsedArray)) {
                sessionIds = parsedArray;
            }
        } catch {
            sessionIds = raw.sessionIds.split(",").map((s) => s.trim()).filter(Boolean);
        }
    }

    const schema = buildApplyConflictsSchema(t);
    const parsed = schema.safeParse({ id: raw.id, sessionIds });
    if (!parsed.success) return validationError(parsed.error, t("form.fixFields"));

    const { id, sessionIds: selectedSessionIds } = parsed.data;

    try {
        const updatedSessions = await applyConflictsService(id, selectedSessionIds, user);
        revalidateSuspensionPaths();
        return actionSuccess(t("suspensions.action.conflictsApplied"), { count: updatedSessions.length });
    } catch (error: unknown) {
        return mapSuspensionActionError(error, t);
    }
}
