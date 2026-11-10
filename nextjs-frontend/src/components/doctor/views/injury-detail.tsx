import { ArrowRight, CircleCheck, ClipboardList, FileText, MapPin, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AddTreatmentDialog } from "@/components/clinical/add-treatment-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { InjuryStatusActions } from "@/components/clinical/injury-status-actions";
import { ObservationSummary } from "@/components/clinical/observation-summary";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { AINotice } from "@/components/domain/ai-notice";
import { RegionModel } from "@/components/doctor/region-model";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { ClearanceBadge, FighterStatusBadges, InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { RestrictionSummary } from "@/components/medical/restriction-summary";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import type { Injury, InjuryMechanism, InjuryStatus } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceStatus, getInjuryDetail } from "@/lib/services/medical";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { getVideo } from "@/lib/services/videos";
import { param } from "@/lib/utils";

import { daysUntil } from "./days-until";

/**
 * The shared domain labels and badges keep this screen's Vietnamese wording only when given no locale (their `vi`
 * dictionary words some values differently), so they get a locale only in English.
 */
const enOnly = (locale: Locale) => (locale === "en" ? locale : undefined);

const STATUS_TEXT: Record<InjuryStatus, MessageKey> = {
    active: "doctorViews.injury.status.active",
    recovering: "doctorViews.injury.status.recovering",
    resolved: "doctorViews.injury.status.resolved",
};
const MECHANISM_TEXT: Record<InjuryMechanism, MessageKey> = {
    sparring: "doctorViews.injury.mechanism.sparring",
    pad_work: "doctorViews.injury.mechanism.pad_work",
    heavy_bag: "doctorViews.injury.mechanism.heavy_bag",
    grappling: "doctorViews.injury.mechanism.grappling",
    strength_conditioning: "doctorViews.injury.mechanism.strength_conditioning",
    competition: "doctorViews.injury.mechanism.competition",
    outside_training: "doctorViews.injury.mechanism.outside_training",
};

/** The injury with its fighter, treatments, plan and linked observation, loaded once per request for the metadata and the page. */
const loadInjuryDetail = cache(getInjuryDetail);

/** The fighter an injury belongs to, when the doctor may open it. */
export async function injuryOwner(injuryId: string): Promise<string | null> {
    const [detail, user] = await Promise.all([loadInjuryDetail(injuryId), getCurrentUser()]);
    return detail && user && canAccessFighter(user, detail.injury.fighterId) ? detail.injury.fighterId : null;
}

export async function injuryMetadata(injuryId: string): Promise<Metadata> {
    const user = await getCurrentUser();
    const detail = await loadInjuryDetail(injuryId);
    // The title must not reveal a record the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.injury.fighterId);
    const { t, locale } = await getTranslator();
    return { title: visible ? `${injuryTitle(detail.injury, enOnly(locale))} · ${detail.fighter.name}` : t("doctorViews.injuries.title") };
}

