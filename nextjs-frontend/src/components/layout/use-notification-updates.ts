"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const STREAM_URL = "/api/notifications/stream";
const COUNT_URL = "/api/notifications/unread-count";
const POLL_MS = 45_000;
const REFRESH_DEBOUNCE_MS = 400;

/** The unread count from the polling route; null when it can't be read (signed out, service down). */
async function fetchUnreadCount(): Promise<number | null> {
    try {
        const response = await fetch(COUNT_URL, { cache: "no-store" });
        if (!response.ok) return null;
        const { count } = (await response.json()) as { count?: unknown };
        return typeof count === "number" ? count : null;
    } catch {
        return null;
    }
}

/**
 * Keeps the bell current. With a live service it follows the notification stream and reloads the page's data when a
 * notification arrives or is read elsewhere, and after a reconnect, because the stream doesn't replay what it missed.
 * While the stream is down, or where there is none (demo), it polls the unread count, also when the window regains
 * focus, and reloads only when that count changes.
 */
export function useNotificationUpdates({ unread, live }: { unread: number; live: boolean }) {
    const router = useRouter();
    const shown = useRef(unread);

    useEffect(() => {
        shown.current = unread;
    }, [unread]);

    useEffect(() => {
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        let pollTimer: ReturnType<typeof setInterval> | undefined;
        let source: EventSource | null = null;
        let dropped = false;

        const refresh = () => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
        };
        const check = async () => {
            const count = await fetchUnreadCount();
            if (count !== null && count !== shown.current) refresh();
        };
        const startPolling = () => {
            if (pollTimer !== undefined) return;
            pollTimer = setInterval(check, POLL_MS);
            window.addEventListener("focus", check);
        };
        const stopPolling = () => {
            clearInterval(pollTimer);
            pollTimer = undefined;
            window.removeEventListener("focus", check);
        };

        if (live && typeof EventSource !== "undefined") {
            source = new EventSource(STREAM_URL);
            source.addEventListener("ready", () => {
                stopPolling();
                if (dropped) refresh();
                dropped = false;
            });
            for (const event of ["notification.created", "notification.read", "resync"]) source.addEventListener(event, refresh);
            // EventSource reconnects on its own, also while the relay reports the service as down; signing out ends it.
            source.addEventListener("error", () => {
                dropped = true;
                startPolling();
            });
        } else {
            startPolling();
        }

        return () => {
            source?.close();
            stopPolling();
            clearTimeout(refreshTimer);
        };
    }, [live, router]);
}
