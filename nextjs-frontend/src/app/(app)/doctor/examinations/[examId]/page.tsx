import { CalendarClock, ClipboardList, NotebookPen, ShieldCheck, Stethoscope, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { ClearanceBadge, FighterStatusBadges } from "@/components/domain/status-badges";
import { VitalsGrid } from "@/components/domain/vitals-grid";
import {
    AssessmentResultBadge,
    CLEARANCE_LEVEL_FOR_OUTCOME,
    ClearanceRecordStatusBadge,
    EXAMINATION_OUTCOME_DESCRIPTIONS,
    EXAMINATION_OUTCOME_META,
    ExaminationOutcomeBadge,
} from "@/components/medical/clinical-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { PrintButton } from "@/components/medical/print-button";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceState, currentClearance, type ClearanceState } from "@/lib/domain/rules";
import { daysBetween, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getExamination, listClearances, listExaminations } from "@/lib/services/medical";
import { getFighter, listDoctors } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

const PRINT_STYLES = `
@media print {
    body * { visibility: hidden; }
    #examination-report, #examination-report * { visibility: visible; }
    #examination-report { position: absolute; top: 0; left: 0; width: 100%; }
    #examination-report header > a { display: none; }
}
`;

/** The examination and its fighter, loaded once per request for the metadata and the page. Null when missing or not assigned. */
const loadExamination = cache(async (examId: string) => {
    const user = await requireRole("doctor");
    const exam = await getExamination(examId);
    if (!exam || !canAccessFighter(user, exam.fighterId)) return null;
    const fighter = await getFighter(exam.fighterId);
    return fighter ? { exam, fighter } : null;
});

export async function generateMetadata({ params }: PageProps<"/doctor/examinations/[examId]">): Promise<Metadata> {
    const loaded = await loadExamination((await params).examId);
    return { title: loaded ? `${EXAMINATION_TYPE_LABELS[loaded.exam.type]} — ${loaded.fighter.name}` : "Examination not found" };
}

export default async function ExaminationDetailPage({ params, searchParams }: PageProps<"/doctor/examinations/[examId]">) {
    const [{ examId }, query] = await Promise.all([params, searchParams]);
    const now = new Date().toISOString();

    const loaded = await loadExamination(examId);
    if (!loaded) notFound();
    const { exam, fighter } = loaded;

    const [doctors, clearances, fighterExams, settings] = await Promise.all([
        listDoctors(),
        listClearances({ fighterIds: [exam.fighterId] }),
        listExaminations({ fighterIds: [exam.fighterId] }),
        getSettings(),
    ]);

    const doctorName = doctors.find((doctor) => doctor.id === exam.doctorId)?.name ?? "Sports doctor";
    const current = currentClearance(clearances, fighter.id);
    const currentState = clearanceState(current, now);
    const linked = clearances.filter((clearance) => clearance.examinationId === exam.id);
    const isLatest = fighterExams[0]?.id === exam.id;
    const expectedLevel = CLEARANCE_LEVEL_FOR_OUTCOME[exam.outcome];
    const suggestUpdate = isLatest && linked.length === 0 && currentState !== expectedLevel;
    const grantHref = `${routes.doctor.grantClearance}?fighter=${fighter.id}&exam=${exam.id}`;

    const counts = {
        abnormal: exam.assessments.filter((a) => a.result === "abnormal").length,
        inconclusive: exam.assessments.filter((a) => a.result === "inconclusive").length,
        normal: exam.assessments.filter((a) => a.result === "normal").length,
    };
    const outcomeMeta = EXAMINATION_OUTCOME_META[exam.outcome];
    const followUpDays = exam.followUpDate ? daysBetween(now, exam.followUpDate) : null;

    return (
        <div id="examination-report">
            <style>{PRINT_STYLES}</style>
            <FlashToast
                notice={
                    param(query.notice) === "examination-recorded"
                        ? { title: "Examination recorded", description: `${fighter.name} can see the summary and recommendations on their Health page.` }
                        : null
                }
                cleanHref={hrefWith(routes.doctor.examination(exam.id), query, { notice: null })}
            />

            <PageHeader
                back={{ href: `${routes.doctor.fighter(fighter.id)}?tab=examinations`, label: fighter.name }}
                eyebrow="Examination"
                title={EXAMINATION_TYPE_LABELS[exam.type]}
                description={
                    <>
                        <Link href={routes.doctor.fighter(fighter.id)} className="font-medium text-fg hover:underline">
                            {fighter.name}
                        </Link>{" "}
                        · <time dateTime={exam.date}>{formatDateTime(exam.date)}</time> · {doctorName}
                    </>
                }
                meta={
                    <>
                        <ExaminationOutcomeBadge outcome={exam.outcome} />
                        {counts.abnormal > 0 && (
                            <Badge tone="warning" icon={TriangleAlert}>
                                {pluralize(counts.abnormal, "abnormal finding")}
                            </Badge>
                        )}
                    </>
                }
                actions={
                    <div className="flex flex-wrap gap-2 print:hidden">
                        <PrintButton />
                        {!suggestUpdate && (
                            <ButtonLink href={grantHref} variant="secondary">
                                <ShieldCheck aria-hidden />
                                Update clearance
                            </ButtonLink>
                        )}
                    </div>
                }
            />

            <div className="flex flex-col gap-6">
                {suggestUpdate && (
                    <Callout
                        tone="info"
                        icon={ShieldCheck}
                        title="Update Medical Clearance based on this examination"
                        action={<ButtonLink href={grantHref}>Update Medical Clearance</ButtonLink>}
                        className="print:hidden"
                    >
                        The outcome “{outcomeMeta.label}” points to <strong className="font-medium text-fg">{CLEARANCE_LEVEL_LABELS[expectedLevel]}</strong>, but{" "}
                        {fighter.name}&apos;s clearance is {describeState(currentState)}. Coaches plan training against the clearance, so update it to match your
                        findings.
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title="Vitals" icon={<Stethoscope />} description={`Checked against athlete ranges and the ${fighter.targetWeightKg} kg class limit`} />
                            <CardContent>
                                <VitalsGrid vitals={exam.vitals} weightLimitKg={fighter.targetWeightKg} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Assessments"
                                icon={<ClipboardList />}
                                description={[
                                    counts.normal > 0 ? `${counts.normal} normal` : null,
                                    counts.abnormal > 0 ? `${counts.abnormal} abnormal` : null,
                                    counts.inconclusive > 0 ? `${counts.inconclusive} inconclusive` : null,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            />
                            <div className="pb-2">
                                <Table caption="Assessments">
                                    <THead>
                                        <tr>
                                            <TH>Area</TH>
                                            <TH>Result</TH>
                                            <TH>Findings</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {exam.assessments.map((assessment, index) => (
                                            <TR key={`${assessment.area}-${index}`} className={cn(assessment.result === "abnormal" && "bg-warning-soft/30")}>
                                                <TD className="min-w-44 font-medium">{assessment.area}</TD>
                                                <TD className="whitespace-nowrap">
                                                    <AssessmentResultBadge result={assessment.result} size="sm" />
                                                </TD>
                                                <TD className="min-w-64 text-[13px] text-pretty">
                                                    {assessment.note || <span className="text-fg-muted">No notes</span>}
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader title="Summary & recommendations" icon={<NotebookPen />} />
                            <CardContent className="flex flex-col gap-5">
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">Summary of findings</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.summary}</p>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-fg-muted">Recommendations</h3>
                                    <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{exam.recommendations}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Outcome" />
                            <CardContent className="flex flex-col gap-4">
                                <Callout tone={outcomeMeta.tone} icon={outcomeMeta.icon} title={outcomeMeta.label}>
                                    {EXAMINATION_OUTCOME_DESCRIPTIONS[exam.outcome]}
                                </Callout>
                                <div className="flex items-start gap-2.5 text-sm">
                                    <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                                    {exam.followUpDate && followUpDays !== null ? (
                                        <p>
                                            <span className="block text-[13px] text-fg-muted">Follow-up examination</span>
                                            <time dateTime={exam.followUpDate} className="font-medium text-fg">
                                                {formatDate(exam.followUpDate)}
                                            </time>
                                            <span className="text-fg-muted"> · {followUpDays < 0 ? `${describeDaysUntil(followUpDays)}` : capitalize(describeDaysUntil(followUpDays))}</span>
                                        </p>
                                    ) : (
                                        <p className="text-fg-muted">No follow-up scheduled</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Medical Clearance" icon={<ShieldCheck />} />
                            <CardContent className="flex flex-col gap-4">
                                {linked.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[13px] text-fg-muted">Issued on the basis of this examination:</p>
                                        {linked.map((clearance) => (
                                            <div key={clearance.id} className="rounded-lg border border-border px-3 py-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <ClearanceBadge state={clearance.level} size="sm" />
                                                    <ClearanceRecordStatusBadge status={clearance.status} size="sm" />
                                                </div>
                                                <p className="mt-1.5 text-[13px] text-fg-muted">
                                                    Issued {formatDate(clearance.issuedAt)}
                                                    {clearance.validUntil ? ` · valid until ${formatDate(clearance.validUntil)}` : ""}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-fg-muted">No clearance has been issued from this examination.</p>
                                )}
                                <div className="border-t border-border pt-4">
                                    <p className="mb-1.5 text-[13px] text-fg-muted">Current clearance</p>
                                    <div className="flex flex-col items-start gap-1">
                                        <ClearanceBadge state={currentState} size="sm" />
                                        <ClearanceValidity clearance={current} state={currentState} now={now} warningDays={settings.clearanceExpiryWarningDays} />
                                    </div>
                                    <Link
                                        href={`${routes.doctor.fighter(fighter.id)}?tab=clearance`}
                                        className="mt-3 inline-flex text-[13px] font-medium text-primary-soft-fg hover:underline print:hidden"
                                    >
                                        Clearance history
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Patient" icon={<UserRound />} />
                            <CardContent className="flex flex-col gap-3">
                                <FighterIdentity fighter={fighter} href={routes.doctor.fighter(fighter.id)} />
                                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={currentState} size="sm" className="self-start" />
                                <p className="text-[13px] text-fg-muted">
                                    {isLatest
                                        ? "This is the fighter's most recent examination."
                                        : `A newer examination exists — ${pluralize(fighterExams.findIndex((candidate) => candidate.id === exam.id), "examination")} recorded since.`}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function describeState(state: ClearanceState): string {
    switch (state) {
        case "none":
            return "not on file yet";
        case "expired":
            return "expired";
        default:
            return `“${CLEARANCE_LEVEL_LABELS[state]}”`;
    }
}
