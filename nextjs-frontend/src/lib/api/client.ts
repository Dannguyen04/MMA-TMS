import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/session-cookies";
import { ACCESS_TOKEN_REFRESH_MARGIN_SECONDS, refreshedSessionSchema } from "@/lib/auth/session-tokens";
import { apiEndpoint } from "./endpoint";

export { apiEndpoint };

const defaultTimeoutMs = 10_000;

const errorEnvelopeSchema = z.object({
    success: z.literal(false),
    error: z.object({
        statusCode: z.number().int(),
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
    }),
});

export type ApiErrorKind = "network" | "timeout" | "http" | "invalid_response" | "unauthorized";

export class ApiError extends Error {
    readonly kind: ApiErrorKind;
    readonly status: number | null;
    readonly code: string;
    readonly details?: unknown;

    constructor(input: { message: string; kind: ApiErrorKind; status?: number | null; code?: string; details?: unknown }) {
        super(input.message);
        this.name = "ApiError";
        this.kind = input.kind;
        this.status = input.status ?? null;
        this.code = input.code ?? "API_ERROR";
        this.details = input.details;
    }
}

function sessionExpiredError(): ApiError {
    return new ApiError({ message: "Your session has expired. Sign in again.", kind: "unauthorized", status: 401, code: "UNAUTHORIZED" });
}

/**
 * JSON reply for a Route Handler whose backend call failed. Only a real error status is forwarded:
 * an invalid 2xx response or a network failure becomes 502 so the browser never sees a "successful" error.
 */
export function apiErrorResponse(error: unknown, fallbackMessage: string, headers: HeadersInit = { "Cache-Control": "no-store" }): Response {
    if (!(error instanceof ApiError)) return Response.json({ message: fallbackMessage }, { status: 502, headers });
    const status = error.status !== null && error.status >= 400 ? error.status : 502;
    return Response.json({ code: error.code, message: error.message }, { status, headers });
}

export interface ApiRequestOptions extends Omit<RequestInit, "cache"> {
    accessToken?: string | null;
    timeoutMs?: number;
}

export interface CursorPage<T> {
    items: T[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    total: number;
}

export interface DrainCursorOptions extends ApiRequestOptions {
    maxItems?: number;
    maxPages?: number;
}

const successEnvelopeSchema = z.object({ success: z.literal(true), message: z.string(), data: z.unknown() });

/** Gọi API nội bộ, không cache và luôn kiểm tra cả envelope lẫn dữ liệu. */
export async function apiRequest<T extends z.ZodType>(path: string, dataSchema: T, options: ApiRequestOptions = {}): Promise<z.output<T>> {
    const { accessToken, timeoutMs = defaultTimeoutMs, headers, ...init } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
        response = await fetch(apiEndpoint(path), {
            ...init,
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(init.body ? { "Content-Type": "application/json" } : {}),
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                ...headers,
            },
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new ApiError({ message: "The service took too long to respond.", kind: "timeout", code: "API_TIMEOUT" });
        }
        throw new ApiError({ message: "The service can't be reached right now.", kind: "network", code: "API_UNAVAILABLE" });
    } finally {
        clearTimeout(timer);
    }

    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const kind = response.status === 401 ? "unauthorized" : "http";
        const parsedError = errorEnvelopeSchema.safeParse(raw);
        if (parsedError.success) {
            const { message, code, details } = parsedError.data.error;
            throw new ApiError({ message, kind, status: response.status, code, details });
        }
        throw new ApiError({ message: `The service responded with ${response.status}.`, kind, status: response.status, code: `HTTP_${response.status}` });
    }

    const envelope = successEnvelopeSchema.safeParse(raw);
    const parsed = envelope.success ? dataSchema.safeParse(envelope.data.data) : null;
    if (!parsed?.success) {
        throw new ApiError({
            message: "The service sent an unexpected response.",
            kind: "invalid_response",
            status: response.status,
            code: "INVALID_API_RESPONSE",
            details: parsed?.error.flatten(),
        });
    }
    return parsed.data;
}

