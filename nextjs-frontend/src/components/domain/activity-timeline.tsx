import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { TONE_SOFT, type Tone } from "@/components/ui/tone";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ActivityTimelineItem {
    id: string;
    icon: LucideIcon;
    title: string;
    description?: string;
    /** ISO timestamp of the event. */
    time: string;
    tone?: Tone;
    href?: string;
}

export interface ActivityTimelineProps {
    items: ActivityTimelineItem[];
    /** Server time (ISO) used for relative times. */
    now: string;
    emptyText?: string;
    className?: string;
}

/** Vertical timeline of recent events. Server Component (icons are component references). */
export function ActivityTimeline({ items, now, emptyText = "No recent activity.", className }: ActivityTimelineProps) {
    if (items.length === 0) {
        return <p className={cn("py-6 text-center text-sm text-fg-muted", className)}>{emptyText}</p>;
    }

    return (
        <ol className={cn("flex flex-col", className)}>
            {items.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === items.length - 1;
                return (
                    <li key={item.id} className={cn("relative flex gap-3", !isLast && "pb-5")}>
                        {!isLast && <span aria-hidden className="absolute top-9 bottom-1 left-[15px] w-px bg-border" />}
                        <span
                            aria-hidden
                            className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                                TONE_SOFT[item.tone ?? "neutral"],
                            )}
                        >
                            <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <p className="min-w-0 text-sm font-medium text-fg">
                                    {item.href ? (
                                        <Link href={item.href} className="rounded-sm hover:underline">
                                            {item.title}
                                        </Link>
                                    ) : (
                                        item.title
                                    )}
                                </p>
                                <time dateTime={item.time} title={formatDateTime(item.time)} className="shrink-0 text-xs text-fg-subtle">
                                    {formatRelative(item.time, now)}
                                </time>
                            </div>
                            {item.description && <p className="mt-0.5 text-[13px] text-pretty text-fg-muted">{item.description}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
