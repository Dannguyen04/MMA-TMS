"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { useLocale } from "@/components/i18n/locale-provider";
import {
    formatSuspensionMessage,
    pickPrimarySuspension,
    suspensionReasonLabel,
    type TrainingBlockingSuspension,
} from "@/lib/domain/suspension-rules";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface SuspensionBlockCardProps {
    suspensions?: readonly TrainingBlockingSuspension[];
    fallbackMessage?: string;
    className?: string;
    locale?: Locale;
}

/**
 * Reusable 409 explanation card for training conflicts with suspensions.
 * Shared across session reschedule, edit, create, and start flows.
 */
export function SuspensionBlockCard({
    suspensions,
    fallbackMessage,
    className,
    locale,
}: SuspensionBlockCardProps) {
    const ctxLocale = useLocale();
    const activeLocale: Locale = locale ?? ctxLocale;
    const t = createTranslator(activeLocale);

    const primary = suspensions && suspensions.length > 0 ? pickPrimarySuspension(suspensions) : null;

    if (!primary) {
        return (
            <div
                role="alert"
                className={cn(
                    "flex items-start gap-2.5 rounded-xl border border-warning-border/80 bg-warning-soft/30 p-3.5 text-xs text-fg",
                    className,
                )}
            >
                <AlertTriangle className="size-4 shrink-0 text-warning-solid mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                    {fallbackMessage || t("training.error.suspensionActiveGeneral")}
                </p>
            </div>
        );
    }

    const reasonLabel = suspensionReasonLabel(primary.reason, t);
    const explanation = formatSuspensionMessage(primary, t);

    const hasGradedReturn = Boolean(primary.gradedReturn);
    const showLadder =
        hasGradedReturn ||
        (primary.maxAllowedTier !== undefined && primary.maxAllowedTier !== null);

    return (
        <div
            role="alert"
            className={cn(
                "flex flex-col gap-2.5 rounded-xl border border-warning-border/80 bg-warning-soft/30 p-3.5 text-xs text-fg",
                className,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-warning-solid" aria-hidden="true" />
                    <span className="font-semibold text-fg">{reasonLabel}</span>
                </div>
                <Link
                    href={routes.coach.suspensions}
                    className="inline-flex items-center gap-1 font-medium text-primary-soft-fg hover:underline"
                >
                    <span>{t("training.actions.viewSuspensions")}</span>
                    <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
            </div>

            <p className="text-fg leading-relaxed">{explanation}</p>

            {showLadder && (
                <div className="pt-0.5">
                    {hasGradedReturn && primary.gradedReturn ? (
                        <IntensityLadder
                            size="sm"
                            maxAllowedTier={5}
                            ceiling={primary.gradedReturn.ceiling}
                            locale={activeLocale}
                        />
                    ) : (
                        <IntensityLadder
                            size="sm"
                            maxAllowedTier={primary.maxAllowedTier!}
                            locale={activeLocale}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
