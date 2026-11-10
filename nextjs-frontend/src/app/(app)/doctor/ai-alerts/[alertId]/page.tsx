import { ArrowRight, Bandage, CalendarClock, ClipboardPlus, Film, HeartPulse, History, Ruler, Sparkles, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AlertDecisionPanel } from "@/components/clinical/alert-decision-panel";
import { describeMetricComparison, injuryTitle, metricUnit, regionText, trainingTypeText } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { ObservationEvidence } from "@/components/clinical/observation-evidence";
import { CHART_MUTED } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { RegionModel } from "@/components/doctor/region-model";
import { AINotice } from "@/components/domain/ai-notice";
import { ConfidenceMeter } from "@/components/domain/confidence-meter";
import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { AIGeneratedBadge, AlertStatusBadge, ConfidenceBadge, FighterStatusBadges, InjuryStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { FeatureUnavailable } from "@/components/ui/states";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { isLowConfidence } from "@/lib/domain/rules";
import type { AbnormalMovementAlert } from "@/lib/domain/types";
import { daysBetween, formatClock, formatConfidence, formatDate, formatDateTime, formatDelta, formatTimestamp } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getAlertDetail, listAlerts } from "@/lib/services/ai";
import { getFighterHealthSummary } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";

/** The observation with its fighter, footage and linked injury, loaded once per request for the metadata and the page. */
const loadAlertDetail = cache(getAlertDetail);

export async function generateMetadata({ params }: PageProps<"/doctor/ai-alerts/[alertId]">): Promise<Metadata> {
    const { t } = await getTranslator();
    if (!medicalFeatureAvailable("aiObservations")) return { title: t("doctorPages.meta.aiAlerts") };
    const [{ alertId }, user] = await Promise.all([params, getCurrentUser()]);
    const detail = await loadAlertDetail(alertId);
    // The title must not reveal an observation the viewer isn't assigned to.
    const visible = detail?.fighter && user && canAccessFighter(user, detail.alert.fighterId);
    return { title: visible && detail.fighter ? t("doctorPages.meta.aiAlert", { name: detail.fighter.name }) : t("doctorPages.meta.aiAlertFallback") };
}

const HISTORY_LIMIT = 6;

