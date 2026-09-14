import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface StateProps {
    title: string;
    description?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    /** Compact variant for use inside cards and tables. */
    compact?: boolean;
    className?: string;
}

export function EmptyState({ title, description, icon, action, compact, className }: StateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "gap-2 px-4 py-8" : "gap-3 rounded-xl border border-dashed border-border-strong px-6 py-14",
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "octagon flex items-center justify-center bg-surface-muted text-fg-subtle",
                    compact ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-6",
                )}
            >
                {icon ?? <Inbox />}
            </span>
            <div className="max-w-sm">
                <p className={cn("font-semibold text-fg", compact ? "text-sm" : "text-base")}>{title}</p>
                {description && <p className="mt-1 text-sm text-pretty text-fg-muted">{description}</p>}
            </div>
            {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
        </div>
    );
}

export function ErrorState({ title, description, icon, action, compact, className }: StateProps) {
    return (
        <div
            role="alert"
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "gap-2 px-4 py-8" : "gap-3 rounded-xl border border-danger-border bg-danger-soft/40 px-6 py-14",
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "octagon flex items-center justify-center bg-danger-soft text-danger-fg",
                    compact ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-6",
                )}
            >
                {icon ?? <CircleAlert />}
            </span>
            <div className="max-w-md">
                <p className={cn("font-semibold text-fg", compact ? "text-sm" : "text-base")}>{title}</p>
                {description && <p className="mt-1 text-sm text-pretty text-fg-muted">{description}</p>}
            </div>
            {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
        </div>
    );
}
