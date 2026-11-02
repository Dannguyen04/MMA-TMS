import { ChartLine, Gauge, Info, Layers, ListOrdered, MessageSquareText, Play, Sparkles, Target, Timer, Upload } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { AIFindingCard } from "@/components/domain/ai-finding-card";
import { AINotice } from "@/components/domain/ai-notice";
import { CoachFeedbackItem } from "@/components/domain/coach-feedback-item";
import { formatMeasure } from "@/components/domain/domain-format";
import { GoalCard } from "@/components/domain/goal-card";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { TechniqueChip } from "@/components/domain/technique-chip";
import { GoalTrend } from "@/components/performance/goal-trend";
import { changeDelta, nameInText, ordinal, rankTechniques, scoreDelta } from "@/components/performance/performance-format";
import { ScoreInfo } from "@/components/performance/score-info";
import {
    countNoun,
    detailThroughWeek,
    metricName,
    ScoreTrendCard,
    TECHNIQUE_METRICS,
    TechniqueMetricCard,
    TechniqueSpeedCard,
} from "@/components/performance/technique-charts";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, type StatCardProps } from "@/components/ui/stat-card";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { TabNav } from "@/components/ui/tabs";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { techniqueLabel, TECHNIQUES } from "@/lib/domain/labels";
import type { AIFinding, Technique } from "@/lib/domain/types";
import { formatDate, formatNumber, formatRelative, formatTimestamp } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getAnalysis } from "@/lib/services/ai";
import { listGoals } from "@/lib/services/goals";
import { listCoaches } from "@/lib/services/people";
import {
    getPerformanceSummary,
    getTechniqueDetail,
    TECHNIQUE_WEIGHTS,
    type PerformanceSummary,
    type TechniqueDetail,
    type TechniqueFindingRef,
} from "@/lib/services/performance";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { listCoachFeedback } from "@/lib/services/training";

const COACH_TIPS_LIMIT = 5;
const MOMENT_LINKS_LIMIT = 3;

export async function generateMetadata({ params }: PageProps<"/fighter/performance/[technique]">): Promise<Metadata> {
    const [technique, { t }] = await Promise.all([params.then((value) => parseEnum(value.technique, TECHNIQUES)), getTranslator()]);
    return {
        title: technique
            ? t("screens.performance.techniqueDetail.metaTitle", { technique: techniqueLabel(t, technique) })
            : t("screens.performance.title"),
    };
}

/** The reporting week's reading and the one before it (either may be missing). */
function latestPair(values: (number | null)[]): { value: number | null; previous: number | null } {
    return { value: values[values.length - 1] ?? null, previous: values.length > 1 ? (values[values.length - 2] ?? null) : null };
}

/** Week of the most recent non-zero count before a run of zero weeks at the end, if the latest week is zero. */
function lastActiveWeek(counts: TechniqueDetail["relatedCounts"]): string | null {
    if (!counts || counts.length === 0 || counts[counts.length - 1].value > 0) return null;
    const active = counts.findLast((point) => point.value > 0);
    return active ? active.weekStart : null;
}