export default async function AIAlertDetailPage({ params }: PageProps<"/doctor/ai-alerts/[alertId]">) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    // Without a locale these shared components keep their Vietnamese wording; the dictionary words some labels differently.
    const legacy = locale === "vi" ? undefined : locale;
    if (!medicalFeatureAvailable("aiObservations")) {
        return (
            <>
                <PageHeader back={{ href: routes.doctor.aiAlerts, label: t("doctorPages.meta.aiAlerts") }} title={t("doctorPages.meta.aiAlerts")} />
                <FeatureUnavailable title={t("doctorPages.alerts.unavailable")} description={t("doctorPages.featureUnavailable")} />
            </>
        );
    }
    const { alertId } = await params;
    const now = new Date().toISOString();

    const detail = await loadAlertDetail(alertId);
    if (!detail || !detail.fighter || !canAccessFighter(user, detail.alert.fighterId)) notFound();
    const { alert, fighter, video, analysis, linkedInjury } = detail;

    const [summary, fighterAlerts] = await Promise.all([getFighterHealthSummary(fighter.id, now), listAlerts({ fighterIds: [fighter.id] })]);
    if (!summary) notFound();
    const history = fighterAlerts
        .filter((other) => other.id !== alert.id)
        .sort(
            (a, b) =>
                Number(b.bodyRegion === alert.bodyRegion) - Number(a.bodyRegion === alert.bodyRegion) || b.detectedAt.localeCompare(a.detectedAt),
        )
        .slice(0, HISTORY_LIMIT);

    const unit = metricUnit(alert.metric);
    const decimals = Number.isInteger(alert.metric.observed) && Number.isInteger(alert.metric.baseline) ? 0 : 1;
    const suffix = unit === "°" || unit === "%" ? unit : ` ${unit}`;
    const delta = alert.metric.observed - alert.metric.baseline;
    const deltaPct = alert.metric.baseline !== 0 ? (delta / Math.abs(alert.metric.baseline)) * 100 : null;
    const lowConfidence = isLowConfidence(alert.confidence);

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.aiAlerts, label: t("doctorPages.meta.aiAlerts") }}
                eyebrow={t("doctorPages.alert.eyebrow", { region: regionText(t, alert.bodyRegion) })}
                title={alert.pattern}
                meta={
                    <>
                        <AIGeneratedBadge label={t("doctorPages.meta.aiAlerts")} />
                        <ConfidenceBadge confidence={alert.confidence} locale={locale} />
                        <AlertStatusBadge status={alert.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <span className="text-sm text-fg-muted">
                            {t("doctorPages.alert.detected")} <time dateTime={alert.detectedAt}>{formatDateTime(alert.detectedAt, locale)}</time>
                        </span>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <AINotice audience="doctor" locale={legacy} />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <section aria-labelledby="evidence-heading" className="flex min-w-0 flex-col gap-4">
                        <h2 id="evidence-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
                            <Sparkles aria-hidden className="size-4 text-ai-fg" />
                            {t("doctorPages.alert.evidence")}
                            <span className="text-sm font-normal text-fg-muted">{t("doctorPages.alert.aiMade")}</span>
                        </h2>

                        <Card className="border-ai-border">
                            <CardHeader
                                as="h3"
                                title={t("doctorPages.meta.aiAlerts")}
                                description={t("doctorPages.alert.patternDesc")}
                                icon={<Sparkles />}
                                action={<AIGeneratedBadge size="sm" locale={locale} />}
                            />
                            <CardContent className="flex flex-col gap-4">
                                <p className="rounded-lg bg-ai-soft/40 px-4 py-3 text-sm leading-relaxed text-pretty text-fg ring-1 ring-inset ring-ai-border/60">
                                    {alert.description}
                                </p>
                                <div>
                                    <p className="mb-1.5 text-[13px] text-fg-muted">{t("doctorPages.alert.confidence")}</p>
                                    <ConfidenceMeter confidence={alert.confidence} label={t("doctorPages.alert.confidence")} locale={locale} />
                                    {lowConfidence && <p className="mt-2 text-[13px] text-warning-fg">{t("doctorPages.alert.lowConfidence")}</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader as="h3" title={t("doctorPages.alert.metricTitle")} description={alert.metric.label} icon={<Ruler />} />
                            <CardContent className="flex flex-col gap-4">
                                <HorizontalBars
                                    ariaLabel={`${alert.metric.label}: ${describeMetricComparison(alert.metric, t)}`}
                                    items={[
                                        { label: t("doctorPages.alert.thisSession"), value: alert.metric.observed, color: "var(--ai-solid)", hint: t("doctorPages.alert.aiMeasure") },
                                        {
                                            label: t("doctorPages.alert.baselineOf", { name: fighter.name.split(" ")[0] ?? fighter.name }),
                                            value: alert.metric.baseline,
                                            color: CHART_MUTED,
                                            hint: t("doctorPages.alert.baselineHint"),
                                        },
                                    ]}
                                    valueSuffix={suffix}
                                    decimals={decimals}
                                    max={Math.max(alert.metric.observed, alert.metric.baseline) * 1.1}
                                />
                                <p className="text-[13px] text-fg-muted">
                                    {t("doctorPages.alert.difference")}{" "}
                                    <span className="font-medium text-fg">
                                        {formatDelta(delta, decimals)}
                                        {suffix}
                                    </span>
                                    {deltaPct !== null && unit !== "%" && t("doctorPages.alert.deltaPct", { pct: formatDelta(deltaPct) })}
                                    {t("doctorPages.alert.differenceNote")}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                as="h3"
                                title={t("doctorPages.alert.sourceVideo")}
                                icon={<Film />}
                                description={video ? video.title : t("doctorPages.alert.videoGone")}
                            />
                            <CardContent className="flex flex-col gap-5">
                                {video ? (
                                    <DescriptionList
                                        columns={3}
                                        items={[
                                            {
                                                label: t("doctorPages.alert.sessionType"),
                                                value: (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <TrainingTypeIcon type={video.trainingType} className="text-fg-muted" />
                                                        {trainingTypeText(t, video.trainingType)}
                                                    </span>
                                                ),
                                            },
                                            { label: t("doctorPages.alert.recorded"), value: <time dateTime={video.uploadedAt}>{formatDate(video.uploadedAt, locale)}</time> },
                                            {
                                                label: t("doctorPages.alert.durationCamera"),
                                                value: `${formatClock(video.durationSec)} · ${t(`screens.admin.cameraAngle.${video.cameraAngle}`)}`,
                                            },
                                        ]}
                                    />
                                ) : (
                                    <p className="text-sm text-fg-muted">{t("doctorPages.alert.videoDeleted")}</p>
                                )}

                                {video && analysis ? (
                                    <ObservationEvidence
                                        analysis={analysis}
                                        stance={fighter.stance ?? "orthodox"}
                                        cameraAngle={video.cameraAngle}
                                        sourceUrl={video.sourceUrl}
                                        title={video.title}
                                        timestampsMs={alert.timestampsMs}
                                    />
                                ) : (
                                    <div>
                                        <h4 className="mb-2 text-[13px] font-semibold text-fg">{t("doctorPages.alert.flaggedMoments")}</h4>
                                        <ol className="flex flex-wrap gap-2">
                                            {alert.timestampsMs.map((ms, index) => (
                                                <li
                                                    key={`${ms}-${index}`}
                                                    className="rounded-md bg-surface-muted px-2.5 py-1 text-[13px] text-fg tabular-nums"
                                                >
                                                    {t("doctorPages.alert.moment", { n: index + 1, time: formatTimestamp(ms) })}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section aria-labelledby="decision-heading" className="flex min-w-0 flex-col gap-4">
                        <h2 id="decision-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
                            <Stethoscope aria-hidden className="size-4 text-fg-muted" />
                            {t("doctorPages.alert.decision")}
                        </h2>

                        <Card>
                            <CardHeader as="h3" title={t("doctorPages.alert.region")} description={regionText(t, alert.bodyRegion)} icon={<Ruler />} />
                            <CardContent>
                                <RegionModel targets={[{ region: alert.bodyRegion }]} label={t("doctorPages.alert.regionModel")} status="RECOVERING" height={300} legend={false} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader as="h3" title={t("doctorPages.alert.health")} icon={<HeartPulse />} />
                            <CardContent className="flex flex-col gap-4">
                                <FighterIdentity fighter={fighter} href={routes.doctor.fighter(fighter.id)} locale={legacy} />
                                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={summary.clearanceState} locale={legacy} />
                                <div>
                                    <h4 className="mb-1.5 text-[13px] font-semibold text-fg">{t("doctorPages.alert.openInjuries")}</h4>
                                    {summary.activeInjuries.length > 0 ? (
                                        <ul className="flex flex-col gap-1.5">
                                            {summary.activeInjuries.map((injury) => (
                                                <li key={injury.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                                                    <Link href={routes.doctor.fighterInjury(injury.fighterId, injury.id)} className="font-medium text-fg hover:underline">
                                                        {injuryTitle(injury, legacy)}
                                                    </Link>
                                                    <InjuryStatusBadge status={injury.status} size="sm" locale={legacy} />
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[13px] text-fg-muted">{t("doctorPages.alert.noInjuries")}</p>
                                    )}
                                </div>
                                {summary.nextFollowUp && (
                                    <p className="flex items-center gap-2 text-[13px] text-fg-muted">
                                        <CalendarClock aria-hidden className="size-3.5" />
                                        {t("doctorPages.alert.followUp", {
                                            when: describeDaysUntil(summary.nextFollowUp.daysUntil, locale),
                                            date: formatDate(summary.nextFollowUp.date, locale),
                                        })}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {medicalFeatureAvailable("aiObservationReview") && (
                            <Card>
                                <CardHeader
                                    as="h3"
                                    title={t("doctorPages.alert.yourDecision")}
                                    description={t(alert.doctorReview ? "doctorPages.alert.decisionByDoctor" : "doctorPages.alert.decisionPrompt")}
                                    icon={<Stethoscope />}
                                />
                                <CardContent>
                                    <AlertDecisionPanel alertId={alert.id} review={alert.doctorReview} />
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader as="h3" title={t("doctorPages.alert.nextSteps")} icon={<ClipboardPlus />} />
                            <CardContent className="flex flex-col gap-3">
                                {linkedInjury ? (
                                    <div className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5">
                                        <p className="text-xs text-fg-muted">{t("doctorPages.alert.linkedInjury")}</p>
                                        <p className="flex flex-wrap items-center gap-2">
                                            <Bandage aria-hidden className="size-4 text-fg-muted" />
                                            <Link
                                                href={routes.doctor.fighterInjury(linkedInjury.fighterId, linkedInjury.id)}
                                                className="text-sm font-medium text-fg hover:underline"
                                            >
                                                {injuryTitle(linkedInjury, legacy)}
                                            </Link>
                                            <InjuryStatusBadge status={linkedInjury.status} size="sm" locale={legacy} />
                                        </p>
                                    </div>
                                ) : (
                                    <ButtonLink
                                        href={clinicalLinks.newInjuryFor({ fighterId: fighter.id, alertId: alert.id })}
                                        variant="secondary"
                                        className="justify-start"
                                    >
                                        <Bandage aria-hidden />
                                        {t("doctorPages.alert.recordInjury")}
                                    </ButtonLink>
                                )}
                                <ButtonLink href={clinicalLinks.newExaminationFor(fighter.id)} variant="secondary" className="justify-start">
                                    <Stethoscope aria-hidden />
                                    {t("doctorPages.alert.bookExam")}
                                </ButtonLink>
                            </CardContent>
                        </Card>
                    </section>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={t("doctorPages.alert.previous", { name: fighter.name })}
                        description={t("doctorPages.alert.previousDesc")}
                        icon={<History />}
                    />
                    {history.length === 0 ? (
                        <p className="border-t border-border px-5 py-4 text-sm text-fg-muted">{t("doctorPages.alert.noPrevious")}</p>
                    ) : (
                        <ul className="divide-y divide-border border-t border-border">
                            {history.map((other) => (
                                <HistoryRow key={other.id} alert={other} sameRegion={other.bodyRegion === alert.bodyRegion} now={now} t={t} locale={locale} />
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </>
    );
}

function HistoryRow({ alert, sameRegion, now, t, locale }: { alert: AbnormalMovementAlert; sameRegion: boolean; now: string; t: Translator; locale: Locale }) {
    const days = daysBetween(alert.detectedAt, now);
    return (
        <li className="relative flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span>{regionText(t, alert.bodyRegion)}</span>
                    {sameRegion && (
                        <Badge tone="ai" size="sm">
                            {t("doctorPages.alert.sameRegion")}
                        </Badge>
                    )}
                    <span>
                        · <time dateTime={alert.detectedAt}>{formatDate(alert.detectedAt, locale)}</time> ({capitalize(describeDaysUntil(-days, locale))})
                    </span>
                </p>
                <p className="mt-0.5 text-sm font-medium text-fg">
                    <Link href={routes.doctor.aiAlert(alert.id)} className="after:absolute after:inset-0 after:content-[''] hover:underline">
                        {alert.pattern}
                    </Link>
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {alert.confidence !== null && <span className="text-[13px] text-fg-muted tabular-nums">{t("doctorPages.alert.confidenceShort", { value: formatConfidence(alert.confidence) })}</span>}
                <AlertStatusBadge status={alert.status} size="sm" />
                <ArrowRight aria-hidden className="hidden size-4 text-fg-subtle sm:block" />
            </div>
        </li>
    );
}
