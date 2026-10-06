import Link from "next/link";

import { ApplicationStatusBadge, ConclusionBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { applicantName, type ApplicantDetails, type Application } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";

/*
 * Read-only pieces of an application, shared by the administrator's and the coach's pages.
 */

const notGiven = <span className="font-normal text-fg-subtle">Not given</span>;
const longText = (value: string | null) => (value ? <span className="font-normal whitespace-pre-line">{value}</span> : notGiven);

/** What the applicant told the academy. */
export function ApplicantDetailsList({ details, accountEmail = null }: { details: ApplicantDetails; accountEmail?: string | null }) {
    const items: (DescriptionItem | false)[] = [
        { label: "Email when applying", value: details.email },
        accountEmail !== null && { label: "Account email now", value: accountEmail },
        { label: "Date of birth", value: formatDate(details.dateOfBirth) },
        { label: "Weight class", value: WEIGHT_CLASS_LABELS[details.weightClass] },
        { label: "Nationality", value: details.nationality ?? notGiven },
        { label: "Phone", value: details.contactPhone ?? notGiven },
        { label: "Training background", value: longText(details.trainingBackground), wide: true },
        { label: "Competition background", value: longText(details.competitionBackground), wide: true },
        { label: "Why they want to join", value: longText(details.motivation), wide: true },
    ];
    return <DescriptionList items={items.filter((item) => item !== false)} />;
}

/** The coach's entrance assessment: the conclusion, their summary and each thing they checked. */
export function AssessmentView({ assessment, coachName }: { assessment: NonNullable<Application["assessment"]>; coachName: string }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <ConclusionBadge conclusion={assessment.conclusion} />
                <span className="text-[13px] text-fg-muted">
                    {coachName} · {formatDateTime(assessment.assessedAt)}
                </span>
            </div>
            <p className="text-sm whitespace-pre-line text-fg">{assessment.summary}</p>
            <ol className="divide-y divide-border rounded-lg border border-border" aria-label="Criteria assessed">
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
                        {criterion.note && <p className="text-[13px] text-fg-muted">Note: {criterion.note}</p>}
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
}: {
    applications: Application[];
    hrefFor: (applicationId: string) => string;
    /** Shows who is assessing each applicant; left out on the coach's own list. */
    coachName?: (coachId: string) => string;
    label: string;
}) {
    return (
        <ul aria-label={label} className="divide-y divide-border">
            {applications.map((application) => {
                const name = applicantName(application.applicant);
                const facts = [WEIGHT_CLASS_LABELS[application.applicant.weightClass], `Applied ${formatDate(application.submittedAt)}`];
                if (coachName) facts.push(application.evaluator ? `Coach: ${coachName(application.evaluator.coachId)}` : "No coach assigned");
                return (
                    <li key={application.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                        <Avatar name={name} size="sm" shape="octagon" />
                        <div className="min-w-0 flex-1">
                            <Link href={hrefFor(application.id)} className="text-sm font-semibold text-fg hover:underline">
                                {name}
                            </Link>
                            <p className="truncate text-[13px] text-fg-muted">{facts.join(" · ")}</p>
                        </div>
                        <ApplicationStatusBadge status={application.status} size="sm" />
                    </li>
                );
            })}
        </ul>
    );
}
