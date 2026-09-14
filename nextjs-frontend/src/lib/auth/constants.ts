/**
 * Auth constants shared by the proxy, server actions and the login screen.
 * Mock authentication: replace the session implementation in ./session.ts when the
 * NestJS auth endpoints are available — nothing else needs to change.
 */

export const SESSION_COOKIE = "mma_session";
export const THEME_COOKIE = "mma_theme";

/** Password accepted for every demo account. */
export const DEMO_PASSWORD = "mma-demo";

export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | undefined): ThemePreference {
    return value === "light" || value === "dark" ? value : "system";
}

/**
 * Whether the mock cookie session may be used. The mock trusts a plain user id, so production
 * deployments keep it off unless ALLOW_DEMO_AUTH=true is set on purpose (it exposes all data).
 * Read at call time, never at module load: `next build` evaluates modules in production mode.
 * Server-only — the variable isn't available in the browser.
 */
export function isDemoAuthEnabled(): boolean {
    return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH === "true";
}
