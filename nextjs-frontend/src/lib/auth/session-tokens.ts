import { z } from "zod";

import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./constants";

/**
 * Session token contract and cookie layout shared by the Proxy, Route Handlers and Server Actions.
 * Deliberately not `server-only` so the Proxy can import it; it holds no secrets itself.
 */

export const sessionTokensSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number().int().nullable(),
    expiresIn: z.number().int().positive(),
});

export type SessionTokens = z.output<typeof sessionTokensSchema>;

/** `data` of a successful POST /auth/refresh. */
export const refreshedSessionSchema = z.object({ session: sessionTokensSchema });

/** The access token is refreshed once it has less than this many seconds left. */
export const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60;

/** The refresh token and the expiry marker outlive the access token so the session can be renewed. */
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface SessionCookie {
    name: string;
    value: string;
    options: { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge: number };
}

/** The HTTP-only session cookies for a token pair; one definition so the flags can't drift between writers. */
export function sessionCookies(session: SessionTokens): SessionCookie[] {
    const common = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" } as const;
    const expiresAt = session.expiresAt ?? Math.floor(Date.now() / 1000) + session.expiresIn;
    return [
        { name: ACCESS_TOKEN_COOKIE, value: session.accessToken, options: { ...common, maxAge: session.expiresIn } },
        { name: REFRESH_TOKEN_COOKIE, value: session.refreshToken, options: { ...common, maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS } },
        { name: ACCESS_EXPIRES_COOKIE, value: String(expiresAt), options: { ...common, maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS } },
    ];
}
