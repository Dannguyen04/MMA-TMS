import { ArrowRight, CircleCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { TONE_SOFT, TONE_TEXT, type Tone } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

export interface AttentionItem {
    id: string;
    tone: Tone;
    icon: LucideIcon;
    /** Short category, e.g. "Not cleared" or "Follow-up due". */
    kind: string;
    fighterName: string;
    fighterHref: string;
    /** What needs attention, in one line. */
    title: string;
    /** Why, and by when. */
    detail: ReactNode;
    /** Extra labels such as AI badges. */
    badges?: ReactNode;
    action: { href: string; label: string };
}

/** Prioritised clinical to-do list: each row says what, why, and links straight to the next step. */
export function AttentionList({ items, className }: { items: AttentionItem[]; className?: string }) {
    if (items.length === 0) {
        return (
            <EmptyState
                compact
                icon={<CircleCheck />}
                title="Nothing needs your attention"
                description="Every assigned fighter has a valid clearance, no follow-ups are due this week and there are no new AI observations."
                className={className}
            />
        );
    }

    return (
        <ol className={cn("flex flex-col divide-y divide-border", className)}>
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <li key={item.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span
                                aria-hidden
                                className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", TONE_SOFT[item.tone])}
                            >
                                <Icon className="size-[18px]" strokeWidth={2.25} />
                            </span>
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className={cn("text-[11px] font-semibold tracking-wide uppercase", TONE_TEXT[item.tone])}>{item.kind}</span>
                                    {item.badges}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-pretty text-fg">{item.title}</p>
                                {/* Inline flow, not flex: long details wrap inside the text instead of leaving "Name ·" alone on a line. */}
                                <p className="mt-0.5 text-[13px] leading-6 text-fg-muted">
                                    <Link href={item.fighterHref} className="inline-flex items-center gap-1.5 rounded-sm align-top font-medium text-fg hover:underline">
                                        <Avatar name={item.fighterName} shape="octagon" size="xs" />
                                        {item.fighterName}
                                    </Link>
                                    <span aria-hidden>&nbsp;·</span> {item.detail}
                                </p>
                            </div>
                        </div>
                        <ButtonLink href={item.action.href} variant="secondary" size="sm" className="self-start sm:self-center">
                            {item.action.label}
                            <span className="sr-only"> for {item.fighterName}</span>
                            <ArrowRight aria-hidden />
                        </ButtonLink>
                    </li>
                );
            })}
        </ol>
    );
}