/** One injury, shown inside its fighter's profile. */
export async function InjuryDetail({ injuryId, query, fighterId: scopedId }: { injuryId: string; query: Record<string, string | string[] | undefined>; fighterId: string }) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadInjuryDetail(injuryId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.injury.fighterId) || detail.injury.fighterId !== scopedId) notFound();
    const { injury, fighter, treatments, recoveryPlan, linkedAlert, recordedBy } = detail;

    const { clearance, state: clearanceNow } = await getClearanceStatus(fighter.id, now);
    const linkedVideo = linkedAlert ? await getVideo(linkedAlert.videoId) : null;
    const justCreated = param(query.created) === "1";
    const openPlan = recoveryPlan && recoveryPlan.status !== "completed" ? recoveryPlan : null;
    const firstName = fighter.name.split(" ")[0];
    const serviceForms = usesMedicalServiceForms();

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.fighterInjuries(fighter.id), label: t("doctorViews.injuries.title") }}
                eyebrow={t("doctorViews.injury.eyebrow")}
                title={injuryTitle(injury, enOnly(locale))}
                meta={
                    <>
                        <InjurySeverityBadge severity={injury.severity} locale={enOnly(locale)} />
                        <InjuryStatusBadge status={injury.status} locale={enOnly(locale)} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <Link
                            href={routes.doctor.fighter(fighter.id)}
                            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-fg hover:underline"
                        >
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            {fighter.name}
                        </Link>
                        <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={clearanceNow} size="sm" locale={enOnly(locale)} />
                    </>
                }
                actions={
                    <InjuryStatusActions
                        injuryId={injury.id}
                        fighterId={fighter.id}
                        status={injury.status}
                        canReopen={!usesMedicalServiceForms()}
                        fighterName={fighter.name}
                        openPlanTitle={openPlan?.title ?? null}
                        todayLabel={formatDate(now, locale)}
                    />
                }
            />

            <div className="flex flex-col gap-6">
                {justCreated && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        role="status"
                        title={t("doctorViews.injury.createdTitle")}
                        action={
                            <>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    {t("doctorViews.injury.reviewClearance", { name: fighter.name })}
                                </ButtonLink>
                                <ButtonLink href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} variant="ghost" size="sm" replace scroll={false}>
                                    {t("doctorViews.injury.close")}
                                </ButtonLink>
                            </>
                        }
                    >
                        {serviceForms
                            ? t("doctorViews.injury.createdService", { name: fighter.name })
                            : t("doctorViews.injury.createdDemo", { name: fighter.name })}
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title={t("doctorViews.injury.details")} icon={<FileText />} />
                            <CardContent className="flex flex-col gap-5">
                                <DescriptionList items={detailItems(t, locale, injury, now, recordedBy?.name ?? null)} columns={3} className="grid-cols-2" />
                                <div className="border-t border-border pt-4">
                                    <h3 className="text-[13px] font-semibold text-fg">{t("doctorViews.injury.description")}</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-fg">{injury.description}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title={t("doctorViews.injuries.colTreatment")}
                                description={
                                    treatments.length === 0
                                        ? t("doctorViews.injury.treatmentsSub")
                                        : medicalFeatureAvailable("treatmentStatus")
                                          ? t("doctorViews.injury.treatmentsOngoing", { n: treatments.filter((tr) => tr.status === "ongoing").length, total: treatments.length })
                                          : plural(t, "doctorViews.injury.treatmentsRecorded", treatments.length)
                                }
                                icon={<ClipboardList />}
                                action={
                                    <AddTreatmentDialog
                                        injuryId={injury.id}
                                        fighterId={fighter.id}
                                        mode={usesMedicalServiceForms() ? "service" : "demo"}
                                        providerName={user.name}
                                        today={dayKey(now)}
                                    />
                                }
                            />
                            {treatments.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<ClipboardList />}
                                    title={t("doctorViews.injury.noTreatments")}
                                    description={t("doctorViews.injury.noTreatmentsBody")}
                                    className="border-t border-border"
                                />
                            ) : (
                                <TreatmentList treatments={treatments} editable className="border-t border-border" />
                            )}
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("doctorViews.injury.plan")}
                                icon={<RefreshCw />}
                                description={recoveryPlan ? recoveryPlan.title : t("doctorViews.injury.planSub")}
                                action={
                                    recoveryPlan ? (
                                        <div className="flex items-center gap-2">
                                            <RecoveryPlanStatusBadge status={recoveryPlan.status} size="sm" />
                                        </div>
                                    ) : undefined
                                }
                            />
                            <CardContent>
                                {recoveryPlan ? (
                                    <div className="flex flex-col gap-5">
                                        <RecoveryProgress plan={recoveryPlan} now={now} locale={locale} />
                                        <Link
                                            href={routes.doctor.fighterRecoveryPlan(recoveryPlan.fighterId, recoveryPlan.id)}
                                            className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary-soft-fg hover:underline"
                                        >
                                            {serviceForms ? t("doctorViews.injury.openPlanService") : t("doctorViews.injury.openPlanDemo")}
                                            <ArrowRight aria-hidden className="size-4" />
                                        </Link>
                                    </div>
                                ) : injury.status === "resolved" ? (
                                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                        {t("doctorViews.injury.noPlanResolved")}
                                    </p>
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<RefreshCw />}
                                        title={t("doctorViews.injury.noPlan")}
                                        description={
                                            serviceForms
                                                ? t("doctorViews.injury.noPlanService", { name: firstName })
                                                : t("doctorViews.injury.noPlanDemo", { name: firstName })
                                        }
                                        action={
                                            <ButtonLink href={clinicalLinks.newRecoveryPlanFor(injury.id, fighter.id)} size="sm">
                                                {t("doctorViews.injury.createPlan")}
                                            </ButtonLink>
                                        }
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <aside aria-label={t("doctorViews.injury.asideLabel")} className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title={t("doctorViews.injuries.colPlace")} icon={<MapPin />} />
                            <CardContent>
                                <RegionModel targets={[{ joint: injury.joint, region: injury.bodyRegion }]} label={`${t(`injurySeverity.${injury.severity}`)} · ${t(STATUS_TEXT[injury.status]).toLowerCase()}`} status={injury.status === "active" ? "ACTIVE" : injury.status === "recovering" ? "RECOVERING" : "RESOLVED"} height={380} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title={t("doctorViews.exam.clearance")} icon={<ShieldCheck />} description={t("doctorViews.injury.clearanceSub")} />
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex flex-col items-start gap-1.5">
                                    <ClearanceBadge state={clearanceNow} locale={enOnly(locale)} />
                                    <ClearanceValidity clearance={clearance} state={clearanceNow} now={now} warningDays={settings.clearanceExpiryWarningDays} variant="inline" locale={locale} />
                                </div>
                                {clearance && clearance.restrictions.length > 0 && clearanceNow === "restricted" && (
                                    <RestrictionSummary restrictions={clearance.restrictions} locale={locale} />
                                )}
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} variant="secondary" size="sm" className="w-fit">
                                    {t("doctorViews.exam.updateClearance")}
                                </ButtonLink>
                            </CardContent>
                        </Card>

                        {linkedAlert ? (
                            <section aria-labelledby="linked-observation-heading" className="flex flex-col gap-3">
                                <h2 id="linked-observation-heading" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                                    <Radar aria-hidden className="size-4 text-fg-muted" />
                                    {t("doctorViews.injury.linkedAi")}
                                </h2>
                                <AINotice audience="doctor" compact locale={enOnly(locale)} />
                                <ObservationSummary
                                    alert={linkedAlert}
                                    source={linkedVideo ? { trainingType: linkedVideo.trainingType, uploadedAt: linkedVideo.uploadedAt } : null}
                                    href={routes.doctor.aiAlert(linkedAlert.id)}
                                />
                            </section>
                        ) : (
                            <Card>
                                <CardHeader title={t("doctorViews.injury.ai")} icon={<Radar />} />
                                <CardContent>
                                    <p className="text-sm text-fg-muted">{t("doctorViews.injury.noAi")}</p>
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

function detailItems(t: Translator, locale: Locale, injury: Injury, now: string, recordedByName: string | null): DescriptionItem[] {
    // The medical service keeps no diagnosis date, mechanism or expected return, so its records skip those rows.
    const serviceRecord = injury.joint !== undefined;
    const notRecorded = t("doctorViews.injury.notRecorded");
    const items: DescriptionItem[] = [{ label: t("doctorViews.injury.occurred"), value: <time dateTime={injury.occurredAt}>{formatDateTime(injury.occurredAt, locale)}</time> }];
    if (!serviceRecord) {
        items.push(
            { label: t("doctorViews.injury.diagnosed"), value: injury.diagnosedAt ? <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt, locale)}</time> : notRecorded },
            { label: t("doctorViews.injury.mechanism"), value: injury.mechanism ? t(MECHANISM_TEXT[injury.mechanism]) : notRecorded },
        );
    }

    if (injury.resolvedAt) {
        items.push({ label: t("doctorViews.injury.status.resolved"), value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt, locale)}</time> });
        items.push({ label: t("doctorViews.injury.timeToResolve"), value: plural(t, "doctorViews.injury.days", Math.max(0, daysBetween(injury.occurredAt, injury.resolvedAt))) });
    } else if (serviceRecord) {
        // No expected return in the service's record; the recovery plan carries it.
    } else if (injury.expectedReturnAt) {
        const days = daysBetween(now, injury.expectedReturnAt);
        items.push({
            label: t("doctorViews.injury.expectedReturn"),
            value: (
                <span className="flex flex-col gap-0.5">
                    <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt, locale)}</time>
                    <span className={days < 0 ? "text-[13px] font-medium text-warning-fg" : "text-[13px] font-normal text-fg-muted"}>
                        {days < 0 ? t("doctorViews.injury.overdue", { ago: daysUntil(t, days) }) : days === 0 ? t("doctorViews.injury.today") : plural(t, "doctorViews.injury.daysLeft", days)}
                    </span>
                </span>
            ),
        });
    } else {
        items.push({ label: t("doctorViews.injury.expectedReturn"), value: <span className="font-normal text-fg-muted">{t("doctorViews.injury.needsReview")}</span> });
    }

    if (!injury.resolvedAt) items.push({ label: t("doctorViews.injury.daysSince"), value: plural(t, "doctorViews.injury.days", Math.max(0, daysBetween(injury.occurredAt, now))) });
    if (recordedByName) items.push({ label: t("doctorViews.injury.recordedBy"), value: recordedByName });
    return items;
}
