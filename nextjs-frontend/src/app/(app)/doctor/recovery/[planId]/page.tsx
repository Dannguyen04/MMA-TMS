import { CircleCheck, ClipboardList, FileText, LineChart as LineChartIcon, ListChecks, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CheckInDialog } from "@/components/clinical/check-in-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle, painLabel } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { RecoveryTracker } from "@/components/clinical/recovery-tracker";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { CardLink } from "@/components/dashboard/card-link";
import { CheckInCharts } from "@/components/domain/check-in-charts";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { InjuryStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { clearanceState } from "@/lib/domain/rules";
import { dayKey, formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getCurrentClearanceFor, getRecoveryPlanDetail } from "@/lib/services/medical";
import { getDoctor } from "@/lib/services/people";
import { param } from "@/lib/utils";

/** The plan with its fighter, injury, treatments and doctor, loaded once per request for the metadata and the page. */
const loadRecoveryPlanDetail = cache(getRecoveryPlanDetail);

export async function generateMetadata({ params }: PageProps<"/doctor/recovery/[planId]">): Promise<Metadata> {
    const [{ planId }, user] = await Promise.all([params, getCurrentUser()]);
    const detail = await loadRecoveryPlanDetail(planId);
    // The title must not reveal a plan the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.plan.fighterId);
    return { title: visible ? `${detail.plan.title} · ${detail.fighter.name}` : "Recovery plan" };
}

export default async function RecoveryPlanPage({ params, searchParams }: PageProps<"/doctor/recovery/[planId]">) {
    const user = await requireRole("doctor");
    const [{ planId }, query] = await Promise.all([params, searchParams]);
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadRecoveryPlanDetail(planId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.plan.fighterId)) notFound();
    const { plan, fighter, injury, treatments, doctor } = detail;

    const clearance = getCurrentClearanceFor(fighter.id);
    const clearanceNow = clearanceState(clearance, now);
    const clearanceDoctor = clearance ? await getDoctor(clearance.doctorId) : null;
    const justCreated = param(query.created) === "1";
    const checkInsNewestFirst = [...plan.checkIns].reverse();
    const lastCheckIn = plan.checkIns.at(-1) ?? null;
    const isCompleted = plan.status === "completed";

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.recovery, label: "Recovery" }}
                eyebrow="Recovery plan"
                title={plan.title}
                meta={
                    <>
                        <RecoveryPlanStatusBadge status={plan.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <Link
                            href={routes.doctor.fighter(fighter.id)}
                            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-fg hover:underline"
                        >
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            {fighter.name}
                        </Link>
                        {injury && (
                            <>
                                <span aria-hidden className="text-fg-subtle max-sm:hidden">
                                    ·
                                </span>
                                <Link
                                    href={routes.doctor.injury(injury.id)}
                                    className="rounded-md text-sm text-fg-muted hover:text-fg hover:underline"
                                >
                                    {injuryTitle(injury)}
                                </Link>
                                <InjuryStatusBadge status={injury.status} size="sm" />
                            </>
                        )}
                    </>
                }
                actions={
                    !isCompleted && (
                        <CheckInDialog
                            planId={plan.id}
                            fighterName={fighter.name}
                            minDate={dayKey(plan.startDate)}
                            today={dayKey(now)}
                            lastCheckIn={lastCheckIn}
                        />
                    )
                }
            />

            <div className="flex flex-col gap-6">
                {justCreated && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        role="status"
                        title="Recovery plan created"
                        action={
                            <ButtonLink href={routes.doctor.recoveryPlan(plan.id)} variant="ghost" size="sm" replace scroll={false}>
                                Dismiss
                            </ButtonLink>
                        }
                    >
                        {fighter.name} has been notified, and their coaches were told a return-to-training plan has started — without clinical detail. Log the
                        first check-in to start tracking.
                    </Callout>
                )}

                {isCompleted && injury && injury.status !== "resolved" && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        title="Every phase is complete"
                        action={
                            <>
                                <ButtonLink href={routes.doctor.injury(injury.id)} size="sm" variant="secondary">
                                    Open injury record
                                </ButtonLink>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    Review Medical Clearance
                                </ButtonLink>
                            </>
                        }
                    >
                        The injury record and Medical Clearance don&apos;t change on their own. Resolve the injury and update the clearance when your assessment
                        supports a full return.
                    </Callout>
                )}

                <Card>
                    <CardHeader
                        title="Phases & milestones"
                        icon={<ListChecks />}
                        description="Tick milestones as they're met. Progress updates straight away."
                    />
                    <CardContent>
                        <RecoveryTracker plan={plan} now={now} />
                    </CardContent>
                </Card>

                <Card className="overflow-hidden">
                    <CardHeader
                        title="Check-ins"
                        icon={<LineChartIcon />}
                        description={
                            plan.checkIns.length === 0
                                ? "Pain, mobility and strength over time"
                                : `${pluralize(plan.checkIns.length, "check-in")} · last on ${formatDate(plan.checkIns.at(-1)?.date ?? now)}`
                        }
                    />
                    {plan.checkIns.length === 0 ? (
                        <EmptyState
                            compact
                            icon={<LineChartIcon />}
                            title="No check-ins yet"
                            description="Log pain, mobility and strength at each review to see how the fighter is responding to the plan."
                            className="border-t border-border"
                        />
                    ) : (
                        <>
                            <CardContent>
                                {plan.checkIns.length >= 2 ? (
                                    <CheckInCharts checkIns={plan.checkIns} audience="clinical" />
                                ) : (
                                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                        Trends appear after the second check-in.
                                    </p>
                                )}
                            </CardContent>
                            <div className="border-t border-border">
                                <h3 className="sr-only">Check-in history</h3>
                                <Table caption="Check-in history, newest first">
                                    <THead>
                                        <tr>
                                            <TH>Date</TH>
                                            <TH className="text-right">Pain</TH>
                                            <TH className="text-right">Mobility</TH>
                                            <TH className="text-right">Strength</TH>
                                            <TH>Note</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {checkInsNewestFirst.map((checkIn) => (
                                            <TR key={checkIn.date}>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={checkIn.date}>{formatDate(checkIn.date)}</time>
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    <span className="font-medium">{checkIn.painLevel}</span>
                                                    <span className="text-fg-muted">/10</span>
                                                    <span className="block text-xs text-fg-muted">{painLabel(checkIn.painLevel)}</span>
                                                </TD>
                                                <TD className="text-right">{checkIn.mobilityPct}%</TD>
                                                <TD className="text-right">{checkIn.strengthPct}%</TD>
                                                <TD className="min-w-64 text-[13px] text-pretty text-fg-muted">{checkIn.note || "—"}</TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        </>
                    )}
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader
                            title="Treatments"
                            icon={<ClipboardList />}
                            description="For this injury"
                            action={
                                injury && (
                                    <CardLink href={routes.doctor.injury(injury.id)} srContext="treatments on the injury record">
                                        Manage
                                    </CardLink>
                                )
                            }
                        />
                        {treatments.length === 0 ? (
                            <p className="border-t border-border px-5 py-4 text-sm text-fg-muted">No treatments recorded for this injury.</p>
                        ) : (
                            <TreatmentList treatments={treatments} className="border-t border-border" />
                        )}
                    </Card>

                    <aside aria-label="Medical Clearance and plan details" className="flex min-w-0 flex-col gap-6">
                        <ClearanceCard
                            clearance={clearance}
                            state={clearanceNow}
                            doctorName={clearanceDoctor?.name}
                            now={now}
                            variant="summary"
                            warningDays={settings.clearanceExpiryWarningDays}
                        />
                        <Card>
                            <CardHeader title="Plan details" icon={<FileText />} />
                            <CardContent>
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: "Responsible doctor", value: doctor?.name ?? "Sports doctor" },
                                        { label: "Started", value: <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time> },
                                        {
                                            label: "Target return",
                                            value: <time dateTime={plan.targetReturnDate}>{formatDate(plan.targetReturnDate)}</time>,
                                        },
                                        {
                                            label: "Phases",
                                            value: `${plan.phases.filter((p) => p.status === "completed").length} of ${plan.phases.length} completed`,
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </>
    );
}
