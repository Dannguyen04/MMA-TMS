import { Bandage, CalendarClock, FileClock, HeartHandshake, History, MapPinned, RefreshCw, ShieldQuestion } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CardLink } from "@/components/dashboard/card-link";
import { CareTeamCard } from "@/components/dashboard/care-team-card";
import { CheckInTrends } from "@/components/dashboard/check-in-trends";
import { relativeDayText } from "@/components/dashboard/dashboard-utils";
import { ExaminationSummaryCard } from "@/components/dashboard/examination-summary-card";
import { injuryHighlights, loadCareTeam } from "@/components/dashboard/health-data";
import { HealthStatusCard } from "@/components/dashboard/health-status-card";
import { InlineNote } from "@/components/dashboard/inline-note";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { BodyMap } from "@/components/domain/body-map";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { InjuryCard } from "@/components/domain/injury-card";
import { ReviewRequestCard } from "@/components/medical/review-request-card";
import { MetricTile } from "@/components/domain/metric-tile";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { ClearanceBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { TabLabel, Tabs } from "@/components/ui/tabs";
import { requireFighterAccess, requireFighterId } from "@/lib/auth/access";
import { hasPermission, requireRole } from "@/lib/auth/session";
import { examinationTitle } from "@/lib/domain/labels";
import { formatDate, formatWeekdayDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getClearanceStatus, getFighterHealthSummary, listClearances, listExaminations, listInjuries, listReviewRequests } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("fighterHealth.metaTitle") };
}

const TABS = ["status", "injuries", "history"] as const;

/**
 * The fighter's health in three tabs instead of one long page: whether they may train (and asking for a review),
 * injuries and recovery, and what the doctor has recorded. `?tab=` keeps the open tab across reloads and links.
 */
