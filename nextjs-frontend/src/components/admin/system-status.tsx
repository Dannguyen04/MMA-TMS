import { ChevronRight, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { plural, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface AttentionItem {
    id: string;
    icon: LucideIcon;
    title: string;
    description: string;
    href: string;
    actionLabel: string;
}

/** "All systems normal" or a short, specific list of what needs an administrator. */
export function SystemStatus({ items, checkedLabel, className, t }: { items: AttentionItem[]; checkedLabel: string; className?: string; t: Translator }) {
    const healthy = items.length === 0;
    return (
        <section
            aria-labelledby="system-status-title"
            className={cn(
                "rounded-xl border shadow-card",
                healthy ? "border-success-border bg-success-soft/50" : "border-warning-border bg-warning-soft/50",
                className,
            )}
        >
            <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                <span
                    aria-hidden
                    className={cn(
                        "octagon flex size-9 shrink-0 items-center justify-center",
                        healthy ? "bg-success-solid text-primary-fg" : "bg-warning-solid text-warning-solid-fg",
                    )}
                >
                    {healthy ? <CircleCheck className="size-[18px]" /> : <TriangleAlert className="size-[18px]" />}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id="system-status-title" className={cn("text-[15px] font-semibold", healthy ? "text-success-fg" : "text-warning-fg")}>
                        {healthy ? t("adminBody.system.normal") : plural(t, "adminBody.system.needs", items.length)}
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        {healthy ? t("adminBody.system.normalText") : t("adminBody.system.review")}
                    </p>
                </div>
                <p className="w-full text-xs text-fg-subtle sm:w-auto sm:pt-1">{checkedLabel}</p>
            </div>
            {!healthy && (
                <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl border-t border-warning-border bg-warning-border md:grid-cols-2">
                    {items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.id} className="min-w-0 bg-surface md:odd:last:col-span-2">
                                <Link href={item.href} className="group flex h-full items-start gap-3 px-5 py-3 hover:bg-surface-muted">
                                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium text-fg">{item.title}</span>
                                        <span className="mt-0.5 block text-[13px] text-fg-muted">{item.description}</span>
                                    </span>
                                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-primary-soft-fg group-hover:underline">
                                        {item.actionLabel}
                                        <ChevronRight aria-hidden className="size-3.5" />
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
