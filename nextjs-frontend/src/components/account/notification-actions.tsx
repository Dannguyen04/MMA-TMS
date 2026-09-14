"use client";

import { ArrowRight, Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { markAllRead, markRead } from "@/lib/actions/notifications";

/** Header action: marks every notification as read and confirms with a toast. */
export function MarkAllReadButton({ unread }: { unread: number }) {
    const toast = useToast();
    const [pending, startTransition] = useTransition();

    const onClick = () =>
        startTransition(async () => {
            const result = await markAllRead();
            if (result.status === "error") {
                toast({ title: "Couldn't mark notifications as read", description: result.message, tone: "error" });
            } else {
                toast({ title: "All caught up", description: result.message });
            }
        });

    return (
        <Button onClick={onClick} loading={pending} disabled={unread === 0}>
            {!pending && <CheckCheck aria-hidden />}
            Mark all as read
        </Button>
    );
}

export interface NotificationItemActionsProps {
    id: string;
    title: string;
    href: string | null;
    unread: boolean;
}

/**
 * "Mark as read" and "Open" (which also marks the item read) for one notification. After marking
 * read the button disappears, so focus moves to the item's Open link or the item itself.
 */
export function NotificationItemActions({ id, title, href, unread }: NotificationItemActionsProps) {
    const toast = useToast();
    const [pending, startTransition] = useTransition();
    const rootRef = useRef<HTMLDivElement>(null);
    const restoreFocus = useRef(false);

    useEffect(() => {
        if (unread || !restoreFocus.current) return;
        restoreFocus.current = false;
        const root = rootRef.current;
        const target = root?.querySelector<HTMLElement>("a") ?? root?.closest<HTMLElement>("[data-notification]");
        target?.focus();
    }, [unread]);

    const onMarkRead = () =>
        startTransition(async () => {
            restoreFocus.current = true;
            const result = await markRead(id);
            if (result.status === "error") {
                restoreFocus.current = false;
                toast({ title: "Couldn't mark as read", description: result.message, tone: "error" });
            }
        });

    return (
        <div ref={rootRef} className="flex shrink-0 flex-wrap items-center gap-1.5 empty:hidden">
            {unread && (
                <Button variant="ghost" size="sm" onClick={onMarkRead} loading={pending}>
                    {!pending && <Check aria-hidden />}
                    Mark as read
                    <span className="sr-only">: {title}</span>
                </Button>
            )}
            {href && (
                <ButtonLink
                    href={href}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                        if (unread) void markRead(id);
                    }}
                >
                    Open
                    <span className="sr-only">: {title}</span>
                    <ArrowRight aria-hidden />
                </ButtonLink>
            )}
        </div>
    );
}
