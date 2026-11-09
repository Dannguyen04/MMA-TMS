"use server";

import { revalidatePath } from "next/cache";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import {
    nextRoundPlanSchema,
    observationMarkSchema,
    roundInputSchema,
    selfScoreSchema,
    tacticOutcomeSchema,
    type ObservationMark,
    type TacticOutcome,
} from "@/lib/domain/round-advice";
import { TACTIC_REVIEW_NOTE_MAX, tacticReviewsInputSchema } from "@/lib/domain/bout-report";
import { analysisFieldErrors, buildOpponentAnalysisInput } from "@/lib/domain/opponent-analysis-form";
import { isSupportedVideoUrl, type VideoSuggestion } from "@/lib/domain/opponent-video-suggestions";
import type { User } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getBoutAnalysisDetail, saveOpponentAnalysis, saveTacticReviews, upsertBoutRound } from "@/lib/services/bout-analysis";
import { suggestObservationsFromVideo } from "@/lib/services/opponent-video-ai";
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

/** The coach, and the form's `boutId` bout when that fighter is on their roster; otherwise the error to return. */
async function authorizeBoutForm(
    formData: FormData,
    t: Translator,
): Promise<{ ok: true; user: User; boutId: string; fighterId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth;
    const boutId = String(formData.get("boutId") ?? "").trim();
    if (!boutId) return { ok: false, state: actionError(t("boutAnalysis.action.boutIdRequired")) };
    const bout = await getCampBout(boutId);
    if (!bout || !canAccessFighter(auth.user, bout.fighterId)) {
        return { ok: false, state: actionError(t("boutAnalysis.action.boutNotFoundOrNotOnRoster")) };
    }
    return { ok: true, user: auth.user, boutId, fighterId: bout.fighterId };
}

function revalidateBoutAnalysisPaths(boutId: string, fighterId?: string) {
    const boutPath = routes.coach.bout(boutId);
    revalidatePath(routes.coach.bouts);
    revalidatePath(boutPath);
    revalidatePath(`${boutPath}/corner-card`);
    revalidatePath(`${boutPath}/rounds`);
    revalidatePath(`${boutPath}/opponent-analysis`);
    revalidatePath(`${boutPath}/report`);
    revalidatePath(routes.coach.dashboard);
    if (fighterId) {
        revalidatePath(routes.coach.fighter(fighterId));
    }
}

export async function recordBoutRoundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeBoutForm(formData, t);
    if (!auth.ok) return auth.state;
    const { boutId, fighterId } = auth;

    const roundNoRaw = Number(formData.get("roundNo"));
    if (!Number.isInteger(roundNoRaw) || roundNoRaw < 1) {
        return actionError(t("boutAnalysis.action.boutIdRequired"));
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
        if (!result.ok) return actionError(roundErrorMessage(result.error, t));
        revalidateBoutAnalysisPaths(boutId, fighterId);
        return actionSuccess(t("boutAnalysis.action.roundSaved", { roundNo: roundNoRaw }));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.action.saveFailed"));
    }
}

const ROUND_ERROR_KEYS: Partial<Record<string, MessageKey>> = {
    BOUT_INVALID_TRANSITION: "boutAnalysis.action.invalidTransition",
    BOUT_ROUNDS_NOT_SET: "boutAnalysis.action.roundsNotSet",
    BOUT_ROUND_OUT_OF_RANGE: "boutAnalysis.action.roundOutOfRange",
    BOUT_ROUND_MARK_UNKNOWN: "boutAnalysis.action.markUnknown",
    BOUT_NEXT_ROUND_PLAN_LAST_ROUND: "boutAnalysis.nextRound.lastRound",
};

function roundErrorMessage(code: string, t: Translator): string {
    return t(ROUND_ERROR_KEYS[code] ?? "boutAnalysis.action.saveFailed");
}

/**
 * T-037 B: the plan for the next round, saved on the round just recorded (`roundNo`) without touching its marks:
 * the API updates only the fields it is sent.
 */
