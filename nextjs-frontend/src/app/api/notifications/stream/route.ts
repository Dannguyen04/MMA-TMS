import type { NextRequest } from "next/server";

import { ApiError, apiEndpoint, getMutableAccessToken } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const SSE_HEADERS = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" };
/** How long EventSource waits before trying again while the notification service is down or busy. */
const RETRY_LATER_MS = 30_000;

/** An empty stream with a retry hint: EventSource reconnects later, where an error status would end it for good. */
const retryLater = () => new Response(`retry: ${RETRY_LATER_MS}\n\n`, { headers: SSE_HEADERS });

/**
 * Relays the notification service's live stream on the same origin, signed with the session's token (the browser
 * never sees it, and EventSource can't send headers). Events carry notification ids only: the page reloads the inbox.
 * The upstream request is cancelled when the browser disconnects, so closed tabs don't hold the service's connections.
 */
export async function GET(request: NextRequest) {
    // 204 tells EventSource to stop reconnecting: the demo has no stream, and its bell polls instead.
    if (isDemoAuthEnabled()) return new Response(null, { status: 204, headers: NO_STORE });
    let token: string;
    try {
        token = await getMutableAccessToken();
    } catch (error) {
        // Signed out ends the stream; a refresh that failed because the service is down doesn't.
        return error instanceof ApiError && error.status === 401 ? new Response(null, { status: 401, headers: NO_STORE }) : retryLater();
    }
    try {
        const upstream = await fetch(apiEndpoint("/notifications/stream"), {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            cache: "no-store",
            signal: request.signal,
        });
        if (upstream.ok && upstream.body) return new Response(upstream.body, { headers: SSE_HEADERS });
        // Restarting, overloaded or out of streams: later. Signed out, refused or no stream on offer: the bell polls instead.
        if (upstream.status >= 500 || upstream.status === 429) return retryLater();
        return new Response(null, { status: upstream.ok ? 502 : upstream.status, headers: NO_STORE });
    } catch {
        return retryLater();
    }
}
