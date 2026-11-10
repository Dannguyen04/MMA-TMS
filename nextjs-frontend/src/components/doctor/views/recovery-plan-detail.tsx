import { CircleCheck, ClipboardList, FileText, LineChart as LineChartIcon, ListChecks, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { CheckInDialog } from "@/components/clinical/check-in-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle, painLabel } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { LegacyMilestones, MilestoneTracker, PlanCloseActions } from "@/components/clinical/milestone-tracker";
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
import { dayKey, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceStatus, getRecoveryPlanDetail } from "@/lib/services/medical";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { getDoctor } from "@/lib/services/people";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { param } from "@/lib/utils";

/** The shared injury title and badges keep this screen's Vietnamese wording only when given no locale, so they get one only in English. */
const enOnly = (locale: Locale) => (locale === "en" ? locale : undefined);

/** The plan with its fighter, injury, treatments and doctor, loaded once per request for the metadata and the page. */
const loadRecoveryPlanDetail = cache(getRecoveryPlanDetail);

/** The fighter a recovery plan belongs to, when the doctor may open it. */
export async function recoveryPlanOwner(planId: string): Promise<string | null> {
    const [detail, user] = await Promise.all([loadRecoveryPlanDetail(planId), getCurrentUser()]);
    return detail && user && canAccessFighter(user, detail.plan.fighterId) ? detail.plan.fighterId : null;
}

export async function recoveryPlanMetadata(planId: string): Promise<Metadata> {
    const user = await getCurrentUser();
    const detail = await loadRecoveryPlanDetail(planId);
    // The title must not reveal a plan the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.plan.fighterId);
    const { t } = await getTranslator();
    return { title: visible ? `${detail.plan.title} · ${detail.fighter.name}` : t("doctorViews.injury.plan") };
}

/** One recovery plan, shown inside its fighter's profile. */
export async function RecoveryPlanDetail({ planId, query, fighterId: scopedId }: { planId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadRecoveryPlanDetail(planId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.plan.fighterId) || detail.plan.fighterId !== scopedId) notFound();
    const { plan, fighter, injury, treatments, doctor } = detail;

    const { clearance, state: clearanceNow } = await getClearanceStatus(fighter.id, now);
    const clearanceDoctor = clearance ? await getDoctor(clearance.doctorId) : null;
    const justCreated = param(query.created) === "1";
    const checkInsNewestFirst = [...plan.checkIns].reverse();
    const lastCheckIn = plan.checkIns.at(-1) ?? null;
    const isCompleted = plan.status === "completed";
    // API mode: the service's plans are flat milestone lists, closed by completing or cancelling them.
    const serviceForms = usesMedicalServiceForms();
    const milestones = plan.milestones ?? [];

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.fighterRecovery(fighter.id), label: t("doctorViews.history.kind.plan") }}
                eyebrow={t("doctorViews.injury.plan")}
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
                                    href={routes.doctor.fighterInjury(injury.fighterId, injury.id)}
                                    className="rounded-md text-sm text-fg-muted hover:text-fg hover:underline"
                                >
                                    {injuryTitle(injury, enOnly(locale))}
                                </Link>
                                <InjuryStatusBadge status={injury.status} size="sm" locale={enOnly(locale)} />
                            </>
                        )}
                    </>
                }
                actions={
                    serviceForms ? (
                        plan.status === "active" && <PlanCloseActions fighterId={fighter.id} planId={plan.id} />
                    ) : !isCompleted && (
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
                        title={t("doctorViews.plan.createdTitle")}
                        action={
                            <ButtonLink href={routes.doctor.fighterRecoveryPlan(plan.fighterId, plan.id)} variant="ghost" size="sm" replace scroll={false}>
                                {t("doctorViews.injury.close")}
                            </ButtonLink>
                        }
                    >
                        {serviceForms
                            ? t("doctorViews.plan.createdService", { name: fighter.name })
                            : t("doctorViews.plan.createdDemo", { name: fighter.name })}
                    </Callout>
                )}

                {isCompleted && injury && injury.status !== "resolved" && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        title={serviceForms ? t("doctorViews.plan.completedService") : t("doctorViews.plan.completedDemo")}
                        action={
                            <>
                                <ButtonLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} size="sm" variant="secondary">
                                    {t("doctorViews.plan.openInjury")}
                                </ButtonLink>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    {t("doctorViews.plan.reviewClearance")}
                                </ButtonLink>
                            </>
                        }
                    >
                        {t("doctorViews.plan.completedBody")}
                    </Callout>
                )}

                {serviceForms ? (
                    <Card>
                        <CardHeader
                            title={t("doctorViews.plan.milestones")}
                            icon={<ListChecks />}
                            description={plan.status === "active" ? t("doctorViews.plan.milestonesActive") : t("doctorViews.plan.closed")}
                        />
                        <CardContent>
                            {plan.legacyMilestones ? (
                                <LegacyMilestones items={plan.legacyMilestones} />
                            ) : (
                                <MilestoneTracker fighterId={fighter.id} planId={plan.id} milestones={milestones} editable={plan.status === "active"} startDate={dayKey(plan.startDate)} />
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader
                            title={t("doctorViews.plan.phases")}
                            icon={<ListChecks />}
                            description={t("doctorViews.plan.phasesSub")}
                        />
                        <CardContent>
                            <RecoveryTracker plan={plan} now={now} />
                        </CardContent>
                    </Card>
                )}

                {medicalFeatureAvailable("recoveryPhasesAndCheckIns") && (
                    <Card className="overflow-hidden">
                        <CardHeader
                            title={t("doctorViews.plan.checkIns")}
                            icon={<LineChartIcon />}
                            description={
                                plan.checkIns.length === 0
                                    ? t("doctorViews.plan.checkInsSub")
                                    : plural(t, "doctorViews.plan.checkInsCount", plan.checkIns.length, { date: formatDate(plan.checkIns.at(-1)?.date ?? now, locale) })
                            }
                        />
                        {plan.checkIns.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<LineChartIcon />}
                                title={t("doctorViews.plan.noCheckIns")}
                                description={t("doctorViews.plan.noCheckInsBody")}
                                className="border-t border-border"
                            />
                        ) : (
                            <>
                                <CardContent>
                                    {plan.checkIns.length >= 2 ? (
                                        <CheckInCharts checkIns={plan.checkIns} audience="clinical" locale={locale} />
                                    ) : (
                                        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                            {t("doctorViews.plan.trendLater")}
                                        </p>
                                    )}
                                </CardContent>
                                <div className="border-t border-border">
                                    <h3 className="sr-only">{t("doctorViews.plan.history")}</h3>
                                    <Table caption={t("doctorViews.plan.historyCaption")}>
                                        <THead>
                                            <tr>
                                                <TH>{t("doctorViews.plan.colDate")}</TH>
                                                <TH className="text-right">{t("doctorViews.plan.colPain")}</TH>
                                                <TH className="text-right">{t("doctorViews.plan.colMobility")}</TH>
                                                <TH className="text-right">{t("doctorViews.plan.colStrength")}</TH>
                                                <TH>{t("doctorViews.plan.colNote")}</TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {checkInsNewestFirst.map((checkIn) => (
                                                <TR key={checkIn.date}>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={checkIn.date}>{formatDate(checkIn.date, locale)}</time>
                                                    </TD>
                                                    <TD className="text-right whitespace-nowrap">
                                                        <span className="font-medium">{checkIn.painLevel}</span>
                                                        <span className="text-fg-muted">/10</span>
                                                        <span className="block text-xs text-fg-muted">{painLabel(checkIn.painLevel, undefined, t)}</span>
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
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 overflow-hidden lg:col-span-2">
                        <CardHeader
                            title={t("doctorViews.injuries.colTreatment")}
                            icon={<ClipboardList />}
                            description={t("doctorViews.plan.treatmentsSub")}
                            action={
                                injury && (
                                    <CardLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} srContext={t("doctorViews.plan.manageContext")}>
                                        {t("doctorViews.plan.manage")}
                                    </CardLink>
                                )
                            }
                        />
                        {treatments.length === 0 ? (
                            <p className="border-t border-border px-5 py-4 text-sm text-fg-muted">{t("doctorViews.plan.noTreatments")}</p>
                        ) : (
                            <TreatmentList treatments={treatments} className="border-t border-border" />
                        )}
                    </Card>

                    <aside aria-label={t("doctorViews.plan.asideLabel")} className="flex min-w-0 flex-col gap-6">
                        <ClearanceCard
                            clearance={clearance}
                            state={clearanceNow}
                            doctorName={clearanceDoctor?.name}
                            now={now}
                            variant="summary"
                            warningDays={settings.clearanceExpiryWarningDays}
                        />
                        <Card>
                            <CardHeader title={t("doctorViews.plan.details")} icon={<FileText />} />
                            <CardContent>
                                <DescriptionList
                                    columns={1}
                                    items={[
                                        { label: t("doctorViews.plan.doctor"), value: doctor?.name ?? t("doctorViews.exam.doctorFallback") },
                                        { label: t("doctorViews.plan.start"), value: <time dateTime={plan.startDate}>{formatDate(plan.startDate, locale)}</time> },
                                        {
                                            label: t("doctorViews.plan.targetReturn"),
                                            value: plan.targetReturnDate ? <time dateTime={plan.targetReturnDate}>{formatDate(plan.targetReturnDate, locale)}</time> : t("doctorViews.injury.notRecorded"),
                                        },
                                        serviceForms
                                            ? { label: t("doctorViews.plan.milestones"), value: t("doctorViews.plan.milestonesDone", { done: milestones.filter((m) => m.isCompleted).length, total: milestones.length }) }
                                            : {
                                                  label: t("doctorViews.plan.phase"),
                                                  value: t("doctorViews.plan.phasesDone", { done: plan.phases.filter((p) => p.status === "completed").length, total: plan.phases.length }),
                                              },
                                        ...(plan.description ? [{ label: t("doctorViews.plan.method"), value: <span className="font-normal">{plan.description}</span> }] : []),
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
