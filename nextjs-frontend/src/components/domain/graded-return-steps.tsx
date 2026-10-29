import { Check, Swords } from "lucide-react";
import { computeGradedReturnSteps } from "@/lib/domain/intensity-tiers";
import type { GradedReturn } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface GradedReturnStepsProps {
    gradedReturn: GradedReturn | null;
    locale?: Locale;
    className?: string;
}

export function GradedReturnSteps({
    gradedReturn,
    locale = "vi",
    className,
}: GradedReturnStepsProps) {
    if (!gradedReturn) {
        return null;
    }

    const t = createTranslator(locale);
    const steps = computeGradedReturnSteps(gradedReturn, locale);
    const formattedFullReturn = formatShortDate(gradedReturn.fullReturnOn, locale);
    const summaryText = t("gradedReturn.summary", { date: formattedFullReturn });

    return (
        <section
            aria-label={t("gradedReturn.regionLabel")}
            className={cn("rounded-md border border-border bg-surface p-3.5", className)}
        >
            <ol className="flex items-start w-full" role="list">
                {steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;

                    return (
                        <li key={step.id} className={cn("flex items-start", isLast ? "flex-initial" : "flex-1")}>
                            <div className="flex flex-col items-center shrink-0 w-24 text-center">
                                {/* Step indicator node */}
                                <div
                                    aria-current={step.status === "current" ? "step" : undefined}
                                    className={cn(
                                        "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                                        step.status === "passed" && "bg-success-solid text-white",
                                        step.status === "current" &&
                                            "bg-info-solid text-white ring-2 ring-info-solid ring-offset-2 ring-offset-surface",
                                        step.status === "upcoming" &&
                                            "bg-surface-muted text-neutral-fg border border-border-strong",
                                    )}
                                    title={`${step.label} (${step.statusText})`}
                                >
                                    {step.status === "passed" ? (
                                        <Check className="size-4 stroke-[2.5]" aria-hidden="true" />
                                    ) : (
                                        <span>{step.stepNumber}</span>
                                    )}
                                </div>

                                {/* sr-only status text */}
                                <span className="sr-only">({step.statusText})</span>

                                {/* Step label & date */}
                                <span
                                    className={cn(
                                        "mt-1.5 text-xs font-medium leading-tight",
                                        step.status === "current" ? "text-info-fg font-semibold" : "text-fg",
                                    )}
                                >
                                    {step.label}
                                </span>
                                <span
                                    className={cn(
                                        "mt-0.5 text-[11px] leading-tight",
                                        step.status === "current" ? "text-info-fg font-medium" : "text-fg-subtle",
                                    )}
                                >
                                    {step.dateFormatted}
                                </span>
                            </div>

                            {/* Connecting line that touches next node */}
                            {!isLast && (
                                <div
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-3.5 h-0.5 flex-1",
                                        step.status === "passed" ? "bg-success-solid" : "bg-border-strong",
                                    )}
                                />
                            )}
                        </li>
                    );
                })}
            </ol>

            {/* Summary sentence */}
            <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2 text-xs text-neutral-fg">
                <Swords className="size-3.5 shrink-0 text-neutral-solid" aria-hidden="true" />
                <span className="font-medium text-fg">{summaryText}</span>
            </div>
        </section>
    );
}
