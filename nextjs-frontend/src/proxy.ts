import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { apiEndpoint } from "@/lib/api/endpoint";
import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, DEMO_SESSION_COOKIE, REFRESH_TOKEN_COOKIE, isDemoAuthEnabled } from "@/lib/auth/constants";
import { ACCESS_TOKEN_REFRESH_MARGIN_SECONDS, refreshedSessionSchema, sessionCookies } from "@/lib/auth/session-tokens";
import { routes } from "@/lib/routes";

const PUBLIC_PATHS = [routes.login, routes.forgotPassword];

/** Sent on every response the proxy returns: no framing (clickjacking), no cross-site referrers, no MIME sniffing. */
const SECURITY_HEADERS: Record<string, string> = {
    "Content-Security-Policy": "frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
};

function withSecurityHeaders(response: NextResponse): NextResponse {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    return response;
}

const refreshEnvelopeSchema = z.object({ success: z.literal(true), data: refreshedSessionSchema });

async function refreshIfNeeded(request: NextRequest, response: NextResponse): Promise<NextResponse> {
    const expiresAt = Number(request.cookies.get(ACCESS_EXPIRES_COOKIE)?.value ?? 0);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(expiresAt) || expiresAt - now > ACCESS_TOKEN_REFRESH_MARGIN_SECONDS) return response;
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) return response;

    try {
        const refreshResponse = await fetch(apiEndpoint("/auth/refresh"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
            cache: "no-store",
        });
        if (!refreshResponse.ok) return response;
        const envelope = refreshEnvelopeSchema.safeParse(await refreshResponse.json());
        if (!envelope.success) return response;
        // Without a usable access token the request would render signed-out, so replay it with the new cookies.
        if (!request.cookies.has(ACCESS_TOKEN_COOKIE) || expiresAt <= now) response = withSecurityHeaders(NextResponse.redirect(request.url));
        for (const { name, value, options } of sessionCookies(envelope.data.data.session)) response.cookies.set(name, value, options);
    } catch {
        // Backend vẫn là nơi quyết định phiên có hợp lệ hay không; Proxy chỉ làm mới chủ động.
    }
    return response;
}

/**
 * Optimistic auth gate: sends visitors without a session cookie to the login screen and refreshes an
 * access token that is about to expire. Real authorization happens in layouts (requireRole), Route
 * Handlers and every Server Action.
 */
export async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    // API route handlers authenticate themselves and answer with JSON (401), never a login redirect.
    const isApi = pathname === "/api" || pathname.startsWith("/api/");

    const hasSession = isDemoAuthEnabled()
        ? request.cookies.has(DEMO_SESSION_COOKIE)
        : request.cookies.has(ACCESS_TOKEN_COOKIE) || request.cookies.has(REFRESH_TOKEN_COOKIE);
    if (!isPublic && !isApi && !hasSession) {
        const loginUrl = new URL(routes.login, request.url);
        if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
        return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return refreshIfNeeded(request, withSecurityHeaders(NextResponse.next()));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
