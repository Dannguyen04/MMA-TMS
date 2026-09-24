/**
 * Server-side NestJS base URL. Kept free of `server-only` so the Proxy can share it with the API client.
 * NEXT_PUBLIC_API_URL is only a legacy fallback.
 */
const apiBaseUrl = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

export function apiEndpoint(path: string): string {
    return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