/** Gọi endpoint bằng access token HTTP-only của phiên hiện tại. */
export async function authenticatedApiRequest<T extends z.ZodType>(path: string, dataSchema: T, options: ApiRequestOptions = {}) {
    const store = await cookies();
    const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) throw sessionExpiredError();
    return apiRequest(path, dataSchema, { ...options, accessToken: token });
}

/** Xoay cặp token và ghi lại cookie; phiên bị xóa nếu làm mới thất bại. Chỉ gọi nơi được phép ghi cookie. */
async function refreshSession(refreshToken: string): Promise<string> {
    try {
        const { session } = await apiRequest("/auth/refresh", refreshedSessionSchema, {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
        });
        await setSessionCookies(session);
        return session.accessToken;
    } catch (error) {
        await clearSessionCookies();
        throw error;
    }
}

/** Chỉ dùng trong Server Action hoặc Route Handler để có thể xoay cookie và thử lại đúng một lần. */
export async function authenticatedMutableApiRequest<T extends z.ZodType>(path: string, dataSchema: T, options: ApiRequestOptions = {}) {
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!accessToken) throw sessionExpiredError();

    try {
        return await apiRequest(path, dataSchema, { ...options, accessToken });
    } catch (error) {
        if (!(error instanceof ApiError) || error.kind !== "unauthorized") throw error;
        const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
        if (!refreshToken) throw error;
        return apiRequest(path, dataSchema, { ...options, accessToken: await refreshSession(refreshToken) });
    }
}

/** Lấy access token còn hạn cho Route Handler cần truyền stream mà không thể phát lại body. */
export async function getMutableAccessToken(minimumValiditySeconds = ACCESS_TOKEN_REFRESH_MARGIN_SECONDS): Promise<string> {
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
    const expiresAt = Number(store.get(ACCESS_EXPIRES_COOKIE)?.value ?? 0);
    const now = Math.floor(Date.now() / 1000);
    if (accessToken && Number.isFinite(expiresAt) && expiresAt - now > minimumValiditySeconds) return accessToken;

    const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
        if (accessToken && expiresAt > now) return accessToken;
        throw sessionExpiredError();
    }
    return refreshSession(refreshToken);
}

function cursorPageSchema<T extends z.ZodType>(itemSchema: T) {
    return z.object({
        items: z.array(itemSchema),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        total: z.number().int().nonnegative(),
    });
}

function pathWithCursor(path: string, cursor: string | null): string {
    if (!cursor) return path;
    const [pathname, query = ""] = path.split("?", 2);
    const params = new URLSearchParams(query);
    params.set("cursor", cursor);
    return `${pathname}?${params.toString()}`;
}

/** Gom danh sách phân trang có giới hạn rõ ràng cho các màn hình cũ cần toàn bộ tập dữ liệu nhỏ. */
export async function drainAuthenticatedCursorPages<T extends z.ZodType>(
    path: string,
    itemSchema: T,
    options: DrainCursorOptions = {},
): Promise<z.output<T>[]> {
    const { maxItems = 500, maxPages = 25, ...requestOptions } = options;
    const items: z.output<T>[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        const page: CursorPage<z.output<T>> = await authenticatedApiRequest(pathWithCursor(path, cursor), cursorPageSchema(itemSchema), requestOptions);
        items.push(...page.items);
        if (items.length > maxItems) {
            throw new ApiError({
                message: `The service returned more than the configured ${maxItems} item limit.`,
                kind: "invalid_response",
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        }
        if (!page.pageInfo.hasNextPage) return items;
        const nextCursor = page.pageInfo.endCursor;
        if (!nextCursor || seenCursors.has(nextCursor)) {
            throw new ApiError({
                message: "The service returned an invalid pagination cursor.",
                kind: "invalid_response",
                code: "INVALID_PAGINATION_CURSOR",
            });
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
    }

    throw new ApiError({
        message: `The service exceeded the configured ${maxPages} page limit.`,
        kind: "invalid_response",
        code: "PAGINATION_LIMIT_EXCEEDED",
    });
}
