import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import type { CampBout, CompetitionRuleset } from "@/lib/domain/bout";
import type { RequirementUpdate } from "@/lib/domain/bout-rules";
import { apiBoutSchema, apiRulesetSchema, createBoutBody, requirementUpdateBody, toCampBout, toRuleset } from "@/lib/domain/bouts-contract";
import type { WriteResult } from "@/lib/domain/write-result";
import { nullIfNotFound, nullIfServiceFails } from "./api-helpers";
import type { BoutEdit, CreateResult, FightWeekResult, NewBout } from "./bouts.demo";

/**
 * The bouts service (T-003 §2). Written against the ticket, not a running backend: until T-003 is merged and
 * migration 024 applied, every call answers 403 or 404, reads come back empty and writes say the service isn't
 * there yet. Nothing here throws into a page.
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

/** 403 and 404 mean the service isn't there yet; 409 and 422 carry the service's own message. */
async function write(request: () => Promise<unknown>): Promise<WriteResult> {
    try {
        await request();
        return { ok: true };
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 403 || error.status === 404) return { ok: false, message: UNAVAILABLE };
        return { ok: false, message: error.message };
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

export function addApiRequirement(boutId: string, item: { code: string; label: string; required: boolean; validityDays: number | null }): Promise<WriteResult> {
    return write(send(path(boutId, "/requirements"), "POST", item));
}

export function updateApiRequirement(boutId: string, code: string, update: RequirementUpdate): Promise<WriteResult> {
    return write(send(path(boutId, `/requirements/${encodeURIComponent(code)}`), "PATCH", requirementUpdateBody(update)));
}

export function removeApiRequirement(boutId: string, code: string): Promise<WriteResult> {
    return write(send(path(boutId, `/requirements/${encodeURIComponent(code)}`), "DELETE"));
}