export default async function TechniqueDetailPage({ params }: PageProps<"/fighter/performance/[technique]">) {
    const user = await requireRole("fighter");
    const technique = parseEnum((await params).technique, TECHNIQUES);
    if (!technique || !user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const { t, locale } = await getTranslator();
    const label = techniqueLabel(t, technique);
    const labelInText = nameInText(label, locale);
    const back = { href: routes.fighter.performance, label: t("screens.performance.title") };
    if (!platformFeatureAvailable("performance")) {
        return (
            <>
                <PageHeader back={back} eyebrow={t("screens.performance.technique")} title={label} />
                <FeatureUnavailable service="training" title={t("screens.performance.unavailable")} description={t("screens.performance.unavailableDesc")} />
            </>
        );
    }
    const now = new Date().toISOString();

    const [rawDetail, summary, goals, feedback, coaches] = await Promise.all([
        getTechniqueDetail(fighter.id, technique),
        getPerformanceSummary(fighter.id),
        listGoals({ fighterIds: [fighter.id], technique }),
        listCoachFeedback({ fighterIds: [fighter.id] }),
        listCoaches(),
    ]);

    const header = (
        <>
            <PageHeader
                back={back}
                eyebrow={t("screens.performance.technique")}
                title={label}
                description={t("screens.performance.techniqueDetail.desc", { technique: labelInText })}
                meta={
                    <>
                        <TechniqueChip technique={technique} />
                        <span className="flex items-center gap-1">
                            <AIGeneratedBadge size="sm" label={t("screens.performance.aiScores")} />
                            <ScoreInfo />
                        </span>
                    </>
                }
            />
            <TabNav
                label={t("screens.performance.techniques")}
                className="mb-6"
                items={TECHNIQUES.map((item) => ({ href: routes.fighter.technique(item), label: techniqueLabel(t, item), exact: true }))}
            />
        </>
    );

    if (!rawDetail || !summary) {
        return (
            <>
                {header}
                <EmptyState
                    icon={<ChartLine />}
                    title={t("screens.performance.techniqueDetail.emptyTitle", { technique: labelInText })}
                    description={t("screens.performance.overview.emptyFighter")}
                    action={
                        <ButtonLink href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            {t("screens.performance.uploadVideo")}
                        </ButtonLink>
                    }
                />
            </>
        );
    }

    const detail = detailThroughWeek(rawDetail, summary.latest.weekStart);
    const findings = await resolveFindings(detail.findings);
    const coachNames = new Map(coaches.map((coach) => [coach.id, coach.name]));
    const tips = feedback.filter((item) => item.techniques.includes(technique)).slice(0, COACH_TIPS_LIMIT);
    const activeGoals = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const tiles = kpiTiles(technique, detail, summary, findings.length, activeGoals.length, t, locale);
    const chartCount = (detail.relatedCounts || detail.rateSeries ? 1 : 0) + (detail.speedSeries ? 1 : 0);
    const pausedSince = lastActiveWeek(detail.relatedCounts);
    const noun = nameInText(countNoun(t, technique), locale);

    return (
        <>
            {header}
            <div className="flex flex-col gap-6">
                {summary.comparisonWeeks === 0 && (
                    <Callout tone="info" icon={Info} title={t("screens.performance.overview.earlyDays")}>
                        {t("screens.performance.techniqueDetail.early", { weeks: plural(t, "screens.performance.completeWeeks", detail.history.length) })}
                    </Callout>
                )}
                {pausedSince && (
                    <Callout tone="info" icon={Info} title={t("screens.performance.techniqueDetail.pausedTitle", { noun })}>
                        {t("screens.performance.techniqueDetail.pausedBody", { date: formatDate(pausedSince, locale), noun })}
                    </Callout>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {tiles.map((tile) => (
                        <StatCard key={tile.label} {...tile} />
                    ))}
                </div>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <ScoreTrendCard technique={technique} detail={detail} goals={goals} locale={locale} />
                        {chartCount > 0 && (
                            <div className={chartCount === 2 ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-2" : "grid grid-cols-1 gap-6"}>
                                <TechniqueMetricCard technique={technique} detail={detail} goals={goals} locale={locale} />
                                <TechniqueSpeedCard technique={technique} detail={detail} locale={locale} />
                            </div>
                        )}

                        <section aria-labelledby="findings-heading" className="flex flex-col gap-3">
                            <div>
                                <h2 id="findings-heading" className="text-base font-semibold text-fg">
                                    {t("screens.performance.techniqueDetail.findings")}
                                </h2>
                                <p className="text-[13px] text-fg-muted">{t("screens.performance.techniqueDetail.findingsDesc", { technique: labelInText })}</p>
                            </div>
                            <AINotice audience="fighter" compact locale={locale} />
                            {findings.length === 0 ? (
                                <Card>
                                    <EmptyState
                                        compact
                                        icon={<Sparkles />}
                                        title={t("screens.performance.techniqueDetail.findingsEmpty", { technique: labelInText })}
                                        description={t("screens.performance.techniqueDetail.findingsEmptyDesc")}
                                    />
                                </Card>
                            ) : (
                                <ul className="flex flex-col gap-4">
                                    {findings.map(({ ref, finding }) => (
                                        <li key={`${ref.analysisId}-${ref.id}`}>
                                            <AIFindingCard
                                                finding={finding}
                                                now={now}
                                                locale={locale}
                                                actions={
                                                    <FindingVideoLinks
                                                        finding={finding}
                                                        videoId={ref.videoId}
                                                        processedAt={ref.processedAt}
                                                        now={now}
                                                        t={t}
                                                        locale={locale}
                                                    />
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader
                                title={t("screens.performance.techniqueDetail.relatedGoals")}
                                icon={<Target aria-hidden />}
                                description={goals.length > 0 ? plural(t, "screens.performance.goalsInProgress", activeGoals.length) : undefined}
                                action={<CardLink href={routes.fighter.goals}>{t("screens.performance.techniqueDetail.allGoals")}</CardLink>}
                            />
                            <CardContent>
                                {goals.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={<Target />}
                                        title={t("screens.performance.techniqueDetail.goalsEmpty", { technique: labelInText })}
                                        description={t("screens.performance.techniqueDetail.goalsEmptyDesc", { technique: labelInText })}
                                    />
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {goals.map((goal) => (
                                            <li key={goal.id}>
                                                <GoalCard goal={goal} now={now} headingLevel={3} locale={locale}>
                                                    <GoalTrend goal={goal} now={now} locale={locale} />
                                                </GoalCard>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader
                                title={t("screens.performance.techniqueDetail.tips")}
                                icon={<MessageSquareText aria-hidden />}
                                description={t("screens.performance.techniqueDetail.tipsDesc", { technique: label })}
                            />
                            <CardContent>
                                {tips.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={<MessageSquareText />}
                                        title={t("screens.performance.techniqueDetail.tipsEmpty")}
                                        description={t("screens.performance.techniqueDetail.tipsEmptyDesc", { technique: label })}
                                    />
                                ) : (
                                    <ul className="flex flex-col divide-y divide-border">
                                        {tips.map((item) => (
                                            <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                                <CoachFeedbackItem
                                                    feedback={item}
                                                    coachName={coachNames.get(item.coachId) ?? t("screens.performance.techniqueDetail.coachFallback")}
                                                    now={now}
                                                    sessionHref={item.sessionId ? routes.fighter.session(item.sessionId) : undefined}
                                                    videoHref={item.videoId ? routes.fighter.video(item.videoId) : undefined}
                                                    locale={locale}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}

/** Loads the full finding for each reference so the card can show evidence, confidence and review. */
async function resolveFindings(refs: TechniqueFindingRef[]): Promise<{ ref: TechniqueFindingRef; finding: AIFinding }[]> {
    const analysisIds = [...new Set(refs.map((ref) => ref.analysisId))];
    const analyses = await Promise.all(analysisIds.map((id) => getAnalysis(id)));
    const byId = new Map(analyses.flatMap((analysis) => (analysis ? [[analysis.id, analysis] as const] : [])));
    return refs.flatMap((ref) => {
        const finding = byId.get(ref.analysisId)?.findings.find((item) => item.id === ref.id);
        return finding ? [{ ref, finding }] : [];
    });
}

function FindingVideoLinks({
    finding,
    videoId,
    processedAt,
    now,
    t,
    locale,
}: {
    finding: AIFinding;
    videoId: string;
    processedAt: string;
    now: string;
    t: Translator;
    locale: Locale;
}) {
    const moments = finding.timestampsMs.slice(0, MOMENT_LINKS_LIMIT);
    return (
        <>
            {moments.length === 0 ? (
                <ButtonLink href={routes.fighter.video(videoId)} variant="secondary" size="sm">
                    <Play aria-hidden />
                    {t("screens.performance.techniqueDetail.openVideo")}
                </ButtonLink>
            ) : (
                moments.map((ms, index) => (
                    <ButtonLink key={`${ms}-${index}`} href={`${routes.fighter.video(videoId)}?t=${ms}`} variant={index === 0 ? "secondary" : "ghost"} size="sm">
                        <Play aria-hidden />
                        {index === 0 ? t("screens.performance.techniqueDetail.watchAt", { time: formatTimestamp(ms) }) : formatTimestamp(ms)}
                    </ButtonLink>
                ))
            )}
            <span className="ml-auto text-xs text-fg-subtle">
                {t("screens.performance.techniqueDetail.analysed")}
                <time dateTime={processedAt}>{formatRelative(processedAt, now, locale)}</time>
            </span>
        </>
    );
}

/** Up to four headline tiles, choosing the metrics this technique actually has. */
function kpiTiles(
    technique: Technique,
    detail: TechniqueDetail,
    summary: PerformanceSummary,
    findingsCount: number,
    activeGoalsCount: number,
    t: Translator,
    locale: Locale,
): StatCardProps[] {
    const rank = rankTechniques(summary.latest.scores).indexOf(technique) + 1;
    const weekBefore = t("screens.performance.compare.weekBefore");
    const tiles: StatCardProps[] = [
        {
            label: metricName(t, "score"),
            value: formatNumber(detail.latestScore),
            unit: "/ 100",
            icon: <Gauge aria-hidden />,
            delta: scoreDelta(detail.change4w, summary.comparisonWeeks, locale),
            hint: summary.comparisonWeeks === 0 ? t("screens.performance.noEarlierWeek") : undefined,
        },
        {
            label: t("screens.performance.techniqueDetail.rank"),
            value: ordinal(rank, locale),
            unit: t("screens.performance.ofN", { n: TECHNIQUES.length }),
            icon: <ListOrdered aria-hidden />,
            hint:
                technique === summary.strongest
                    ? t("screens.performance.techniqueDetail.yourStrongest")
                    : technique === summary.weakest
                      ? t("screens.performance.techniqueDetail.yourFocus")
                      : t("screens.performance.techniqueDetail.weightShare", { pct: Math.round(TECHNIQUE_WEIGHTS[technique] * 100) }),
        },
    ];

    const counts = detail.relatedCounts;
    if (counts && counts.length > 0) {
        const latest = counts[counts.length - 1].value;
        const previous = counts.length > 1 ? counts[counts.length - 2].value : null;
        tiles.push({
            label: technique === "combination" ? t("screens.performance.techniqueDetail.combinationsLastWeek") : t("screens.performance.techniqueDetail.detectedLastWeek"),
            value: formatNumber(latest),
            icon: <Layers aria-hidden />,
            delta: previous === null ? undefined : { ...changeDelta(latest - previous, { label: weekBefore }), sentiment: "neutral" },
        });
    }

    if (detail.rateSeries) {
        const metric = TECHNIQUE_METRICS[detail.rateSeries.metric];
        const rate = latestPair(detail.rateSeries.points.map((point) => point.value));
        tiles.push({
            label: metricName(t, detail.rateSeries.metric),
            value: rate.value === null ? "—" : formatMeasure(rate.value, metric.unit),
            icon: <Timer aria-hidden />,
            delta: rate.value !== null && rate.previous !== null ? changeDelta(rate.value - rate.previous, { decimals: 1, label: weekBefore }) : undefined,
            hint: rate.value === null ? t("screens.performance.techniqueDetail.noSessionsLastWeek") : undefined,
        });
    }

    if (detail.speedSeries) {
        const isKick = detail.speedSeries.kind === "kick";
        const speed = latestPair(detail.speedSeries.points.map((point) => point.value));
        tiles.push({
            label: isKick ? t("screens.performance.techniqueDetail.avgKickSpeed") : t("screens.performance.techniqueDetail.avgPunchSpeed"),
            value: speed.value === null ? "—" : formatNumber(speed.value, 1),
            unit: speed.value === null ? undefined : "m/s",
            icon: <Timer aria-hidden />,
            delta: speed.value !== null && speed.previous !== null ? changeDelta(speed.value - speed.previous, { decimals: 1, label: weekBefore }) : undefined,
            hint: speed.value === null ? (isKick ? t("screens.performance.techniqueDetail.noKicks") : t("screens.performance.techniqueDetail.noPunches")) : undefined,
        });
    }

    tiles.push(
        {
            label: t("screens.performance.techniqueDetail.findings"),
            value: formatNumber(findingsCount),
            icon: <Sparkles aria-hidden />,
            hint: t("screens.performance.techniqueDetail.fromVideos"),
        },
        {
            label: t("screens.performance.techniqueDetail.goalsInProgress"),
            value: formatNumber(activeGoalsCount),
            icon: <Target aria-hidden />,
            hint: t("screens.performance.techniqueDetail.setByCoaches"),
        },
    );
    return tiles.slice(0, 4).map((tile) => ({ ...tile, locale }));
}
