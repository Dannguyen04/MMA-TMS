"use server";

import { revalidatePath } from "next/cache";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import {
    observationMarkSchema,
    roundInputSchema,
    selfScoreSchema,
    tacticOutcomeSchema,
    type ObservationMark,
    type TacticOutcome,
} from "@/lib/domain/round-advice";
import { analysisFieldErrors, buildOpponentAnalysisInput } from "@/lib/domain/opponent-analysis-form";
import type { User } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getBoutAnalysisDetail, saveOpponentAnalysis, upsertBoutRound } from "@/lib/services/bout-analysis";
import { getCampBout } from "@/lib/services/bouts";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

async function authorizeCoach(
    t: Translator,
): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(t("boutAnalysis.action.noCoachProfile")) };
    return { ok: true, user: auth.user, coachId: auth.user.profileId };
}

function revalidateBoutAnalysisPaths(boutId: string, fighterId?: string) {
    const boutPath = routes.coach.bout(boutId);
    revalidatePath(routes.coach.bouts);
    revalidatePath(boutPath);
    revalidatePath(`${boutPath}/corner-card`);
    revalidatePath(`${boutPath}/rounds`);
    revalidatePath(`${boutPath}/opponent-analysis`);
    revalidatePath(routes.coach.dashboard);
    if (fighterId) {
        revalidatePath(routes.coach.fighter(fighterId));
    }
}

export async function recordBoutRoundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = String(formData.get("boutId") ?? "").trim();
    const roundNoRaw = Number(formData.get("roundNo"));
    if (!boutId || !Number.isInteger(roundNoRaw) || roundNoRaw < 1) {
        return actionError(t("boutAnalysis.action.boutIdRequired"));
    }

    const existing = await getCampBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("boutAnalysis.action.boutNotFoundOrNotOnRoster"));
    }

    const tacticMarks: Record<string, TacticOutcome> = {};
    const observationMarks: Record<string, ObservationMark> = {};

    for (const [key, rawValue] of formData.entries()) {
        const val = String(rawValue).trim();
        if (!val) continue;
        if (key.startsWith("tacticMark_")) {
            const id = key.slice("tacticMark_".length);
            const parsedMark = tacticOutcomeSchema.safeParse(val);
            if (id && parsedMark.success) {
                tacticMarks[id] = parsedMark.data;
            }
        } else if (key.startsWith("observationMark_")) {
            const id = key.slice("observationMark_".length);
            const parsedMark = observationMarkSchema.safeParse(val);
            if (id && parsedMark.success) {
                observationMarks[id] = parsedMark.data;
            }
        }
    }

    const selfScoreVal = String(formData.get("selfScore") ?? "").trim();
    const parsedSelfScore = selfScoreVal ? selfScoreSchema.safeParse(selfScoreVal) : null;
    if (parsedSelfScore && !parsedSelfScore.success) {
        return actionError(t("form.fixFields"));
    }

    const knockdownsRaw = String(formData.get("knockdownsAgainst") ?? "0").trim();
    const knockdownsAgainst = knockdownsRaw === "" ? 0 : Number(knockdownsRaw);
    const stunned = formData.get("stunned") === "on" || formData.get("stunned") === "true";
    const bleeding = formData.get("bleeding") === "on" || formData.get("bleeding") === "true";
    const fatigued = formData.get("fatigued") === "on" || formData.get("fatigued") === "true";
    const noteRaw = String(formData.get("note") ?? "").trim();

    const parsedInput = roundInputSchema.safeParse({
        tacticMarks,
        observationMarks,
        selfScore: parsedSelfScore ? parsedSelfScore.data : null,
        knockdownsAgainst,
        stunned,
        bleeding,
        fatigued,
        note: noteRaw.length > 0 ? noteRaw : null,
    });

    if (!parsedInput.success) {
        return validationError(parsedInput.error, t("form.fixFields"));
    }

    try {
        const result = await upsertBoutRound(boutId, roundNoRaw, parsedInput.data, auth.user);
        if (!result.ok) {
            if (result.error === "BOUT_INVALID_TRANSITION") {
                return actionError(t("boutAnalysis.action.invalidTransition"));
            }
            if (result.error === "BOUT_ROUNDS_NOT_SET") {
                return actionError(t("boutAnalysis.action.roundsNotSet"));
            }
            if (result.error === "BOUT_ROUND_OUT_OF_RANGE") {
                return actionError(t("boutAnalysis.action.roundOutOfRange"));
            }
            if (result.error === "BOUT_ROUND_MARK_UNKNOWN") {
                return actionError(t("boutAnalysis.action.markUnknown"));
            }
            return actionError(t("boutAnalysis.action.saveFailed"));
        }

        revalidateBoutAnalysisPaths(boutId, existing.fighterId);
        return actionSuccess(t("boutAnalysis.action.roundSaved", { roundNo: roundNoRaw }));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.action.saveFailed"));
    }
}

export async function saveOpponentAnalysisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const boutId = String(formData.get("boutId") ?? "").trim();
    if (!boutId) return actionError(t("boutAnalysis.action.boutIdRequired"));

    const existing = await getCampBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("boutAnalysis.action.boutNotFoundOrNotOnRoster"));
    }

    let raw: unknown;
    try {
        raw = JSON.parse(String(formData.get("analysis") ?? ""));
    } catch {
        return actionError(t("form.fixFields"));
    }

    const detail = await getBoutAnalysisDetail(boutId);
    const parsed = buildOpponentAnalysisInput(
        raw,
        detail?.opponentAnalysis ?? { observations: [], tactics: [] },
        detail?.scheduledRounds ?? null,
    );
    if (!parsed.success) {
        return actionError(t("form.fixFields"), analysisFieldErrors(parsed.error, t));
    }

    try {
        const result = await saveOpponentAnalysis(boutId, parsed.data, auth.user);
        if (!result.ok) {
            if (result.error === "BOUT_INVALID_TRANSITION") {
                return actionError(t("boutAnalysis.analysis.action.locked"));
            }
            return actionError(t("boutAnalysis.analysis.action.saveFailed"));
        }

        revalidateBoutAnalysisPaths(boutId, existing.fighterId);
        return actionSuccess(t("boutAnalysis.analysis.action.saved"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.analysis.action.saveFailed"));
    }
}
