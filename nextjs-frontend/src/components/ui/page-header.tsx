import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Small label above the title, e.g. the section or entity type. */
    eyebrow?: ReactNode;
    back?: { href: string; label: string };
    actions?: ReactNode;
    /** Extra row under the description (badges, key facts). */
    meta?: ReactNode;
    className?: string;
}

export function PageHeader({ title, description, eyebrow, back, actions, meta, className }: PageHeaderProps) {
    return (
        <header className={cn("mb-6 flex flex-col gap-4 sm:mb-8", className)}>
            {back && (
                <Link
                    href={back.href}
                    className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm text-fg-muted hover:text-fg"
                >
                    <ChevronLeft aria-hidden className="size-4" />
                    {back.label}
                </Link>
            )}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    {eyebrow && (
                        <p className="mb-1.5 text-xs font-semibold tracking-[0.08em] text-fg-subtle uppercase">{eyebrow}</p>
                    )}
                    <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance text-fg sm:text-[28px]">
                        {title}
                    </h1>
                    {description && <p className="mt-1.5 max-w-3xl text-[15px] text-pretty text-fg-muted">{description}</p>}
                    {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
            </div>
        </header>
    );
}
