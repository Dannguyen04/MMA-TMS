import { ArrowRight, Bandage, CalendarClock, ClipboardPlus, Film, HeartPulse, History, Ruler, Sparkles, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AlertDecisionPanel } from "@/components/clinical/alert-decision-panel";
import { describeMetricComparison, injuryTitle, metricUnit } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { ObservationEvidence } from "@/components/clinical/observation-evidence";
import { CHART_MUTED } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
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
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, CAMERA_ANGLE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { isLowConfidence } from "@/lib/domain/rules";
import type { AbnormalMovementAlert } from "@/lib/domain/types";
import { daysBetween, formatClock, formatConfidence, formatDate, formatDateTime, formatDelta, formatTimestamp } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getAlertDetail, listAlerts } from "@/lib/services/ai";
import { getFighterHealthSummary } from "@/lib/services/medical";

/** The observation with its fighter, footage and linked injury, loaded once per request for the metadata and the page. */
const loadAlertDetail = cache(getAlertDetail);

export async function generateMetadata({ params }: PageProps<"/doctor/ai-alerts/[alertId]">): Promise<Metadata> {
    const [{ alertId }, user] = await Promise.all([params, getCurrentUser()]);
    const detail = await loadAlertDetail(alertId);
    // The title must not reveal an observation the viewer isn't assigned to.
    const visible = detail?.fighter && user && canAccessFighter(user, detail.alert.fighterId);
    return { title: visible && detail.fighter ? `AI movement observation · ${detail.fighter.name}` : "AI movement observation" };
}

const HISTORY_LIMIT = 6;

