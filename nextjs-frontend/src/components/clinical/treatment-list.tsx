"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import type { Treatment } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { TreatmentStatusBadge, TreatmentTypeIcon } from "./clinical-badges";
import { treatmentText } from "./clinical-copy";
import { TreatmentStatusMenu } from "./treatment-status-menu";

export interface TreatmentListProps {
    treatments: Treatment[];
    /** Shows the status change menu on each treatment. */
    editable?: boolean;
    className?: string;
    /** Defaults to the viewer's language. */
    locale?: Locale;
}

/** Treatments in order: type icon, what and who, frequency, dates and status. */
export function TreatmentList({ treatments, editable = false, className, locale: localeProp }: TreatmentListProps) {
    const viewerLocale = useLocale();
    const locale = localeProp ?? viewerLocale;
    const t = createTranslator(locale);
    const notRecorded = t("health.notRecorded");
    return (
        <ul className={cn("flex flex-col divide-y divide-border", className)}>
            {treatments.map((treatment) => (
                <li key={treatment.id} className="flex gap-3 px-5 py-4">
                    <TreatmentTypeIcon type={treatment.type} />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-semibold text-fg">{treatmentText(t, treatment)}</h3>
                            {treatment.status && <TreatmentStatusBadge status={treatment.status} size="sm" />}
                        </div>
                        <p className="mt-0.5 text-sm text-pretty text-fg">{treatment.description}</p>
                        {treatment.type === null ? (
                            // A treatment from the medical service: a dated entry with an optional review, no provider or schedule.
                            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                                <div className="flex gap-1">
                                    <dt>{t("doctorClinical.treatmentList.when")}</dt>
                                    <dd>
                                        <time dateTime={treatment.startDate}>{formatDate(treatment.startDate, locale)}</time>
                                    </dd>
                                </div>
                                {treatment.nextReviewAt && (
                                    <div className="flex gap-1">
                                        <dt>{t("doctorClinical.treatmentList.review")}</dt>
                                        <dd>
                                            <time dateTime={treatment.nextReviewAt}>{formatDate(treatment.nextReviewAt, locale)}</time>
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        ) : (
                            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                                <div className="flex gap-1">
                                    <dt className="sr-only">{t("doctorClinical.treatment.provider")}</dt>
                                    <dd>{treatment.providerName ?? notRecorded}</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt className="sr-only">{t("doctorClinical.treatment.frequency")}</dt>
                                    <dd>{treatment.frequency ?? notRecorded}</dd>
                                </div>
                                <div className="flex gap-1">
                                    <dt className="sr-only">{t("doctorClinical.treatmentList.period")}</dt>
                                    <dd>
                                        <time dateTime={treatment.startDate}>{formatDate(treatment.startDate, locale)}</time>
                                        {" – "}
                                        {treatment.endDate ? <time dateTime={treatment.endDate}>{formatDate(treatment.endDate, locale)}</time> : t("doctorClinical.treatmentList.openEnded")}
                                    </dd>
                                </div>
                            </dl>
                        )}
                        {treatment.notes && (
                            <p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-[13px] text-pretty text-fg-muted">{treatment.notes}</p>
                        )}
                    </div>
                    {editable && treatment.type && treatment.status && (
                        <div className="-mt-1 -mr-2 shrink-0">
                            <TreatmentStatusMenu
                                injuryId={treatment.injuryId}
                                treatmentId={treatment.id}
                                type={treatment.type}
                                status={treatment.status}
                            />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}
