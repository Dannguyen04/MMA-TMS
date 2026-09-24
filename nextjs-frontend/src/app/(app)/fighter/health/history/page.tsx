import { Bandage, History, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { injuryTitle } from "@/components/clinical/clinical-copy";
import { medicalHistoryItems } from "@/components/dashboard/health-data";
import { ActivityTimeline } from "@/components/domain/activity-timeline";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { ExaminationOutcomeBadge } from "@/components/medical/clinical-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getInjuryDetail, listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";

export const metadata: Metadata = { title: "Medical history" };

export default async function FighterMedicalHistoryPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const ids = [fighter.id];
    const now = new Date().toISOString();

    const [examinations, injuries, clearances, doctors] = await Promise.all([
        listExaminations({ fighterIds: ids }),
        listInjuries({ fighterIds: ids }),
        listClearances({ fighterIds: ids }),
        listDoctors(),
    ]);
    const details = await Promise.all(injuries.map((injury) => getInjuryDetail(injury.id)));
    const treatments = details.flatMap((detail) => detail?.treatments ?? []);
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const timeline = medicalHistoryItems({ examinations, injuries, treatments, clearances, doctorNames });

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.health, label: "Health & Medical Clearance" }}
                eyebrow="Health"
                title="Medical history"
                description="Examinations, injuries, treatments and clearance decisions recorded by your sports doctor."
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                <Card className="min-w-0 lg:col-span-5">
                    <CardHeader title="Timeline" description={pluralize(timeline.length, "event")} icon={<History />} />
                    <CardContent>
                        <ActivityTimeline items={timeline} now={now} emptyText="Nothing recorded yet. Your first entry will be your baseline physical." />
                    </CardContent>
                </Card>

                <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader title="Examinations" description={pluralize(examinations.length, "examination")} icon={<Stethoscope />} />
                        {examinations.length === 0 ? (
                            <EmptyState compact icon={<Stethoscope />} title="No examinations yet" description="Your sports doctor records each check-up here." className="border-t border-border" />
                        ) : (
                            <div className="hidden border-t border-border sm:block">
                                <Table caption="Your examinations">
                                    <THead>
                                        <tr>
                                            <TH>Date</TH>
                                            <TH>Type</TH>
                                            <TH>Outcome</TH>
                                            <TH>Doctor</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {examinations.map((exam) => (
                                            <TR key={exam.id}>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={exam.date}>{formatDate(exam.date)}</time>
                                                </TD>
                                                <TD className="min-w-44">{EXAMINATION_TYPE_LABELS[exam.type]}</TD>
                                                <TD>
                                                    <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" />
                                                </TD>
                                                <TD className="whitespace-nowrap text-fg-muted">{doctorNames.get(exam.doctorId) ?? "Sports doctor"}</TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        )}
                        {examinations.length > 0 && (
                            <ul aria-label="Your examinations" className="flex flex-col divide-y divide-border border-t border-border sm:hidden">
                                {examinations.map((exam) => (
                                    <li key={exam.id} className="flex items-start justify-between gap-3 px-5 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-fg">{EXAMINATION_TYPE_LABELS[exam.type]}</p>
                                            <p className="mt-0.5 text-[13px] text-fg-muted">
                                                <time dateTime={exam.date}>{formatDate(exam.date)}</time> · {doctorNames.get(exam.doctorId) ?? "Sports doctor"}
                                            </p>
                                        </div>
                                        <ExaminationOutcomeBadge outcome={exam.outcome} size="sm" className="shrink-0" />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader title="Injuries" description={pluralize(injuries.length, "injury", "injuries")} icon={<Bandage />} />
                        {injuries.length === 0 ? (
                            <EmptyState compact icon={<Bandage />} title="No injuries recorded" description="Injuries your doctor records appear here with their treatment and recovery." className="border-t border-border" />
                        ) : (
                            <div className="hidden border-t border-border sm:block">
                                <Table caption="Your injuries">
                                    <THead>
                                        <tr>
                                            <TH>Injury</TH>
                                            <TH>Severity</TH>
                                            <TH>Status</TH>
                                            <TH>Occurred</TH>
                                            <TH>Return</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {injuries.map((injury) => (
                                            <TR key={injury.id}>
                                                <TD className="min-w-48">
                                                    <Link href={routes.fighter.injury(injury.id)} className="rounded-sm font-medium text-fg hover:underline">
                                                        {injuryTitle(injury)}
                                                    </Link>
                                                </TD>
                                                <TD>
                                                    <InjurySeverityBadge severity={injury.severity} size="sm" />
                                                </TD>
                                                <TD>
                                                    <InjuryStatusBadge status={injury.status} size="sm" />
                                                </TD>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time>
                                                </TD>
                                                <TD className="whitespace-nowrap text-fg-muted">
                                                    <ReturnText injury={injury} now={now} />
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        )}
                        {injuries.length > 0 && (
                            <ul aria-label="Your injuries" className="flex flex-col divide-y divide-border border-t border-border sm:hidden">
                                {injuries.map((injury) => (
                                    <li key={injury.id} className="flex flex-col gap-2 px-5 py-3.5">
                                        <Link href={routes.fighter.injury(injury.id)} className="w-fit rounded-sm text-sm font-medium text-fg hover:underline">
                                            {injuryTitle(injury)}
                                        </Link>
                                        <div className="flex flex-wrap gap-1.5">
                                            <InjurySeverityBadge severity={injury.severity} size="sm" />
                                            <InjuryStatusBadge status={injury.status} size="sm" />
                                        </div>
                                        <dl className="grid grid-cols-2 gap-3 text-[13px]">
                                            <div>
                                                <dt className="text-fg-muted">Occurred</dt>
                                                <dd className="text-fg">
                                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time>
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-fg-muted">Return</dt>
                                                <dd className="text-fg-muted">
                                                    <ReturnText injury={injury} now={now} />
                                                </dd>
                                            </div>
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}

/** When the fighter returned or is expected back, or that it is still to be assessed. */
function ReturnText({ injury, now }: { injury: Injury; now: string }) {
    if (injury.resolvedAt) {
        return (
            <>
                <time dateTime={injury.resolvedAt} className="text-fg">
                    {formatDate(injury.resolvedAt)}
                </time>
                <span className="block text-xs">resolved</span>
            </>
        );
    }
    if (injury.expectedReturnAt) {
        return (
            <>
                <time dateTime={injury.expectedReturnAt} className="text-fg">
                    {formatDate(injury.expectedReturnAt)}
                </time>
                <span className="block text-xs">expected {describeDaysUntil(daysBetween(now, injury.expectedReturnAt))}</span>
            </>
        );
    }
    return <>To be assessed</>;
}