export async function saveNextRoundPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeBoutForm(formData, t);
    if (!auth.ok) return auth.state;
    const { boutId, fighterId } = auth;

    const roundNo = Number(formData.get("roundNo"));
    if (!Number.isInteger(roundNo) || roundNo < 1) return actionError(t("boutAnalysis.action.boutIdRequired"));

    let raw: unknown;
    try {
        raw = JSON.parse(String(formData.get("nextRoundPlan") ?? "{}"));
    } catch {
        return actionError(t("form.fixFields"));
    }
    const plan = nextRoundPlanSchema.safeParse(raw);
    if (!plan.success) return actionError(t("boutAnalysis.nextRound.invalid"));

    try {
        const result = await upsertBoutRound(boutId, roundNo, { nextRoundPlan: plan.data }, auth.user);
        if (!result.ok) return actionError(roundErrorMessage(result.error, t));
        revalidateBoutAnalysisPaths(boutId, fighterId);
        return actionSuccess(t("boutAnalysis.nextRound.saved", { roundNo: roundNo + 1 }));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.action.saveFailed"));
    }
}

export interface VideoSuggestionsData {
    suggestions: VideoSuggestion[];
    analyzedAt: string;
    cached: boolean;
}

/** Called directly (not as a form action): the suggestion panel sits inside the analysis form. */
export async function suggestObservationsFromVideoAction(
    boutId: string,
    url: string,
    who: string,
): Promise<ActionState<VideoSuggestionsData>> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const existing = await getCampBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("boutAnalysis.action.boutNotFoundOrNotOnRoster"));
    }
    if (!isSupportedVideoUrl(url)) {
        return actionError(t("boutAnalysis.analysis.ai.error.UNSUPPORTED_URL"), { videoUrl: t("boutAnalysis.analysis.ai.error.UNSUPPORTED_URL") });
    }

    const result = await suggestObservationsFromVideo(url, who.trim() || t("boutAnalysis.analysis.ai.defaultWho"));
    if (!result.ok) return actionError(t(`boutAnalysis.analysis.ai.error.${result.error}`));
    return actionSuccess(
        t("boutAnalysis.analysis.ai.done", { count: result.suggestions.length }),
        { suggestions: result.suggestions, analyzedAt: result.analyzedAt, cached: result.cached },
    );
}

/** T-041: the coach confirms or corrects every tactic's outcome on the report; each `tacticId` posts `outcome_<id>` and `note_<id>`. */
export async function saveTacticReviewsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeBoutForm(formData, t);
    if (!auth.ok) return auth.state;
    const { boutId, fighterId } = auth;

    const fieldErrors: Record<string, string> = {};
    const reviews = formData.getAll("tacticId").map((raw) => {
        const tacticId = String(raw);
        const note = String(formData.get(`note_${tacticId}`) ?? "").trim();
        if (note.length > TACTIC_REVIEW_NOTE_MAX) {
            fieldErrors[`note_${tacticId}`] = t("boutAnalysis.report.review.noteTooLong", { max: TACTIC_REVIEW_NOTE_MAX });
        }
        return { tacticId, outcome: String(formData.get(`outcome_${tacticId}`) ?? ""), ...(note ? { note } : {}) };
    });
    if (Object.keys(fieldErrors).length > 0) return actionError(t("form.fixFields"), fieldErrors);

    const parsed = tacticReviewsInputSchema.safeParse({ reviews });
    if (!parsed.success) return actionError(t("form.fixFields"));

    try {
        const result = await saveTacticReviews(boutId, parsed.data);
        if (!result.ok) {
            if (result.error === "BOUT_INVALID_TRANSITION") return actionError(t("boutAnalysis.report.review.locked"));
            if (result.error === "OPPONENT_TACTIC_UNKNOWN") return actionError(t("boutAnalysis.report.review.tacticGone"));
            return actionError(t("boutAnalysis.report.review.saveFailed"));
        }
        revalidateBoutAnalysisPaths(boutId, fighterId);
        return actionSuccess(t("boutAnalysis.report.review.saved"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.report.review.saveFailed"));
    }
}

export async function saveOpponentAnalysisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeBoutForm(formData, t);
    if (!auth.ok) return auth.state;
    const { boutId, fighterId } = auth;

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

        revalidateBoutAnalysisPaths(boutId, fighterId);
        return actionSuccess(t("boutAnalysis.analysis.action.saved"));
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : t("boutAnalysis.analysis.action.saveFailed"));
    }
}
