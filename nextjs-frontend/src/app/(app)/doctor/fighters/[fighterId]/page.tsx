import { Bandage, CalendarClock, ClipboardPlus, HeartPulse, Map as MapIcon, RefreshCw, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CardLink } from "@/components/dashboard/card-link";
import { FighterProfileHeader } from "@/components/dashboard/fighter-profile-header";
import { AINotice } from "@/components/domain/ai-notice";
import { BodyMap, type BodyMapHighlight } from "@/components/domain/body-map";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { InjuryCard } from "@/components/domain/injury-card";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { DateBlock } from "@/components/domain/session-list-item";
import { HealthStatusBadge, INJURY_STATUS_META } from "@/components/domain/status-badges";
import { VitalsGrid } from "@/components/domain/vitals-grid";
import { AIObservationList } from "@/components/medical/ai-observation-list";
import { ClearanceHistory } from "@/components/medical/clearance-history";
import { ExaminationHistory } from "@/components/medical/examination-history";
import { FlashToast } from "@/components/medical/flash-toast";
import { followUpExaminationHref } from "@/components/medical/follow-up-list";
import { HealthStatusControl } from "@/components/medical/health-status-control";
import { InjuryHistory } from "@/components/medical/injury-history";
import { MedicalRecordPanel } from "@/components/medical/medical-record-panel";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import { RevokedClearanceCard } from "@/components/medical/revoked-clearance-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import type { ToastInput } from "@/components/ui/toast";
import { canAccessFighter, requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import {
    EXAMINATION_TYPE_LABELS,
    HEALTH_STATUS_DESCRIPTIONS,
    INJURY_STATUS_LABELS,
    INJURY_TYPE_LABELS,
    TRAINING_LEVEL_LABELS,
    WEIGHT_CLASS_LABELS,
} from "@/lib/domain/labels";
import { ageFromBirthDate, daysBetween, formatDate, formatNumber, formatShortDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceHistory, getFighterHealthSummary, getMedicalRecord, listExaminations, listInjuries } from "@/lib/services/medical";
import { getFighter, listDoctors } from "@/lib/services/people";
import { param } from "@/lib/utils";

const TABS = ["overview", "record", "examinations", "injuries", "clearance"] as const;

/** Resolved injuries this recent still show on the body map, for context. */
const RECENT_RESOLVED_DAYS = 180;

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]">): Promise<Metadata> {
    const { fighterId } = await params;
    const user = await requireRole("doctor");
    const fighter = canAccessFighter(user, fighterId) ? await getFighter(fighterId) : null;
    return { title: fighter ? `${fighter.name} — Health profile` : "Fighter not found" };
}

