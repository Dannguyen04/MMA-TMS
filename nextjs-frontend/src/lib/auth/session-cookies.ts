import "server-only";

import { cookies } from "next/headers";

import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./constants";
import { sessionCookies, type SessionTokens } from "./session-tokens";

/** Chỉ gọi trong Server Action hoặc Route Handler vì đây là các ngữ cảnh được phép ghi cookie. */
export async function setSessionCookies(session: SessionTokens): Promise<void> {
    const store = await cookies();
    for (const { name, value, options } of sessionCookies(session)) store.set(name, value, options);
}

export async function clearSessionCookies(): Promise<void> {
    const store = await cookies();
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
    store.delete(ACCESS_EXPIRES_COOKIE);
}
