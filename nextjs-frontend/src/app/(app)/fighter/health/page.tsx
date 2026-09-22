import { Bandage, CalendarClock, FileClock, HeartHandshake, History, MapPinned, RefreshCw, ShieldQuestion } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { CareTeamCard } from "@/components/dashboard/care-team-card";
import { CheckInTrends } from "@/components/dashboard/check-in-trends";
import { relativeDay } from "@/components/dashboard/dashboard-utils";
import { ExaminationSummaryCard } from "@/components/dashboard/examination-summary-card";
import { injuryHighlights, loadCareTeam } from "@/components/dashboard/health-data";
import { HealthStatusCard } from "@/components/dashboard/health-status-card";
import { InlineNote } from "@/components/dashboard/inline-note";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { BodyMap } from "@/components/domain/body-map";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { InjuryCard } from "@/components/domain/injury-card";
import { MetricTile } from "@/components/domain/metric-tile";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { ClearanceBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatWeekdayDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getFighterHealthSummary, listClearances, listExaminations, listInjuries } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Health & Medical Clearance" };

export default async function FighterHealthPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const ids = [fighter.id];
    const now = new Date().toISOString();

    const [health, clearances, injuries, examinations, doctors, careTeam, settings] = await Promise.all([
        getFighterHealthSummary(fighter.id, now),
        listClearances({ fighterIds: ids }),
        listInjuries({ fighterIds: ids }),
        listExaminations({ fighterIds: ids }),
        listDoctors(),
        loadCareTeam(fighter),
        getSettings(),
    ]);
    if (!health) notFound();

    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const { clearance, clearanceState } = health;
    const clearanceDoctor = clearance ? doctorNames.get(clearance.doctorId) : undefined;
    const latestDecision = clearances[0];
    const contactDoctor = clearanceDoctor ?? careTeam.find((member) => member.role === "doctor" && member.primary)?.name ?? careTeam.find((member) => member.role === "doctor")?.name;
    const openInjuries = health.activeInjuries;
    const recovery = health.activeRecoveryPlan;
    const recoveryInjury = recovery ? injuries.find((injury) => injury.id === recovery.plan.injuryId) : undefined;
    const resolvedCount = injuries.filter((injury) => injury.status === "resolved").length;
    const followUp = health.nextFollowUp;
    const highlights = injuryHighlights(injuries, now);

    return (
        <>
            <PageHeader
                title="Health & Medical Clearance"
                description="Your clearance, injuries and recovery — kept up to date by your sports doctor."
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    {clearanceState === "none" ? (
                        <Card className="min-w-0">
                            <CardHeader title="Medical Clearance" icon={<ShieldQuestion />} />
                            <CardContent className="flex flex-col gap-3">
                                <ClearanceBadge state="none" className="w-fit" />
                                <p className="text-[15px] font-semibold text-fg">No Medical Clearance on file yet</p>
                                <p className="max-w-2xl text-sm text-pretty text-fg-muted">
                                    Your sports doctor issues it after your baseline physical. Once it&apos;s in place, this card shows what training you&apos;re
                                    cleared for and any restrictions.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <ClearanceCard
                            clearance={clearance}
                            state={clearanceState}
                            doctorName={clearanceDoctor}
                            now={now}
                            variant="clinical"
                            warningDays={settings.clearanceExpiryWarningDays}
                            className="min-w-0"
                        />
                    )}
                    <HealthStatusCard status={fighter.healthStatus} wide>
                        {followUp ? (
                            <div className="rounded-lg border border-border px-3 py-2.5 text-[13px]">
                                <p className="flex items-center gap-1.5 text-fg-muted">
                                    <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                                    Next follow-up
                                </p>
                                <p className="mt-0.5 text-pretty">
                                    <time dateTime={followUp.date} className="font-medium text-fg">
                                        {formatWeekdayDate(followUp.date)}
                                    </time>
                                    <span className="text-fg-muted">
                                        {" "}
                                        · {relativeDay(followUp.date, now).toLowerCase()} · after your {EXAMINATION_TYPE_LABELS[followUp.examination.type].toLowerCase()}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <InlineNote icon={CalendarClock}>No follow-up booked — your doctor arranges your next check.</InlineNote>
                        )}
                        {contactDoctor && (
                            <InlineNote icon={HeartHandshake}>
                                Questions about your clearance? Talk to <span className="font-medium">{contactDoctor}</span>.
                            </InlineNote>
                        )}
                    </HealthStatusCard>

                    {recovery && (
                        <Card className="min-w-0">
                            <CardHeader
                                title="Recovery plan"
                                description={`${recovery.plan.title}${recoveryInjury ? ` · ${injuryTitle(recoveryInjury)}` : ""}`}
                                icon={<RefreshCw />}
                                action={recoveryInjury && <CardLink href={routes.fighter.injury(recoveryInjury.id)}>Details</CardLink>}
                            />
                            <CardContent className="flex flex-col gap-6">
                                <RecoveryProgress plan={recovery.plan} now={now} />
                                <div className="border-t border-border pt-5">
                                    <CheckInTrends checkIns={recovery.plan.checkIns} now={now} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="min-w-0">
                        <CardHeader
                            title="Active injuries"
                            description={openInjuries.length > 0 ? "Open an injury for treatment, recovery and what to expect" : undefined}
                            icon={<Bandage />}
                        />
                        <CardContent>
                            {openInjuries.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<Bandage />}
                                    title="No active injuries"
                                    description={
                                        resolvedCount > 0
                                            ? "Nothing is limiting your training right now. Past injuries are in your medical history."
                                            : "Nothing is limiting your training right now."
                                    }
                                    className="pt-0"
                                />
                            ) : (
                                <ul className={cn("grid grid-cols-1 gap-4", openInjuries.length > 1 && "md:grid-cols-2")}>
                                    {openInjuries.map((injury) => (
                                        <li key={injury.id} className="min-w-0">
                                            <InjuryCard injury={injury} now={now} href={routes.fighter.injury(injury.id)} className="h-full" />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader title="Medical history" description="Everything your sports doctor has recorded" icon={<FileClock />} />
                        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="grid flex-1 grid-cols-3 gap-2">
                                <MetricTile label="Examinations" value={examinations.length} />
                                <MetricTile label="Injuries" value={injuries.length} hint={resolvedCount > 0 ? `${resolvedCount} resolved` : undefined} />
                                <MetricTile
                                    label="Clearance decisions"
                                    value={clearances.length}
                                    hint={latestDecision ? `Latest ${formatDate(latestDecision.issuedAt)}` : undefined}
                                />
                            </div>
                            <ButtonLink href={routes.fighter.medicalHistory} variant="secondary" className="shrink-0">
                                <History aria-hidden />
                                View history
                            </ButtonLink>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <ExaminationSummaryCard
                        examination={health.latestExamination}
                        doctorName={health.latestExamination ? doctorNames.get(health.latestExamination.doctorId) : undefined}
                        historyHref={routes.fighter.medicalHistory}
                        now={now}
                    />
                    <Card className="min-w-0">
                        <CardHeader title="Body map" description="Current injuries and those resolved in the last 12 months" icon={<MapPinned />} />
                        <CardContent>
                            <BodyMap highlights={highlights} size="md" />
                            {highlights.length === 0 && <p className="mt-3 text-center text-[13px] text-fg-muted">No injuries in the last 12 months.</p>}
                        </CardContent>
                    </Card>
                    <CareTeamCard members={careTeam} />
                </div>
            </div>
        </>
    );
}
