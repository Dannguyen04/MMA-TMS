import { ArrowRight, Circle, CircleCheck } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    done: boolean;
    href: string;
    actionLabel: string;
}

/** One-line getting-started checklist for fighters who joined recently: every step at a glance, and the next one to do. */
export function OnboardingStrip({ steps, className }: { steps: OnboardingStep[]; className?: string }) {
    const done = steps.filter((step) => step.done).length;
    const next = steps.find((step) => !step.done);

    return (
        <section
            aria-labelledby="getting-started-heading"
            className={cn("flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-5 py-4 lg:flex-row lg:items-center lg:gap-6", className)}
        >
            <h2 id="getting-started-heading" className="shrink-0 font-display text-[16px] font-bold tracking-[0.06em] text-fg uppercase">
                Getting started{" "}
                <span className="text-fg-muted">
                    {done}/{steps.length}
                </span>
            </h2>
            <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {steps.map((step, index) => (
                    <li key={step.id} className="flex items-center gap-1.5">
                        {step.done ? (
                            <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
                        ) : (
                            <Circle aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                        )}
                        <span className="sr-only">{step.done ? "Done: " : `Step ${index + 1}, to do: `}</span>
                        <span className={step.done ? "text-fg-muted" : "font-medium text-fg"}>{step.title}</span>
                    </li>
                ))}
            </ol>
            {next && (
                <p className="flex min-w-0 flex-col gap-1 text-[13px] text-fg-muted lg:ml-auto lg:max-w-sm lg:items-end lg:text-right">
                    <span className="text-pretty">{next.description}</span>
                    <Link href={next.href} className="inline-flex w-fit items-center gap-1 rounded-sm font-medium text-primary-soft-fg hover:underline">
                        {next.actionLabel}
                        <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                </p>
            )}
        </section>
    );
}
