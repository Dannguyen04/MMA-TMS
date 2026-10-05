import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";
import type { User } from "@/lib/domain/types";

/** Helpers shared by the API-mode adapters in this folder. Demo mode never reaches them. */

export function isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404;
}

/** Resolves to null when the API answers 404; every other failure still throws. */
export async function nullIfNotFound<T>(request: Promise<T>): Promise<T | null> {
    try {
        return await request;
    } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
    }
}

/**
 * Resolves to null when a service the page only leans on fails (an error status, unreachable, an unexpected answer), so
 * the rest of the page still loads. A lapsed session still throws.
 */
export async function nullIfServiceFails<T>(request: Promise<T>): Promise<T | null> {
    try {
        return await request;
    } catch (error) {
        if (error instanceof ApiError && error.kind !== "unauthorized") return null;
        throw error;
    }
}

/** Resolves to null when the caller may not read the record (403) or it no longer exists (404); anything else throws. */
export async function nullIfUnreadable<T>(request: Promise<T>): Promise<T | null> {
    try {
        return await request;
    } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
        throw error;
    }
}

/**
 * Refuses an operation the API doesn't offer yet with 501 API_OPERATION_UNSUPPORTED, instead of falling back to
 * demo data. Pages hide those features up front (see the feature gates), so this is only a backstop.
 */
export function unsupportedOperation(operation: string, missingCapability: string): never {
    throw new ApiError({
        message: `${operation} is unavailable because the backend does not yet support ${missingCapability}.`,
        kind: "http",
        status: 501,
        code: "API_OPERATION_UNSUPPORTED",
        details: { operation, missingCapability },
    });
}

/**
 * The list of fighters the caller may read. Sports doctors can't use `GET /fighters` (the service gives them no
 * fighter-directory permission), so their assigned roster has its own route; it takes the same filters.
 */
export function fighterRosterPath(user: Pick<User, "role" | "profileId">): string {
    return user.role === "doctor" && user.profileId ? `/doctors/${encodeURIComponent(user.profileId)}/fighters` : "/fighters";
}

type QueryValue = string | number | boolean | null | undefined;

/** Appends the non-empty values as a query string. */
export function queryPath(path: string, values: Record<string, QueryValue>): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
    const encoded = query.toString();
    return encoded ? `${path}?${encoded}` : path;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const MAX_ITEMS = 500;

/**
 * The two shapes the service's `?page=&limit=` lists answer with: `{ data, total, hasNextPage }` (fighters,
 * training, medical) and `{ items, total, page, limit }` (users).
 */
function numberedPageSchema<T extends z.ZodType>(itemSchema: T) {
    const total = z.number().int().nonnegative();
    return z.union([
        z.object({ data: z.array(itemSchema), total, hasNextPage: z.boolean() }),
        z.object({ items: z.array(itemSchema), total, page: z.number().int().positive(), limit: z.number().int().positive() }),
    ]);
}

type NumberedPage<T> = { data: T[]; total: number; hasNextPage: boolean } | { items: T[]; total: number; page: number; limit: number };

function pageContents<T>(page: NumberedPage<T>): { items: T[]; hasNextPage: boolean } {
    return "data" in page ? { items: page.data, hasNextPage: page.hasNextPage } : { items: page.items, hasNextPage: page.page * page.limit < page.total };
}

/**
 * Reads every page of a `?page=&limit=` list endpoint, bounded so a screen that needs the whole
 * (small) set fails loudly instead of silently truncating it.
 */
export async function drainNumberedPages<T extends z.ZodType>(
    path: string,
    itemSchema: T,
    values: Record<string, QueryValue> = {},
): Promise<z.output<T>[]> {
    const items: z.output<T>[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const response: NumberedPage<z.output<T>> = await authenticatedApiRequest(queryPath(path, { page, limit: PAGE_SIZE, ...values }), numberedPageSchema(itemSchema));
        const contents = pageContents(response);
        items.push(...contents.items);
        if (items.length > MAX_ITEMS || response.total > MAX_ITEMS) {
            throw new ApiError({
                message: `The service returned more than the configured ${MAX_ITEMS} item limit.`,
                kind: "invalid_response",
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        }
        if (!contents.hasNextPage) return items;
    }
    throw new ApiError({
        message: `The service exceeded the configured ${MAX_PAGES} page limit.`,
        kind: "invalid_response",
        code: "PAGINATION_LIMIT_EXCEEDED",
    });
}
