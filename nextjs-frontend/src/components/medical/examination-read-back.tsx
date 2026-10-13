import { CircleCheck, ClipboardCheck, ShieldAlert } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { VitalsGrid } from "@/components/domain/vitals-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EXAMINATION_DECISION_LABELS, EXAMINATION_SCOPE_LABELS } from "@/lib/domain/medical-contract";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { AssessmentResultBadge } from "./clinical-badges";
import { Scat6Summary } from "./scat6-summary";

/**
 * The examination a clearance is about to be issued from, as the medical service returned it: decision, what was
 * found and, for a baseline, the SCAT6 with the scores the service computed. Read-only, so the doctor checks it before
 * the second step. A record kept without details says so instead of looking complete.
 */
export function ExaminationReadBack({ exam, weightLimitKg }: { exam: CurrentExamination; weightLimitKg: number | null }) {
    const { details } = exam;
    const restricted = exam.decision === "ELIGIBLE_WITH_RESTRICTIONS";
    return (
        <>
            <Card>
                <CardHeader
                    title="Examination on record"
                    icon={<ClipboardCheck />}
                    description={`${EXAMINATION_SCOPE_LABELS[exam.scope]} · ${details?.type ? EXAMINATION_TYPE_LABELS[details.type] : "type not recorded"} · ${formatDateTime(exam.examinedAt)}`}
                    action={
                        <Badge tone={restricted ? "warning" : "success"} icon={restricted ? ShieldAlert : CircleCheck}>
                            {EXAMINATION_DECISION_LABELS[exam.decision]}
                        </Badge>
                    }
                />
                <CardContent className="flex flex-col gap-5">
                    <div>
                        <h3 className="text-[13px] font-semibold text-fg-muted">Findings and reasoning</h3>
                        <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.reason}</p>
                        <p className="mt-1.5 text-[13px] text-fg-muted">{exam.validUntil ? `Decision valid until ${formatDate(exam.validUntil)}.` : "The decision has no end date."}</p>
                    </div>
                    {details ? (
                        <>
                            {details.vitals ? (
                                <VitalsGrid vitals={details.vitals} weightLimitKg={weightLimitKg ?? undefined} />
                            ) : (
                                <p className="text-[13px] text-fg-muted">No vitals were recorded.</p>
                            )}
                            {details.assessments.length > 0 ? (
                                <ul className="flex flex-col gap-2">
                                    {details.assessments.map((assessment, index) => (
                                        <li key={`${assessment.area}-${index}`} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                            <span className="font-medium text-fg">{assessment.area}</span>
                                            <AssessmentResultBadge result={assessment.result} size="sm" />
                                            {assessment.note && <span className="min-w-0 text-[13px] text-fg-muted">{assessment.note}</span>}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-[13px] text-fg-muted">No areas were assessed.</p>
                            )}
                        </>
                    ) : (
                        <InlineNote icon={ClipboardCheck}>This examination was recorded without details: no vitals, assessed areas or SCAT6 to show.</InlineNote>
                    )}
                </CardContent>
            </Card>
            {details?.scat6 && <Scat6Summary record={details.scat6} />}
        </>
    );
}
