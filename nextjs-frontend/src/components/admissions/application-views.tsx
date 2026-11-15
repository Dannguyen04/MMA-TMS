import Link from "next/link";

import { ApplicationStatusBadge, ConclusionBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { applicantName, type ApplicantDetails, type Application } from "@/lib/domain/admissions";
import { weightClassLabel } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/*
 * Read-only pieces of an application, shared by the administrator's and the coach's pages. Each takes the viewer's
 * language as `locale`; English when omitted.
 */

const notGiven = (locale: Locale) => <span className="font-normal text-fg-subtle">{createTranslator(locale)("screens.misc.admissions.notGiven")}</span>;
const longText = (value: string | null, locale: Locale) => (value ? <span className="font-normal whitespace-pre-line">{value}</span> : notGiven(locale));

/** What the applicant told the academy. */
export function ApplicantDetailsList({ details, accountEmail = null, locale = "en" }: { details: ApplicantDetails; accountEmail?: string | null; locale?: Locale }) {
    const t = createTranslator(locale);
    const items: (DescriptionItem | false)[] = [
        { label: t("screens.misc.views.emailWhenApplying"), value: details.email },
        accountEmail !== null && { label: t("screens.misc.views.accountEmailNow"), value: accountEmail },
        { label: t("applicant.form.dateOfBirth"), value: formatDate(details.dateOfBirth, locale) },
        { label: t("applicant.form.weightClass"), value: weightClassLabel(details.weightClass, locale) },
        { label: t("applicant.form.nationality"), value: details.nationality ?? notGiven(locale) },
        { label: t("applicant.form.phone"), value: details.contactPhone ?? notGiven(locale) },
        { label: t("applicant.form.trainingBackground"), value: longText(details.trainingBackground, locale), wide: true },
        { label: t("applicant.form.competitionBackground"), value: longText(details.competitionBackground, locale), wide: true },
        { label: t("screens.misc.views.whyTheyJoin"), value: longText(details.motivation, locale), wide: true },
    ];
    return <DescriptionList items={items.filter((item) => item !== false)} />;
}

/** The coach's entrance assessment: the conclusion, their summary and each thing they checked. */
export function AssessmentView({ assessment, coachName, locale = "en" }: { assessment: NonNullable<Application["assessment"]>; coachName: string; locale?: Locale }) {
    const t = createTranslator(locale);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <ConclusionBadge conclusion={assessment.conclusion} locale={locale} />
                <span className="text-[13px] text-fg-muted">
                    {coachName} · {formatDateTime(assessment.assessedAt, locale)}
                </span>
            </div>
            <p className="text-sm whitespace-pre-line text-fg">{assessment.summary}</p>
            <ol className="divide-y divide-border rounded-lg border border-border" aria-label={t("screens.misc.views.criteriaAssessed")}>
                {assessment.criteria.map((criterion, index) => (
                    <li key={index} className="flex flex-col gap-1 px-4 py-3">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium text-fg">
                            {criterion.criterionName}
                            {criterion.value !== null && (
                                <span className="font-normal text-fg-muted">
                                    {criterion.value}
                                    {criterion.unit ? ` ${criterion.unit}` : ""}
                                </span>
                            )}
                        </p>
                        <p className="text-[13px] text-fg-muted">{criterion.method}</p>
                        <p className="text-sm whitespace-pre-line text-fg">{criterion.observation}</p>
                        {criterion.note && <p className="text-[13px] text-fg-muted">{t("screens.misc.views.note", { note: criterion.note })}</p>}
                    </li>
                ))}
            </ol>
        </div>
    );
}

/** Applications as a list of rows linking to each one. */
export function ApplicationList({
    applications,
    hrefFor,
    coachName,
    label,
    locale = "en",
}: {
    applications: Application[];
    hrefFor: (applicationId: string) => string;
    /** Shows who is assessing each applicant; left out on the coach's own list. */
    coachName?: (coachId: string) => string;
    label: string;
    locale?: Locale;
}) {
    const t = createTranslator(locale);
    return (
        <ul aria-label={label} className="divide-y divide-border">
            {applications.map((application) => {
                const name = applicantName(application.applicant);
                const facts = [weightClassLabel(application.applicant.weightClass, locale), t("screens.admin.application.applied", { date: formatDate(application.submittedAt, locale) })];
                if (coachName) facts.push(application.evaluator ? t("screens.misc.views.coach", { name: coachName(application.evaluator.coachId) }) : t("screens.misc.views.noCoach"));
                return (
                    <li key={application.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                        <Avatar name={name} size="sm" shape="octagon" />
                        <div className="min-w-0 flex-1">
                            <Link href={hrefFor(application.id)} className="text-sm font-semibold text-fg hover:underline">
                                {name}
                            </Link>
                            <p className="truncate text-[13px] text-fg-muted">{facts.join(" · ")}</p>
                        </div>
                        {/* The badge's translated English words some statuses differently ("Submitted"), so English keeps today's labels. */}
                        <ApplicationStatusBadge status={application.status} size="sm" locale={locale === "en" ? undefined : locale} />
                    </li>
                );
            })}
        </ul>
    );
}