export default async function DoctorFighterProfilePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]">) {
    const user = await requireRole("doctor");
    const { fighterId } = await params;
    const query = await searchParams;
    const fighter = await requireFighterAccess(user, fighterId);
    const now = new Date().toISOString();

    const [summary, record, examinations, injuries, clearances, doctors, settings] = await Promise.all([
        getFighterHealthSummary(fighter.id, now),
        getMedicalRecord(fighter.id),
        listExaminations({ fighterIds: [fighter.id] }),
        listInjuries({ fighterIds: [fighter.id] }),
        getClearanceHistory(fighter.id),
        listDoctors(),
        getSettings(),
    ]);
    if (!summary) notFound();

    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const primaryDoctorName = doctorNames.get(record?.primaryDoctorId ?? fighter.doctorIds[0] ?? "") ?? null;
    const tab = parseEnum(param(query.tab), TABS) ?? "overview";
    const pathname = routes.doctor.fighter(fighter.id);
    const newExamHref = `${routes.doctor.newExamination}?fighter=${fighter.id}`;
    const grantHref = `${routes.doctor.grantClearance}?fighter=${fighter.id}`;
    const newInjuryHref = `${routes.doctor.newInjury}?fighter=${fighter.id}`;

    const weightDiff = fighter.weightKg - fighter.targetWeightKg;
    const { clearance, clearanceState } = summary;
    const revoked = clearance?.status === "revoked";
    const canRevoke = clearance?.status === "active" && clearanceState !== "expired" && clearance.level !== "not_cleared";
    const latestExam = summary.latestExamination;
    const mapHighlights = bodyMapHighlights(injuries, now);

    const overview = (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                {revoked && clearance ? (
                    <RevokedClearanceCard
                        clearance={clearance}
                        fighterName={fighter.name}
                        issuedByName={doctorNames.get(clearance.doctorId)}
                        grantHref={grantHref}
                    />
                ) : (
                    <ClearanceCard
                        clearance={clearance}
                        state={clearanceState}
                        doctorName={clearance ? doctorNames.get(clearance.doctorId) : undefined}
                        now={now}
                        variant="clinical"
                        warningDays={settings.clearanceExpiryWarningDays}
                        actions={
                            <>
                                <ButtonLink href={grantHref} variant="secondary" size="sm">
                                    <ShieldCheck aria-hidden />
                                    {clearance ? "Update" : "Issue"}
                                </ButtonLink>
                                {canRevoke && clearance && <RevokeClearanceButton clearanceId={clearance.id} fighterName={fighter.name} />}
                            </>
                        }
                    />
                )}

                <Card>
                    <CardHeader
                        title="Active injuries"
                        description={summary.activeInjuries.length > 0 ? pluralize(summary.activeInjuries.length, "open injury", "open injuries") : undefined}
                        icon={<Bandage />}
                        action={
                            <ButtonLink href={newInjuryHref} variant="ghost" size="sm">
                                Record injury
                            </ButtonLink>
                        }
                    />
                    <CardContent>
                        {summary.activeInjuries.length === 0 ? (
                            <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">No active or recovering injuries.</p>
                        ) : (
                            <div className={summary.activeInjuries.length > 1 ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "grid grid-cols-1 gap-3"}>
                                {summary.activeInjuries.map((injury) => (
                                    <InjuryCard key={injury.id} injury={injury} now={now} href={routes.doctor.injury(injury.id)} className="min-w-0" />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {summary.activeRecoveryPlan && (
                    <Card>
                        <CardHeader
                            title={summary.activeRecoveryPlan.plan.title}
                            description={
                                summary.activeRecoveryPlan.currentPhase
                                    ? `Recovery plan · current phase: ${summary.activeRecoveryPlan.currentPhase.name}`
                                    : "Recovery plan"
                            }
                            icon={<RefreshCw />}
                            action={
                                <CardLink href={routes.doctor.recoveryPlan(summary.activeRecoveryPlan.plan.id)} srContext={summary.activeRecoveryPlan.plan.title}>
                                    Open plan
                                </CardLink>
                            }
                        />
                        <CardContent>
                            <RecoveryProgress plan={summary.activeRecoveryPlan.plan} now={now} />
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader
                        title="Latest vitals"
                        description={
                            latestExam ? `${EXAMINATION_TYPE_LABELS[latestExam.type]} on ${formatDate(latestExam.date)}` : "No examinations recorded yet"
                        }
                        icon={<Stethoscope />}
                        action={latestExam && <CardLink href={routes.doctor.examination(latestExam.id)}>View examination</CardLink>}
                    />
                    <CardContent>
                        {latestExam ? (
                            <VitalsGrid vitals={latestExam.vitals} weightLimitKg={fighter.targetWeightKg} />
                        ) : (
                            <EmptyState
                                compact
                                icon={<Stethoscope />}
                                title="No vitals yet"
                                description="A baseline physical records the reference vitals for this fighter."
                                action={
                                    <ButtonLink href={`${newExamHref}&type=baseline`} variant="secondary" size="sm">
                                        Start baseline exam
                                    </ButtonLink>
                                }
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
                <Card>
                    <CardHeader title="Health status" icon={<HeartPulse />} />
                    <CardContent className="flex flex-col gap-4">
                        <div>
                            <HealthStatusBadge status={fighter.healthStatus} />
                            <p className="mt-1.5 text-sm text-fg-muted">{HEALTH_STATUS_DESCRIPTIONS[fighter.healthStatus]}</p>
                        </div>
                        <HealthStatusControl key={fighter.healthStatus} fighterId={fighter.id} fighterName={fighter.name} current={fighter.healthStatus} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Next follow-up" icon={<CalendarClock />} />
                    <CardContent>
                        {summary.nextFollowUp ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <DateBlock date={summary.nextFollowUp.date} highlighted={summary.nextFollowUp.daysUntil === 0} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-fg">
                                            {summary.nextFollowUp.daysUntil < 0
                                                ? `Overdue by ${pluralize(-summary.nextFollowUp.daysUntil, "day")}`
                                                : capitalize(describeDaysUntil(summary.nextFollowUp.daysUntil))}
                                        </p>
                                        <p className="text-[13px] text-fg-muted">
                                            Set at the {EXAMINATION_TYPE_LABELS[summary.nextFollowUp.examination.type].toLowerCase()} on{" "}
                                            {formatShortDate(summary.nextFollowUp.examination.date)}
                                        </p>
                                    </div>
                                </div>
                                <ButtonLink href={followUpExaminationHref(summary.nextFollowUp)} variant="secondary" size="sm" className="self-start">
                                    <ClipboardPlus aria-hidden />
                                    Start follow-up examination
                                </ButtonLink>
                            </div>
                        ) : (
                            <p className="text-sm text-fg-muted">No follow-up scheduled. Set one when you record the next examination.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader title="Body map" description="Open injuries and those resolved in the last 6 months" icon={<MapIcon />} />
                    <CardContent>
                        {mapHighlights.length > 0 ? (
                            <BodyMap highlights={mapHighlights} size="md" />
                        ) : (
                            <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">No open or recently resolved injuries to show.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader
                        title="AI observations"
                        description={summary.openAlerts.length > 0 ? `${summary.openAlerts.length} open` : undefined}
                        icon={<Sparkles />}
                        action={<CardLink href={routes.doctor.aiAlerts}>All observations</CardLink>}
                    />
                    <CardContent className="flex flex-col gap-3">
                        <AINotice audience="doctor" compact />
                        <AIObservationList observations={summary.openAlerts.map((alert) => ({ alert }))} now={now} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    const tabs: { id: (typeof TABS)[number]; label: ReactNode; content: ReactNode }[] = [
        { id: "overview", label: "Overview", content: overview },
        {
            id: "record",
            label: "Medical record",
            content: (
                <MedicalRecordPanel fighterId={fighter.id} fighterName={fighter.name} record={record} primaryDoctorName={primaryDoctorName} now={now} />
            ),
        },
        {
            id: "examinations",
            label: <TabLabel label="Examinations" count={examinations.length} />,
            content: (
                <Card>
                    <CardHeader
                        title="Examinations"
                        description="Newest first. Open an examination for vitals, assessments and recommendations."
                        action={
                            <ButtonLink href={newExamHref} variant="secondary" size="sm">
                                <ClipboardPlus aria-hidden />
                                New examination
                            </ButtonLink>
                        }
                    />
                    <div className="pb-2">
                        <ExaminationHistory
                            examinations={examinations}
                            doctorNames={doctorNames}
                            weightLimitKg={fighter.targetWeightKg}
                            newExaminationHref={newExamHref}
                        />
                    </div>
                </Card>
            ),
        },
        {
            id: "injuries",
            label: <TabLabel label="Injury history" count={injuries.length} />,
            content: (
                <Card>
                    <CardHeader
                        title="Injury history"
                        description="Open and resolved injuries, most recent first."
                        action={
                            <ButtonLink href={newInjuryHref} variant="secondary" size="sm">
                                <Bandage aria-hidden />
                                Record injury
                            </ButtonLink>
                        }
                    />
                    <div className="pb-2">
                        <InjuryHistory injuries={injuries} />
                    </div>
                </Card>
            ),
        },
        {
            id: "clearance",
            label: <TabLabel label="Clearance history" count={clearances.length} />,
            content: (
                <Card>
                    <CardHeader
                        title="Clearance history"
                        description={`Every Medical Clearance issued to ${fighter.name}, newest first.`}
                        action={
                            <ButtonLink href={grantHref} variant="secondary" size="sm">
                                <ShieldCheck aria-hidden />
                                Update clearance
                            </ButtonLink>
                        }
                    />
                    <CardContent>
                        <ClearanceHistory
                            clearances={clearances}
                            examinationsById={new Map(examinations.map((exam) => [exam.id, exam]))}
                            doctorNames={doctorNames}
                            now={now}
                            warningDays={settings.clearanceExpiryWarningDays}
                        />
                    </CardContent>
                </Card>
            ),
        },
    ];

    return (
        <>
            <FlashToast notice={noticeFor(param(query.notice), fighter.name)} cleanHref={hrefWith(pathname, query, { notice: null })} />
            <FighterProfileHeader
                fighter={fighter}
                clearanceState={clearanceState}
                back={{ href: routes.doctor.fighters, label: "Fighters" }}
                now={now}
                eyebrow="Health profile"
                facts={[fighter.primaryDiscipline, WEIGHT_CLASS_LABELS[fighter.weightClass], TRAINING_LEVEL_LABELS[fighter.level]]}
                meta={
                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <li>
                            Age <span className="font-medium text-fg">{ageFromBirthDate(fighter.dateOfBirth, now)}</span>
                        </li>
                        <li>
                            Weight <span className="font-medium text-fg">{formatNumber(fighter.weightKg, 1)} kg</span>{" "}
                            {weightDiff > 0
                                ? `(${formatNumber(weightDiff, 1)} kg over the ${formatNumber(fighter.targetWeightKg, 1)} kg limit)`
                                : `(within the ${formatNumber(fighter.targetWeightKg, 1)} kg limit)`}
                        </li>
                        {primaryDoctorName && (
                            <li>
                                Primary doctor <span className="font-medium text-fg">{primaryDoctorName}</span>
                            </li>
                        )}
                    </ul>
                }
                actions={
                    <>
                        <ButtonLink href={newInjuryHref} variant="secondary">
                            <Bandage aria-hidden />
                            Record injury
                        </ButtonLink>
                        <ButtonLink href={newExamHref}>
                            <ClipboardPlus aria-hidden />
                            New examination
                        </ButtonLink>
                    </>
                }
            />

            <Tabs key={tab} items={tabs} defaultTab={tab} label="Health profile sections" listClassName="mb-6" />
        </>
    );
}

function TabLabel({ label, count }: { label: string; count: number }) {
    return (
        <>
            {label}
            <span className="rounded-full bg-surface-hover px-1.5 text-[11px] leading-5 text-fg-muted tabular-nums">{count}</span>
        </>
    );
}

function bodyMapHighlights(injuries: Awaited<ReturnType<typeof listInjuries>>, now: string): BodyMapHighlight[] {
    return injuries
        .filter((injury) => !injury.resolvedAt || daysBetween(injury.resolvedAt, now) <= RECENT_RESOLVED_DAYS)
        .map(
            (injury): BodyMapHighlight => ({
            region: injury.bodyRegion,
            tone: INJURY_STATUS_META[injury.status].tone,
            label:
                injury.status === "resolved" && injury.resolvedAt
                    ? `${INJURY_TYPE_LABELS[injury.type]} · resolved ${formatShortDate(injury.resolvedAt)}`
                    : `${INJURY_TYPE_LABELS[injury.type]} · ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}`,
        }),
        );
}

function noticeFor(code: string | undefined, fighterName: string): ToastInput | null {
    switch (code) {
        case "clearance-full":
            return {
                title: `${fighterName} is cleared for full training`,
                description: "The new Medical Clearance is in force. Coaches and the fighter have been notified.",
            };
        case "clearance-restricted":
            return {
                title: "Restricted clearance issued",
                description: `Coaches now plan ${fighterName}'s sessions against these restrictions. Everyone involved has been notified.`,
            };
        case "clearance-not_cleared":
            return {
                title: `${fighterName} is not cleared`,
                description: "Planned training is blocked. Coaches and the fighter have been notified.",
                tone: "warning",
            };
        default:
            return null;
    }
}
