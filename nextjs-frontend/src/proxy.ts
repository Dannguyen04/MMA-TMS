import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
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

/**
 * Optimistic auth gate: sends visitors without a session cookie to the login screen.
 * Real authorization happens in layouts (requireRole) and in every Server Action.
 */
export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    // API route handlers authenticate themselves and answer with JSON (401), never a login redirect.
    const isApi = pathname === "/api" || pathname.startsWith("/api/");

    if (!isPublic && !isApi && !request.cookies.has(SESSION_COOKIE)) {
        const loginUrl = new URL(routes.login, request.url);
        if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
        return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return withSecurityHeaders(NextResponse.next());
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
