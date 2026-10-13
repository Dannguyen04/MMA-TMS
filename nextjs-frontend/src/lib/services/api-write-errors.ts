import "server-only";

import { ApiError } from "@/lib/api/client";
import type { WriteResult } from "@/lib/domain/write-result";

/**
 * Turns a failed API write into what the form shows. Writes are never retried automatically: a create that timed out
 * may already be saved, and sending it again would add a second record. Each service supplies its own wording for
 * refusals and per-code messages; the rules for every status are shared.
 */

export interface WriteFailure {
    message: string;
    fieldErrors?: Record<string, string>;
    /**
     * True when the service may have saved the change anyway (no answer, a timeout, a 5xx or an unreadable reply).
     * A caller that can check the record first should do so before saying anything or sending it again.
     */
    unconfirmed?: true;
}

export interface WriteErrorOptions {
    /** Service field paths (dot-joined, e.g. "restrictions.excludedJoints") → form field names. Longest prefix wins. */
    fields?: Record<string, string>;
    /** Error codes that belong to one form field, e.g. RECOVERY_PLAN_DATE_CONFLICT → "estimatedEndDate". */
    conflictFields?: Record<string, string>;
}

export interface ServiceErrorMessages {
    /** How messages name the service, e.g. "medical service". */
    service: string;
    /** A 403: the caller may no longer change this record. */
    forbidden: string;
    /** A 404 whose code has no message of its own. */
    notFound: string;
    /** Messages for the service's domain error codes (404, 409 and refused 400s). */
    codes: Record<string, string>;
}

/** The change may or may not have been saved: the service didn't answer in time or failed. */
export function maybeNotSavedMessage(service: string): string {
    return `The ${service} didn't confirm the change, so it may not have been saved. Reload the page to check before trying again.`;
}

interface ValidationIssue {
    path: (string | number)[];
    message: string;
}

function validationIssues(details: unknown): ValidationIssue[] {
    if (!Array.isArray(details)) return [];
    return details.flatMap((issue: unknown) => {
        if (typeof issue !== "object" || issue === null) return [];
        const { path, message } = issue as { path?: unknown; message?: unknown };
        if (typeof message !== "string") return [];
        return [{ path: Array.isArray(path) ? path.filter((part): part is string | number => typeof part === "string" || typeof part === "number") : [], message }];
    });
}

function sentence(text: string): string {
    const trimmed = text.trim();
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/** The form field for a service path: the longest mapped prefix, with any array indexes after it kept. */
function fieldFor(path: (string | number)[], fields: Record<string, string>): string | null {
    for (let length = path.length; length > 0; length -= 1) {
        const mapped = fields[path.slice(0, length).join(".")];
        if (mapped) return [mapped, ...path.slice(length)].join(".");
    }
    return null;
}

function fromValidation(error: ApiError, service: string, fields: Record<string, string>): WriteFailure {
    const fieldErrors: Record<string, string> = {};
    const unplaced: string[] = [];
    for (const issue of validationIssues(error.details)) {
        const field = fieldFor(issue.path, fields);
        if (field) fieldErrors[field] ??= sentence(issue.message);
        else unplaced.push(sentence(issue.message));
    }
    const message = [`The ${service} didn't accept some of the details. Check the highlighted fields.`, ...new Set(unplaced)].join(" ");
    return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}

function fromCode(message: string, code: string, conflictFields: Record<string, string> = {}): WriteFailure {
    const field = conflictFields[code];
    return field ? { message, fieldErrors: { [field]: message } } : { message };
}

/**
 * Whether a failed write may still have been saved: the service didn't answer, timed out, failed with a 5xx or sent a
 * reply that couldn't be read. Refusals (4xx) and expired sessions are not.
 */
export function isUnconfirmedWrite(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    if (error.kind === "network" || error.kind === "timeout" || error.kind === "invalid_response") return true;
    return error.kind === "http" && (error.status ?? 0) >= 500;
}

/** What to show for a failed write. Anything that isn't an API error is a bug and is rethrown. */
export function apiWriteFailure(error: unknown, messages: ServiceErrorMessages, options: WriteErrorOptions = {}): WriteFailure {
    if (!(error instanceof ApiError)) throw error;
    const { service } = messages;
    switch (error.kind) {
        case "unauthorized":
            return { message: "Your session has expired. Sign in again, then check whether the change was saved." };
        case "network":
        case "timeout":
            return { message: maybeNotSavedMessage(service), unconfirmed: true };
        case "invalid_response":
            return { message: `The change was probably saved, but the ${service}'s reply couldn't be read. Reload the page to check before trying again.`, unconfirmed: true };
        case "http":
            break;
    }

    const status = error.status ?? 0;
    const known = messages.codes[error.code];
    if (status === 422 || status === 400) return known ? fromCode(known, error.code, options.conflictFields) : fromValidation(error, service, options.fields ?? {});
    if (status === 403) return { message: messages.forbidden };
    if (status === 404) return known ? fromCode(known, error.code, options.conflictFields) : { message: messages.notFound };
    if (status === 409) return fromCode(known ?? sentence(error.message), error.code, options.conflictFields);
    if (status === 429) return { message: "Too many changes in a short time. Wait a moment, then reload the page and try again." };
    if (status >= 500) return { message: maybeNotSavedMessage(service), unconfirmed: true };
    return { message: sentence(error.message) };
}

/** Runs a write whose reply isn't needed (the page reads the record again), turning a refusal into what the form shows. */
export async function settleWrite(request: Promise<unknown>, messages: ServiceErrorMessages, options: WriteErrorOptions = {}): Promise<WriteResult> {
    try {
        await request;
        return { ok: true };
    } catch (error) {
        const { message, fieldErrors } = apiWriteFailure(error, messages, options);
        return fieldErrors ? { ok: false, message, fieldErrors } : { ok: false, message };
    }
}
