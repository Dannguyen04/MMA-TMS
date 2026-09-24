import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";

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

function numberedPageSchema<T extends z.ZodType>(itemSchema: T) {
    return z.object({ data: z.array(itemSchema), total: z.number().int().nonnegative(), hasNextPage: z.boolean() });
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
        const response = await authenticatedApiRequest(queryPath(path, { page, limit: PAGE_SIZE, ...values }), numberedPageSchema(itemSchema));
        items.push(...response.data);
        if (items.length > MAX_ITEMS || response.total > MAX_ITEMS) {
            throw new ApiError({
                message: `The service returned more than the configured ${MAX_ITEMS} item limit.`,
                kind: "invalid_response",
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        }
        if (!response.hasNextPage) return items;
    }
    throw new ApiError({
        message: `The service exceeded the configured ${MAX_PAGES} page limit.`,
        kind: "invalid_response",
        code: "PAGINATION_LIMIT_EXCEEDED",
    });
}
