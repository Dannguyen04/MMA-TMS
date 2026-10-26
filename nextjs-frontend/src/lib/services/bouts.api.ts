import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import type { BoutOutcome, CampBout, CompetitionRuleset } from "@/lib/domain/bout";
import type { RequirementUpdate } from "@/lib/domain/bout-rules";
import {
    apiBoutSchema,
    apiRulesetSchema,
    apiWeighInBlockSchema,
    catchweightBody,
    createBoutBody,
    requirementUpdateBody,
    resultBody,
    toCampBout,
    toRuleset,
    weighInBody,
} from "@/lib/domain/bouts-contract";
import type { WriteResult } from "@/lib/domain/write-result";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { nullIfNotFound, nullIfServiceFails } from "./api-helpers";
import type { BoutEdit, CreateResult, FightWeekResult, NewBout, WeighInEntry } from "./bouts.demo";

/**
 * The bouts service (T-003 §2, T-006 §2–4). 403 and 404 read as "not available yet", so reads come back empty
 * and writes say so. Nothing here throws into a page.
 */

const UNAVAILABLE = "Bouts are not available from the server yet.";
const idSchema = z.object({ id: z.string() }).passthrough();

const path = (boutId: string, rest = "") => `/bouts/${encodeURIComponent(boutId)}${rest}`;

export async function listApiRulesets(): Promise<CompetitionRuleset[]> {
    const rows = await nullIfServiceFails(authenticatedApiRequest("/competition-rulesets", z.array(apiRulesetSchema)));
    return (rows ?? []).map(toRuleset);
}

async function withRulesets(rows: z.output<typeof apiBoutSchema>[]): Promise<CampBout[]> {
    if (rows.length === 0) return [];
    const rulesets = await listApiRulesets();
    return rows.map((row) => toCampBout(row, rulesets.find((item) => item.id === row.rulesetId) ?? null));
}

export async function listApiBouts(fighterIds: string[] | "all"): Promise<CampBout[]> {
    if (Array.isArray(fighterIds) && fighterIds.length === 0) return [];
    const params = new URLSearchParams();
    if (Array.isArray(fighterIds)) fighterIds.forEach((id) => params.append("fighterId", id));
    const query = params.toString();
    const rows = await nullIfServiceFails(drainAuthenticatedCursorPages(`/bouts${query ? `?${query}` : ""}`, apiBoutSchema));
    return withRulesets(rows ?? []);
}

export async function getApiBout(boutId: string): Promise<CampBout | null> {
    const row = await nullIfServiceFails(nullIfNotFound(authenticatedApiRequest(path(boutId), apiBoutSchema)));
    return row ? ((await withRulesets([row]))[0] ?? null) : null;
}

/** `BOUT_RESULT_INVALID` reasons the result form already words for its own checks (T-006 §4). */
const RESULT_REASONS: Record<string, MessageKey> = {
    ROUND_REQUIRED: "boutMsg.outcome.roundRequired",
    ROUND_NOT_ALLOWED: "boutMsg.outcome.roundNotAllowed",
    CONSCIOUSNESS_REQUIRED: "boutMsg.outcome.locRequired",
    HEAD_STRIKE_REQUIRED: "boutMsg.outcome.headStrikesRequired",
    ROUND_EXCEEDS_SCHEDULED: "boutMsg.api.roundExceedsScheduled",
};

const detail = (error: ApiError, key: string): string | number | undefined => {
    const value = (error.details as Record<string, unknown> | undefined)?.[key];
    return typeof value === "string" || typeof value === "number" ? value : undefined;
};

/**
 * The service's refusals in the viewer's language. Codes this screen knows get its own words (with the date or
 * counts the service sent); anything else keeps the service's message.
 */
function boutRefusal(error: ApiError, t: Translator, locale: Locale): string {
    const earliest = detail(error, "earliestOn");
    const date = typeof earliest === "string" ? formatDate(earliest, locale) : "";
    switch (error.code) {
        case "BOUT_REQUIREMENTS_LOCKED":
            return t("boutMsg.api.requirementsLocked");
        case "BOUT_WEIGH_IN_TOO_EARLY":
            return t("boutMsg.api.weighInTooEarly", { date });
        case "BOUT_NOT_STARTED":
            return t("boutMsg.api.notStarted", { date });
        case "BOUT_WEIGH_IN_NOT_FAILED":
            return t("boutMsg.api.weighInNotFailed");
        case "BOUT_INVALID_CATCHWEIGHT":
            return t("boutMsg.api.invalidCatchweight");
        case "BOUT_CHANGE_REASON_REQUIRED":
            return t("boutMsg.api.changeReasonRequired");
        case "BOUT_ROUNDS_INCOMPLETE":
            return t("boutMsg.api.roundsIncomplete", { recorded: detail(error, "recorded") ?? "?", scheduled: detail(error, "scheduled") ?? "?" });
        case "BOUT_RESULT_INVALID": {
            const reason = detail(error, "reason");
            return t((typeof reason === "string" && RESULT_REASONS[reason]) || "boutMsg.api.resultInvalid");
        }
        case "BOUT_INVALID_TRANSITION":
        case "BOUT_STATE_CONFLICT":
            return t("boutMsg.api.stateChanged");
        default:
            return error.message;
    }
}

