"use client";

import { ArrowRight, Radar } from "lucide-react";
import Link from "next/link";

import { AIGeneratedBadge, AlertStatusBadge, ConfidenceBadge } from "@/components/domain/status-badges";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import type { AbnormalMovementAlert, VideoTrainingType } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { describeMetricComparison, regionText, trainingTypeText } from "./clinical-copy";
import { DoctorReviewBlock } from "./doctor-review-block";

export interface ObservationSource {
    trainingType: VideoTrainingType;
    uploadedAt: string;
}

export interface ObservationSummaryProps {
    alert: AbnormalMovementAlert;
    /** The footage the observation came from; null when it is no longer available. */
    source: ObservationSource | null;
    href?: string;
    headingLevel?: 2 | 3;
    className?: string;
}

/** Compact AI movement observation: AI-labelled pattern, confidence, metric vs baseline and the doctor's decision. */
export function ObservationSummary({ alert, source, href, headingLevel = 3, className }: ObservationSummaryProps) {
    const t = useT();
    const locale = useLocale();
    const Heading = headingLevel === 2 ? "h2" : "h3";
    return (
        <article className={cn("flex flex-col gap-3 rounded-xl border border-ai-border bg-surface p-4", className)}>
            <div className="flex items-start gap-3">
                <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai-fg ring-1 ring-inset ring-ai-border"
                >
                    <Radar className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-ai-fg uppercase">{t("doctorClinical.common.aiObservation")}</p>
                    <Heading className="mt-0.5 text-sm leading-snug font-semibold text-pretty text-fg">{alert.pattern}</Heading>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                <AIGeneratedBadge size="sm" locale={locale} />
                <ConfidenceBadge confidence={alert.confidence} size="sm" locale={locale} />
                <AlertStatusBadge status={alert.status} size="sm" />
            </div>

            {/* A <dl> may only hold <dt>/<dd> groups, each in at most one <div>: the groups sit directly in the list and wrap. */}
            <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-ai-soft/40 px-3 py-2.5 text-[13px] text-fg-muted ring-1 ring-inset ring-ai-border/60">
                <div className="mb-1 min-w-0 basis-full">
                    <dt className="text-fg-muted">{alert.metric.label}</dt>
                    <dd className="font-medium text-fg">{describeMetricComparison(alert.metric, t)}</dd>
                </div>
                <div>
                    <dt className="sr-only">{t("doctorClinical.injuryForm.bodyRegion")}</dt>
                    <dd>{regionText(t, alert.bodyRegion)}</dd>
                </div>
                <div>
                    <dt className="sr-only">{t("doctorClinical.common.detected")}</dt>
                    <dd>
                        {t("doctorClinical.common.detected")} <time dateTime={alert.detectedAt}>{formatDate(alert.detectedAt, locale)}</time>
                    </dd>
                </div>
                {source && (
                    <div>
                        <dt className="sr-only">{t("doctorClinical.observation.sourceVideoTerm")}</dt>
                        <dd>{t("doctorClinical.observation.sourceVideoLower", { type: trainingTypeText(t, source.trainingType).toLowerCase() })}</dd>
                    </div>
                )}
            </dl>

            {alert.doctorReview ? (
                <DoctorReviewBlock review={alert.doctorReview} compact />
            ) : (
                <p className="text-[13px] text-fg-muted">{t("doctorClinical.observation.notReviewed")}</p>
            )}

            {href && (
                <Link
                    href={href}
                    className="inline-flex w-fit items-center gap-1 rounded-md text-[13px] font-medium text-primary-soft-fg hover:underline"
                >
                    {t("doctorClinical.observation.open")}
                    <ArrowRight aria-hidden className="size-3.5" />
                </Link>
            )}
        </article>
    );
}
