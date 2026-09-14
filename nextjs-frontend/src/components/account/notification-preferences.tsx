"use client";

import { CircleAlert, CircleCheck, HardDrive, Lock, RotateCcw } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { NOTIFICATION_CATEGORY_ICONS } from "@/components/domain/notification-meta";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { SwitchInput } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { NOTIFICATION_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { NotificationCategory, Role } from "@/lib/domain/types";
import { categoryDescription, defaultPreference, isInAppLocked, type ChannelPreference } from "./notification-preference-meta";

type Preferences = Partial<Record<NotificationCategory, ChannelPreference>>;
type Channel = keyof ChannelPreference;

/* ─── Device storage ──────────────────────────────────────────────────────── */

const listeners = new Set<() => void>();
/** Fallback when the browser blocks localStorage: keeps choices for the life of the page. */
const memoryFallback = new Map<string, string>();

function storageKey(userId: string): string {
    return `mma-tms:notification-preferences:v1:${userId}`;
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    window.addEventListener("storage", onChange);
    return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
    };
}

function readStored(key: string): string | null {
    try {
        return window.localStorage.getItem(key) ?? memoryFallback.get(key) ?? null;
    } catch {
        return memoryFallback.get(key) ?? null;
    }
}

/** Returns false when the browser refused to store the value. */
function writeStored(key: string, value: string | null): boolean {
    let persisted = true;
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
        memoryFallback.delete(key);
    } catch {
        persisted = false;
        if (value === null) memoryFallback.delete(key);
        else memoryFallback.set(key, value);
    }
    listeners.forEach((listener) => listener());
    return persisted;
}

function parseStored(raw: string | null): Preferences {
    if (!raw) return {};
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== "object") return {};
        const out: Preferences = {};
        for (const [category, entry] of Object.entries(value)) {
            if (!(category in NOTIFICATION_CATEGORY_LABELS) || !entry || typeof entry !== "object") continue;
            const { inApp, email } = entry as Record<string, unknown>;
            if (typeof inApp === "boolean" && typeof email === "boolean") out[category as NotificationCategory] = { inApp, email };
        }
        return out;
    } catch {
        return {};
    }
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export interface NotificationPreferencesProps {
    userId: string;
    role: Role;
    email: string;
    categories: NotificationCategory[];
}

/** Per-category in-app and email switches, saved in this browser only. */
export function NotificationPreferences({ userId, role, email, categories }: NotificationPreferencesProps) {
    const key = storageKey(userId);
    const raw = useSyncExternalStore(
        subscribe,
        () => readStored(key),
        () => null,
    );
    const [status, setStatus] = useState<"idle" | "saved" | "blocked">("idle");

    const preferences = useMemo(() => {
        const stored = parseStored(raw);
        return Object.fromEntries(
            categories.map((category) => {
                const value = stored[category] ?? defaultPreference(role, category);
                return [category, isInAppLocked(category) ? { ...value, inApp: true } : value];
            }),
        ) as Record<NotificationCategory, ChannelPreference>;
    }, [raw, categories, role]);

    const update = (category: NotificationCategory, channel: Channel, checked: boolean) => {
        const next = { ...preferences, [category]: { ...preferences[category], [channel]: checked } };
        setStatus(writeStored(key, JSON.stringify(next)) ? "saved" : "blocked");
    };

    const reset = () => setStatus(writeStored(key, null) ? "saved" : "blocked");

    return (
        <>
            <Table caption="Notification delivery by category">
                <THead>
                    <tr>
                        <TH>Category</TH>
                        <TH className="w-16 text-center sm:w-20">In-app</TH>
                        <TH className="w-16 text-center sm:w-20">Email</TH>
                    </tr>
                </THead>
                <TBody>
                    {categories.map((category) => {
                        const Icon = NOTIFICATION_CATEGORY_ICONS[category];
                        const label = NOTIFICATION_CATEGORY_LABELS[category];
                        const locked = isInAppLocked(category);
                        const lockedNoteId = `notification-pref-${category}-locked`;
                        return (
                            <TR key={category}>
                                <TD className="py-3.5">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
                                            <Icon className="size-4" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-fg">{label}</p>
                                            <p className="text-[13px] text-pretty text-fg-muted">{categoryDescription(role, category)}</p>
                                            {locked && (
                                                <p id={lockedNoteId} className="mt-1 flex items-start gap-1 text-xs text-fg-subtle">
                                                    <Lock aria-hidden className="mt-0.5 size-3 shrink-0" />
                                                    In-app stays on — clearance decides what training is allowed.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </TD>
                                <TD className="text-center">
                                    <SwitchInput
                                        checked={preferences[category].inApp}
                                        disabled={locked}
                                        onChange={(event) => update(category, "inApp", event.target.checked)}
                                        aria-label={`${label}: in-app notifications`}
                                        aria-describedby={locked ? lockedNoteId : undefined}
                                    />
                                </TD>
                                <TD className="text-center">
                                    <SwitchInput
                                        checked={preferences[category].email}
                                        onChange={(event) => update(category, "email", event.target.checked)}
                                        aria-label={`${label}: email notifications`}
                                    />
                                </TD>
                            </TR>
                        );
                    })}
                </TBody>
            </Table>
            <CardFooter className="flex-col items-start bg-surface-muted/50 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
                        {status === "blocked" ? (
                            <>
                                <CircleAlert aria-hidden className="size-4 shrink-0 text-warning-fg" />
                                This browser blocks storage — changes last until you leave the page.
                            </>
                        ) : status === "saved" ? (
                            <>
                                <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
                                Changes saved on this device
                            </>
                        ) : (
                            <>
                                <HardDrive aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                                Saved on this device
                            </>
                        )}
                    </p>
                    <p className="text-xs break-words text-fg-subtle">
                        Emails go to {email}. Preferences don&apos;t sync to your other browsers yet.
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} disabled={raw === null}>
                    <RotateCcw aria-hidden />
                    Reset to defaults
                </Button>
            </CardFooter>
        </>
    );
}