/** 403 and 404 mean the service isn't there yet; 409 and 422 are said in the viewer's language where known. */
async function refusal(error: unknown): Promise<WriteResult & { ok: false }> {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 403 || error.status === 404) return { ok: false, message: UNAVAILABLE };
    const { t, locale } = await getTranslator();
    return { ok: false, message: boutRefusal(error, t, locale) };
}

async function write(request: () => Promise<unknown>): Promise<WriteResult> {
    try {
        await request();
        return { ok: true };
    } catch (error) {
        return refusal(error);
    }
}

function send(target: string, method: string, body?: unknown) {
    return () => authenticatedMutableApiRequest(target, z.unknown(), { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

export async function createApiBout(input: NewBout, customLimit: boolean): Promise<CreateResult> {
    try {
        const created = await authenticatedMutableApiRequest("/bouts", idSchema, { method: "POST", body: JSON.stringify(createBoutBody({ ...input, customLimit })) });
        return { ok: true, boutId: created.id, warning: null };
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return { ok: false, message: error.status === 403 || error.status === 404 ? UNAVAILABLE : error.message };
    }
}

export function updateApiBout(boutId: string, edit: BoutEdit, customLimit: boolean): Promise<WriteResult> {
    return write(
        send(path(boutId), "PATCH", {
            eventName: edit.event,
            venue: edit.venue,
            opponentName: edit.opponent,
            notes: edit.notes,
            ...(customLimit ? { weightLimitKg: edit.weightClass.limitKg } : { weightClassCode: edit.weightClass.code }),
            weighInAt: edit.weighInAt,
            boutAt: edit.boutAt,
            requirementsDueDays: edit.requirementsDueDays,
            // T-006 §5: required when the class or limit changes, ignored otherwise.
            ...(edit.changeReason ? { reason: edit.changeReason } : {}),
        }),
    );
}

export function linkApiCamp(boutId: string, trainingPlanId: string): Promise<WriteResult> {
    return write(send(path(boutId, "/camp"), "POST", { trainingPlanId }));
}

/** 409 BOUT_REQUIREMENTS_INCOMPLETE or BOUT_FIGHT_WEEK_TOO_EARLY keep the bout in camp; the message says why. */
export async function enterApiFightWeek(boutId: string): Promise<FightWeekResult> {
    const result = await write(send(path(boutId, "/fight-week"), "POST"));
    return result.ok ? result : { ok: false, message: result.message, lines: [] };
}

export function cancelApiBout(boutId: string, reason: string): Promise<WriteResult> {
    return write(send(path(boutId, "/cancel"), "POST", { reason }));
}

/*
 * The checklist locks in fight week (T-006 §2): every change then carries the coach's `unlockReason`, which the
 * service writes to the bout's history. `null` outside fight week.
 */

export function addApiRequirement(
    boutId: string,
    item: { code: string; label: string; required: boolean; validityDays: number | null },
    unlockReason: string | null = null,
): Promise<WriteResult> {
    const { validityDays, ...rest } = item;
    return write(
        send(path(boutId, "/requirements"), "POST", { ...rest, ...(validityDays === null ? {} : { validityDays }), ...(unlockReason ? { unlockReason } : {}) }),
    );
}

export function updateApiRequirement(boutId: string, code: string, update: RequirementUpdate, unlockReason: string | null = null): Promise<WriteResult> {
    return write(send(path(boutId, `/requirements/${encodeURIComponent(code)}`), "PATCH", requirementUpdateBody(update, unlockReason)));
}

export function removeApiRequirement(boutId: string, code: string, unlockReason: string | null = null): Promise<WriteResult> {
    const query = unlockReason ? `?${new URLSearchParams({ unlockReason })}` : "";
    return write(send(path(boutId, `/requirements/${encodeURIComponent(code)}${query}`), "DELETE"));
}

/* ─── Official weigh-in and result (T-006 §3–4) ───────────────────────────── */

/**
 * The official weigh-in, then what the coach decided after a miss: a catchweight, or a cancel "MISSED_WEIGHT".
 * `recorded` skips the weigh-in when the service already holds this miss, so a retry doesn't weigh twice.
 */
export async function recordApiWeighIn(boutId: string, entry: WeighInEntry, recorded: boolean): Promise<WriteResult> {
    if (!recorded) {
        let passed: boolean;
        try {
            const answer = await authenticatedMutableApiRequest(path(boutId, "/weigh-in"), apiWeighInBlockSchema, { method: "POST", body: JSON.stringify(weighInBody(entry)) });
            passed = answer.weighIn.outcome === "PASSED";
        } catch (error) {
            return refusal(error);
        }
        if (passed) return { ok: true };
    }
    if (entry.decision === "CATCHWEIGHT") return write(send(path(boutId, "/catchweight"), "POST", catchweightBody(entry)));
    if (entry.decision === "CANCEL") return write(send(path(boutId, "/cancel"), "POST", { reason: entry.note ? `MISSED_WEIGHT: ${entry.note}` : "MISSED_WEIGHT" }));
    // The service counted a miss the form didn't expect: the bout waits in fight week for the coach's choice.
    const { t } = await getTranslator();
    return { ok: false, message: t("boutMsg.api.missedOnService"), fieldErrors: { decision: t("boutMsg.action.missedDecision") } };
}

export function recordApiResult(boutId: string, outcome: BoutOutcome): Promise<WriteResult> {
    return write(send(path(boutId, "/result"), "POST", resultBody(outcome)));
}
