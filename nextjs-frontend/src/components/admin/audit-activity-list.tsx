import { Bot, CircleCheck, CircleX } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { TONE_SOFT } from "@/components/ui/tone";
import type { AuditLog } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { actorCaption, AUDIT_RESOURCE_LABELS } from "./admin-format";

export interface AuditActivityListProps {
    entries: AuditLog[];
    /** Server time (ISO) for relative timestamps. */
    now: string;
    /** Hide the actor when every entry belongs to the same person (user detail page). */
    showActor?: boolean;
    className?: string;
}

/** Compact list of audit entries with a result icon, actor, action and resource. */
export function AuditActivityList({ entries, now, showActor = true, className }: AuditActivityListProps) {
    return (
        <ul className={cn("divide-y divide-border", className)}>
            {entries.map((entry) => {
                const failed = entry.status === "failure";
                const StatusIcon = failed ? CircleX : CircleCheck;
                return (
                    <li key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 px-5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        <span
                            className={cn(
                                "row-span-2 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset sm:row-span-1",
                                TONE_SOFT[failed ? "danger" : "success"],
                            )}
                        >
                            <StatusIcon aria-hidden className="size-3.5" />
                            <span className="sr-only">{failed ? "Failed" : "Succeeded"}:</span>
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {showActor && (
                                    <span className="flex max-w-full min-w-0 items-center gap-1.5 text-sm font-medium text-fg">
                                        {entry.actorRole === "system" ? (
                                            <Bot aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                                        ) : (
                                            <Avatar name={entry.actorName} size="xs" shape={entry.actorRole === "fighter" ? "octagon" : "circle"} />
                                        )}
                                        <span className="truncate">{entry.actorName}</span>
                                        <span className="shrink-0 font-normal whitespace-nowrap text-fg-subtle">{actorCaption(entry.actorRole)}</span>
                                    </span>
                                )}
                                <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-fg-muted ring-1 ring-border ring-inset">
                                    {entry.action}
                                </code>
                            </div>
                            <p className="mt-1 truncate text-[13px] text-fg-muted" title={entry.resourceLabel}>
                                <span className="text-fg-subtle">{AUDIT_RESOURCE_LABELS[entry.resourceType]}:</span> {entry.resourceLabel}
                            </p>
                            {failed && entry.details && <p className="mt-0.5 text-[13px] text-danger-fg">{entry.details}</p>}
                        </div>
                        <time
                            dateTime={entry.timestamp}
                            title={formatDateTime(entry.timestamp)}
                            className="col-start-2 mt-1 text-xs whitespace-nowrap text-fg-subtle sm:col-start-3 sm:row-start-1 sm:mt-0 sm:pt-0.5"
                        >
                            {formatRelative(entry.timestamp, now)}
                        </time>
                    </li>
                );
            })}
        </ul>
    );
}
