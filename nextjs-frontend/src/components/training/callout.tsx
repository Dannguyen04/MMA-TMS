import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TONE_SOFT, TONE_TEXT, type Tone } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

export interface CalloutProps {
    tone: Tone;
    icon: LucideIcon;
    title: ReactNode;
    children?: ReactNode;
    /** Right-aligned (stacked on mobile) link or button. */
    action?: ReactNode;
    /** Use "status" for results that appear after an interaction. */
    role?: "note" | "status" | "alert";
    className?: string;
}

/** Calm inline notice: what, why and what to do. Tone plus icon plus words — never colour alone. */
export function Callout({ tone, icon: Icon, title, children, action, role = "note", className }: CalloutProps) {
    return (
        <div
            role={role}
            className={cn("flex flex-col gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset sm:flex-row sm:items-center", TONE_SOFT[tone], className)}
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", TONE_TEXT[tone])} strokeWidth={2.25} />
                <div className="min-w-0 text-sm">
                    <p className="font-semibold text-fg">{title}</p>
                    {children && <div className="mt-0.5 text-pretty text-fg-muted">{children}</div>}
                </div>
            </div>
            {action && <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[30px] sm:pl-0">{action}</div>}
        </div>
    );
}