export default async function FighterHealthPage({ searchParams }: PageProps<"/fighter/health">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    // The profile read runs beside the page's own reads; only the care team and the name wait for it.
    const fighterRead = requireFighterAccess(user, fighterId);
    const ids = [fighterId];
    const now = new Date().toISOString();
    const tab = parseEnum(param((await searchParams).tab), TABS) ?? "status";

    const [fighter, health, clearances, injuries, examinations, doctors, careTeam, settings, reviewRequests, { eligibility }, { t, locale }] = await Promise.all([
        fighterRead,
        getFighterHealthSummary(fighterId, now),
        listClearances({ fighterIds: ids }),
        listInjuries({ fighterIds: ids }),
        listExaminations({ fighterIds: ids }),
        listDoctors(),
        fighterRead.then(loadCareTeam),
        getSettings(),
        listReviewRequests(fighterId),
        getClearanceStatus(fighterId, now),
        getTranslator(),
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

    const status = (
        <TwoColumns
            main={
                <>
                    {clearanceState === "none" ? (
                        <Card className="min-w-0">
                            <CardHeader title={t("coachClearance.pageTitle")} icon={<ShieldQuestion />} />
                            <CardContent className="flex flex-col gap-3">
                                <ClearanceBadge state="none" className="w-fit" locale={locale} />
                                <p className="text-[15px] font-semibold text-fg">{t("fighterHealth.noClearanceOnFile")}</p>
                                <p className="max-w-2xl text-sm text-pretty text-fg-muted">
                                    {t("fighterHealth.noClearanceDesc")}

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
                            pausedForReview={eligibility?.reasons.includes("REVIEW_REQUEST_PENDING")}
                            className="min-w-0"
                        />
                    )}
                    <ReviewRequestCard
                        fighterId={fighter.id}
                        fighterName={fighter.name}
                        audience="fighter"
                        requests={reviewRequests}
                        eligibility={eligibility}
                        canRequest={hasPermission(user, "medical:request_review")}
                        now={now}
                        className="min-w-0"
                    />
                </>
            }
            side={
                <>
                    <HealthStatusCard status={health.fighter.healthStatus} locale={locale}>
                        {followUp ? (
                            <div className="rounded-lg border border-border px-3 py-2.5 text-[13px]">
                                <p className="flex items-center gap-1.5 text-fg-muted">
                                    <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                                    {t("fighterHealth.nextFollowUp")}
                                </p>
                                <p className="mt-0.5 text-pretty">
                                    <time dateTime={followUp.date} className="font-medium text-fg">
                                        {formatWeekdayDate(followUp.date, locale)}
                                    </time>
                                    <span className="text-fg-muted">
                                        {t("fighterHealth.followUpDetail", {
                                            relative: relativeDayText(t, followUp.date, now).toLowerCase(),
                                            exam: examinationTitle(followUp.examination, locale).toLowerCase(),
                                        })}
                                    </span>
                                </p>
                            </div>
                        ) : (
                            <InlineNote icon={CalendarClock}>{t("fighterHealth.noFollowUpBooked")}</InlineNote>
                        )}
                        {contactDoctor && (
                            <InlineNote icon={HeartHandshake}>
                                {t("fighterHealth.questionsAboutClearance", { doctor: contactDoctor })}
                            </InlineNote>
                        )}
                    </HealthStatusCard>
                    <CareTeamCard members={careTeam} locale={locale} />
                </>
            }
        />
    );

    const injuriesAndRecovery = (
        <TwoColumns
            main={
                <>
                    {recovery && (
                        <Card className="min-w-0">
                            <CardHeader
                                title={t("fighterHealth.recoveryPlan")}
                                description={`${recovery.plan.title}${recoveryInjury ? ` · ${injuryTitle(recoveryInjury, locale)}` : ""}`}
                                icon={<RefreshCw />}
                                action={recoveryInjury && <CardLink href={routes.fighter.injury(recoveryInjury.id)}>{t("health.details")}</CardLink>}
                            />
                            <CardContent className="flex flex-col gap-6">
                                <RecoveryProgress plan={recovery.plan} now={now} locale={locale} />
                                {medicalFeatureAvailable("recoveryPhasesAndCheckIns") && (
                                    <div className="border-t border-border pt-5">
                                        <CheckInTrends checkIns={recovery.plan.checkIns} now={now} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="min-w-0">
                        <CardHeader
                            title={t("fighterHealth.activeInjuries")}
                            description={openInjuries.length > 0 ? t("fighterHealth.activeInjuriesDesc") : undefined}
                            icon={<Bandage />}
                        />
                        <CardContent>
                            {openInjuries.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<Bandage />}
                                    title={t("fighterHealth.noActiveInjuries")}
                                    description={
                                        resolvedCount > 0
                                            ? t("fighterHealth.noActiveInjuriesResolved")
                                            : t("fighterHealth.noActiveInjuriesPlain")
                                    }
                                    className="pt-0"
                                />
                            ) : (
                                <ul className={cn("grid grid-cols-1 gap-4", openInjuries.length > 1 && "md:grid-cols-2")}>
                                    {openInjuries.map((injury) => (
                                        <li key={injury.id} className="min-w-0">
                                            <InjuryCard injury={injury} now={now} href={routes.fighter.injury(injury.id)} className="h-full" locale={locale} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </>
            }
            side={
                <Card className="min-w-0">
                    <CardHeader title={t("fighterHealth.bodyMap")} description={t("fighterHealth.bodyMapDesc")} icon={<MapPinned />} />
                    <CardContent>
                        <BodyMap highlights={highlights} size="md" locale={locale} />
                        {highlights.length === 0 && <p className="mt-3 text-center text-[13px] text-fg-muted">{t("fighterHealth.noInjuries12Months")}</p>}
                    </CardContent>
                </Card>
            }
        />
    );

    const history = (
        <TwoColumns
            main={
                <Card className="min-w-0">
                    <CardHeader title={t("fighterHealth.medicalHistory")} description={t("fighterHealth.medicalHistoryDesc")} icon={<FileClock />} />
                    <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="grid flex-1 grid-cols-3 gap-2">
                            <MetricTile label={t("fighterHealth.metricExaminations")} value={examinations.length} />
                            <MetricTile
                                label={t("fighterHealth.metricInjuries")}
                                value={injuries.length}
                                hint={resolvedCount > 0 ? t("fighterHealth.metricResolvedCount", { count: resolvedCount }) : undefined}
                            />
                            <MetricTile
                                label={t("fighterHealth.metricClearanceDecisions")}
                                value={clearances.length}
                                hint={latestDecision ? t("fighterHealth.metricLatestDate", { date: formatDate(latestDecision.issuedAt, locale) }) : undefined}
                            />
                        </div>
                        <ButtonLink href={routes.fighter.medicalHistory} variant="secondary" className="shrink-0">
                            <History aria-hidden />
                            {t("fighterHealth.viewTimeline")}
                        </ButtonLink>
                    </CardContent>
                </Card>
            }
            side={
                <ExaminationSummaryCard
                    examination={health.latestExamination}
                    doctorName={health.latestExamination ? doctorNames.get(health.latestExamination.doctorId) : undefined}
                    historyHref={routes.fighter.medicalHistory}
                    now={now}
                    locale={locale}
                />
            }
        />
    );

    return (
        <>
            <PageHeader title={t("fighterHealth.pageTitle")} description={t("fighterHealth.pageDesc")} />
            <Tabs
                key={tab}
                defaultTab={tab}
                urlParam="tab"
                label={t("fighterHealth.tabsLabel")}
                listClassName="mb-6"
                items={[
                    { id: "status", label: t("fighterHealth.tabStatus"), content: status },
                    { id: "injuries", label: <TabLabel label={t("fighterHealth.tabInjuries")} count={openInjuries.length || undefined} />, content: injuriesAndRecovery },
                    { id: "history", label: t("fighterHealth.tabHistory"), content: history },
                ]}
            />
        </>
    );
}

function TwoColumns({ main, side }: { main: ReactNode; side: ReactNode }) {
    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">{main}</div>
            <div className="flex min-w-0 flex-col gap-6">{side}</div>
        </div>
    );
}
