"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useVisibleInterval } from "@/components/ui/use-visible-interval";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RefreshControlProps {
    /** Server render time (ISO); changes after every refresh. */
    renderedAt: string;
    /** Refresh on an interval while work is in flight. Null turns auto-refresh off. */
    autoRefreshMs?: number | null;
    className?: string;
}

const TICK_MS = 15_000;

/** "Updated just now" with a Refresh button that re-renders the server data in place. Timers pause while the tab is hidden. */
export function RefreshControl({ renderedAt, autoRefreshMs = null, className }: RefreshControlProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [now, setNow] = useState(renderedAt);
    const [syncedAt, setSyncedAt] = useState(renderedAt);

    // A new server render resets the clock without an effect.
    if (renderedAt !== syncedAt) {
        setSyncedAt(renderedAt);
        setNow(renderedAt);
    }

    const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
    const tickClock = useCallback(() => setNow(new Date().toISOString()), []);

    useVisibleInterval(tickClock, { intervalMs: TICK_MS });
    useVisibleInterval(refresh, { intervalMs: autoRefreshMs ?? TICK_MS, enabled: Boolean(autoRefreshMs) });

    return (
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
            <p className="text-[13px] text-fg-muted" aria-live="polite">
                {pending ? (
                    "Updating…"
                ) : (
                    <>
                        Updated{" "}
                        <time dateTime={renderedAt} title={formatDateTime(renderedAt)}>
                            {formatRelative(renderedAt, now)}
                        </time>
                    </>
                )}
                {autoRefreshMs ? <span className="text-fg-subtle"> · auto-refreshes every {Math.round(autoRefreshMs / 1000)} s while jobs run</span> : null}
            </p>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={pending}>
                <RefreshCw aria-hidden className={cn(pending && "animate-spin")} />
                Refresh
            </Button>
        </div>
    );
}
