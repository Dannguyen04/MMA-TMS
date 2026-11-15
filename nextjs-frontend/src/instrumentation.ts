/**
 * Runs once when a Next.js server starts, before it serves a request. Loads the server dictionaries so shared
 * modules that translate through `translate-client` (server actions, route handlers) find them even when no page
 * has loaded `@/lib/i18n/translate` in this process yet (A6 of docs/PERFORMANCE-PLAN.md).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") await import("./lib/i18n/translate");
}