export default async function AIAlertDetailPage({ params }: PageProps<"/doctor/ai-alerts/[alertId]">) {
    const user = await requireRole("doctor");
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
                back={{ href: routes.doctor.aiAlerts, label: "AI movement observations" }}
                eyebrow={`AI movement observation · ${BODY_REGION_LABELS[alert.bodyRegion]}`}
                title={alert.pattern}
                meta={
                    <>
                        <AIGeneratedBadge label="AI observation" />
                        <ConfidenceBadge confidence={alert.confidence} />
                        <AlertStatusBadge status={alert.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <span className="text-sm text-fg-muted">
                            Detected <time dateTime={alert.detectedAt}>{formatDateTime(alert.detectedAt)}</time>
                        </span>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <AINotice audience="doctor" />

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <section aria-labelledby="evidence-heading" className="flex min-w-0 flex-col gap-4">
                        <h2 id="evidence-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
                            <Sparkles aria-hidden className="size-4 text-ai-fg" />
                            Evidence
                            <span className="text-sm font-normal text-fg-muted">— produced by AI</span>
                        </h2>

                        <Card className="border-ai-border">
                            <CardHeader
                                as="h3"
                                title="AI observation"
                                description="The pattern as described by the movement model"
                                icon={<Sparkles />}
                                action={<AIGeneratedBadge size="sm" />}
                            />
                            <CardContent className="flex flex-col gap-4">
                                <p className="rounded-lg bg-ai-soft/40 px-4 py-3 text-sm leading-relaxed text-pretty text-fg ring-1 ring-inset ring-ai-border/60">
                                    {alert.description}
                                </p>
                                <div>
                                    <p className="mb-1.5 text-[13px] text-fg-muted">AI confidence in this observation</p>
                                    <ConfidenceMeter confidence={alert.confidence} label="AI confidence in this observation" />
                                    {lowConfidence && (
                                        <p className="mt-2 text-[13px] text-warning-fg">
                                            Confidence is below the review threshold. Treat this as a prompt to look, and confirm on better footage or
                                            at examination.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader as="h3" title="Measurement vs baseline" description={alert.metric.label} icon={<Ruler />} />
                            <CardContent className="flex flex-col gap-4">
                                <HorizontalBars
                                    ariaLabel={`${alert.metric.label}: ${describeMetricComparison(alert.metric)}`}
                                    items={[
                                        { label: "This session", value: alert.metric.observed, color: "var(--ai-solid)", hint: "AI measurement" },
                                        {
                                            label: `${fighter.name.split(" ")[0]}'s baseline`,
                                            value: alert.metric.baseline,
                                            color: CHART_MUTED,
                                            hint: "Earlier analysed footage",
                                        },
                                    ]}
                                    valueSuffix={suffix}
                                    decimals={decimals}
                                    max={Math.max(alert.metric.observed, alert.metric.baseline) * 1.1}
                                />
                                <p className="text-[13px] text-fg-muted">
                                    Difference:{" "}
                                    <span className="font-medium text-fg">
                                        {formatDelta(delta, decimals)}
                                        {suffix}
                                    </span>
                                    {deltaPct !== null && unit !== "%" && ` (${formatDelta(deltaPct)}% vs baseline)`}. A difference from baseline
                                    describes movement, not its cause.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                as="h3"
                                title="Source footage"
                                icon={<Film />}
                                description={video ? video.title : "Footage no longer available"}
                            />
                            <CardContent className="flex flex-col gap-5">
                                {video ? (
                                    <DescriptionList
                                        columns={3}
                                        items={[
                                            {
                                                label: "Training type",
                                                value: (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <TrainingTypeIcon type={video.trainingType} className="text-fg-muted" />
                                                        {TRAINING_TYPE_LABELS[video.trainingType]}
                                                    </span>
                                                ),
                                            },
                                            { label: "Recorded", value: <time dateTime={video.uploadedAt}>{formatDate(video.uploadedAt)}</time> },
                                            {
                                                label: "Length · camera",
                                                value: `${formatClock(video.durationSec)} · ${CAMERA_ANGLE_LABELS[video.cameraAngle]}`,
                                            },
                                        ]}
                                    />
                                ) : (
                                    <p className="text-sm text-fg-muted">
                                        The video was deleted after review. The flagged moments are kept for the record.
                                    </p>
                                )}

                                {video && analysis ? (
                                    <ObservationEvidence
                                        analysis={analysis}
                                        stance={fighter.stance}
                                        cameraAngle={video.cameraAngle}
                                        sourceUrl={video.sourceUrl}
                                        title={video.title}
                                        timestampsMs={alert.timestampsMs}
                                    />
                                ) : (
                                    <div>
                                        <h4 className="mb-2 text-[13px] font-semibold text-fg">Flagged moments</h4>
                                        <ol className="flex flex-wrap gap-2">
                                            {alert.timestampsMs.map((ms, index) => (
                                                <li
                                                    key={`${ms}-${index}`}
                                                    className="rounded-md bg-surface-muted px-2.5 py-1 text-[13px] text-fg tabular-nums"
                                                >
                                                    Moment {index + 1} · {formatTimestamp(ms)}
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
                            Clinical decision
                        </h2>

                        <Card>
                            <CardHeader as="h3" title="Fighter health" icon={<HeartPulse />} />
                            <CardContent className="flex flex-col gap-4">
                                <FighterIdentity fighter={fighter} href={routes.doctor.fighter(fighter.id)} />
                                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={summary.clearanceState} />
                                <div>
                                    <h4 className="mb-1.5 text-[13px] font-semibold text-fg">Open injuries</h4>
                                    {summary.activeInjuries.length > 0 ? (
                                        <ul className="flex flex-col gap-1.5">
                                            {summary.activeInjuries.map((injury) => (
                                                <li key={injury.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                                                    <Link href={routes.doctor.injury(injury.id)} className="font-medium text-fg hover:underline">
                                                        {injuryTitle(injury)}
                                                    </Link>
                                                    <InjuryStatusBadge status={injury.status} size="sm" />
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[13px] text-fg-muted">None recorded.</p>
                                    )}
                                </div>
                                {summary.nextFollowUp && (
                                    <p className="flex items-center gap-2 text-[13px] text-fg-muted">
                                        <CalendarClock aria-hidden className="size-3.5" />
                                        Follow-up examination {describeDaysUntil(summary.nextFollowUp.daysUntil)} (
                                        {formatDate(summary.nextFollowUp.date)})
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                as="h3"
                                title="Your decision"
                                description={
                                    alert.doctorReview
                                        ? "Recorded by a doctor — separate from the AI output"
                                        : "How should this observation be handled?"
                                }
                                icon={<Stethoscope />}
                            />
                            <CardContent>
                                <AlertDecisionPanel alertId={alert.id} review={alert.doctorReview} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader as="h3" title="Next steps" icon={<ClipboardPlus />} />
                            <CardContent className="flex flex-col gap-3">
                                {linkedInjury ? (
                                    <div className="flex flex-col gap-1.5 rounded-lg border border-border px-3 py-2.5">
                                        <p className="text-xs text-fg-muted">Linked injury record</p>
                                        <p className="flex flex-wrap items-center gap-2">
                                            <Bandage aria-hidden className="size-4 text-fg-muted" />
                                            <Link
                                                href={routes.doctor.injury(linkedInjury.id)}
                                                className="text-sm font-medium text-fg hover:underline"
                                            >
                                                {injuryTitle(linkedInjury)}
                                            </Link>
                                            <InjuryStatusBadge status={linkedInjury.status} size="sm" />
                                        </p>
                                    </div>
                                ) : (
                                    <ButtonLink
                                        href={clinicalLinks.newInjuryFor({ fighterId: fighter.id, alertId: alert.id })}
                                        variant="secondary"
                                        className="justify-start"
                                    >
                                        <Bandage aria-hidden />
                                        Record injury from this observation
                                    </ButtonLink>
                                )}
                                <ButtonLink href={clinicalLinks.newExaminationFor(fighter.id)} variant="secondary" className="justify-start">
                                    <Stethoscope aria-hidden />
                                    Book examination
                                </ButtonLink>
                            </CardContent>
                        </Card>
                    </section>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={`Earlier observations for ${fighter.name}`}
                        description="Same body region first, then most recent"
                        icon={<History />}
                    />
                    {history.length === 0 ? (
                        <p className="border-t border-border px-5 py-4 text-sm text-fg-muted">
                            No earlier AI movement observations for this fighter.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border border-t border-border">
                            {history.map((other) => (
                                <HistoryRow key={other.id} alert={other} sameRegion={other.bodyRegion === alert.bodyRegion} now={now} />
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </>
    );
}

function HistoryRow({ alert, sameRegion, now }: { alert: AbnormalMovementAlert; sameRegion: boolean; now: string }) {
    const days = daysBetween(alert.detectedAt, now);
    return (
        <li className="relative flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-surface-muted/50 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span>{BODY_REGION_LABELS[alert.bodyRegion]}</span>
                    {sameRegion && (
                        <Badge tone="ai" size="sm">
                            Same region
                        </Badge>
                    )}
                    <span>
                        · <time dateTime={alert.detectedAt}>{formatDate(alert.detectedAt)}</time> ({capitalize(describeDaysUntil(-days))})
                    </span>
                </p>
                <p className="mt-0.5 text-sm font-medium text-fg">
                    <Link href={routes.doctor.aiAlert(alert.id)} className="after:absolute after:inset-0 after:content-[''] hover:underline">
                        {alert.pattern}
                    </Link>
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="text-[13px] text-fg-muted tabular-nums">{formatConfidence(alert.confidence)} confidence</span>
                <AlertStatusBadge status={alert.status} size="sm" />
                <ArrowRight aria-hidden className="hidden size-4 text-fg-subtle sm:block" />
            </div>
        </li>
    );
}
