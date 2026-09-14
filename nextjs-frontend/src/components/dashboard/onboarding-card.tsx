import { ArrowRight, Circle, CircleCheck } from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    done: boolean;
    href: string;
    actionLabel: string;
}

/** Getting-started checklist for fighters who joined recently. */
export function OnboardingCard({ steps, className }: { steps: OnboardingStep[]; className?: string }) {
    const done = steps.filter((step) => step.done).length;

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title="Getting started"
                description="A few steps to set up your training profile. Your coach and sports doctor handle the rest."
                action={
                    <ProgressBar
                        value={done}
                        max={steps.length}
                        size="sm"
                        label="Getting started steps completed"
                        valueText={`${done} of ${steps.length} done`}
                        className="w-36"
                    />
                }
            />
            <ol className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
                {steps.map((step, index) => (
                    <li
                        key={step.id}
                        className={cn(
                            "relative flex min-w-0 flex-col gap-2 rounded-lg border px-3.5 py-3",
                            step.done ? "border-border bg-surface-muted/60" : "border-border bg-surface",
                        )}
                    >
                        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                            {step.done ? (
                                <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
                            ) : (
                                <Circle aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                            )}
                            <span className="sr-only">{step.done ? "Done: " : `Step ${index + 1}, to do: `}</span>
                            <span className={cn(step.done && "text-fg-muted")}>{step.title}</span>
                        </p>
                        <p className="text-[13px] text-pretty text-fg-muted">{step.description}</p>
                        <Link
                            href={step.href}
                            className="mt-auto inline-flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-primary-soft-fg hover:underline"
                        >
                            {step.actionLabel}
                            <ArrowRight aria-hidden className="size-3.5" />
                        </Link>
                    </li>
                ))}
            </ol>
        </Card>
    );
}
