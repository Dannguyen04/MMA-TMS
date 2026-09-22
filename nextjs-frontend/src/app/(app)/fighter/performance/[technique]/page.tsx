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
import { changeDelta, ordinal, rankTechniques, scoreDelta } from "@/components/performance/performance-format";
import { ScoreInfo } from "@/components/performance/score-info";
import {
    detailThroughWeek,
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
import { EmptyState } from "@/components/ui/states";
import { TabNav } from "@/components/ui/tabs";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { AIFinding, Technique } from "@/lib/domain/types";
import { formatDate, formatNumber, formatRelative, formatTimestamp, pluralize } from "@/lib/format";
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
import { listCoachFeedback } from "@/lib/services/training";

const COACH_TIPS_LIMIT = 5;
const MOMENT_LINKS_LIMIT = 3;

export async function generateMetadata({ params }: PageProps<"/fighter/performance/[technique]">): Promise<Metadata> {
    const technique = parseEnum((await params).technique, TECHNIQUES);
    return { title: technique ? `${TECHNIQUE_LABELS[technique]} · Performance` : "Performance" };
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
    const label = TECHNIQUE_LABELS[technique];
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
                back={{ href: routes.fighter.performance, label: "Performance" }}
                eyebrow="Technique"
                title={label}
                description={`How your ${label.toLowerCase()} is scored, how it's trending and what the AI and your coaches noticed.`}
                meta={
                    <>
                        <TechniqueChip technique={technique} />
                        <span className="flex items-center gap-1">
                            <AIGeneratedBadge size="sm" label="AI-assisted scores" />
                            <ScoreInfo />
                        </span>
                    </>
                }
            />
            <TabNav
                label="Techniques"
                className="mb-6"
                items={TECHNIQUES.map((t) => ({ href: routes.fighter.technique(t), label: TECHNIQUE_LABELS[t], exact: true }))}
            />
        </>
    );

    if (!rawDetail || !summary) {
        return (
            <>
                {header}
                <EmptyState
                    icon={<ChartLine />}
                    title={`No ${label.toLowerCase()} data yet`}
                    description="Scores appear after your first analysed training videos and coach-rated sessions."
                    action={
                        <ButtonLink href={routes.fighter.uploadVideo}>
                            <Upload aria-hidden />
                            Upload a training video
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
    const tiles = kpiTiles(technique, detail, summary, findings.length, activeGoals.length);
    const chartCount = (detail.relatedCounts || detail.rateSeries ? 1 : 0) + (detail.speedSeries ? 1 : 0);
    const pausedSince = lastActiveWeek(detail.relatedCounts);
    const noun = technique === "combination" ? "combinations" : `${label.toLowerCase()}${technique === "cross" ? "es" : "s"}`;

    return (
        <>
            {header}
            <div className="flex flex-col gap-6">
                {summary.comparisonWeeks === 0 && (
                    <Callout tone="info" icon={Info} title="Early days">
                        You have {pluralize(detail.history.length, "complete week")} of data so far. The 4-week change and trend charts fill in as more
                        weeks are completed.
                    </Callout>
                )}
                {pausedSince && (
                    <Callout tone="info" icon={Info} title={`No ${noun} detected recently`}>
                        Your analysed footage after the week of {formatDate(pausedSince)} shows no {noun}, so this score is carried over from that
                        week. It updates once {noun} are back in your training videos.
                    </Callout>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {tiles.map((tile) => (
                        <StatCard key={tile.label} {...tile} />
                    ))}
                </div>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <ScoreTrendCard technique={technique} detail={detail} goals={goals} />
                        {chartCount > 0 && (
                            <div className={chartCount === 2 ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-2" : "grid grid-cols-1 gap-6"}>
                                <TechniqueMetricCard technique={technique} detail={detail} goals={goals} />
                                <TechniqueSpeedCard technique={technique} detail={detail} />
                            </div>
                        )}

                        <section aria-labelledby="findings-heading" className="flex flex-col gap-3">
                            <div>
                                <h2 id="findings-heading" className="text-base font-semibold text-fg">
                                    Recent AI findings
                                </h2>
                                <p className="text-[13px] text-fg-muted">Observations about your {label.toLowerCase()} from analysed videos, newest first.</p>
                            </div>
                            <AINotice audience="fighter" compact />
                            {findings.length === 0 ? (
                                <Card>
                                    <EmptyState
                                        compact
                                        icon={<Sparkles />}
                                        title={`No AI findings about your ${label.toLowerCase()} yet`}
                                        description="Findings appear when a training video shows something worth your attention."
                                    />
                                </Card>
                            ) : (
                                <ul className="flex flex-col gap-4">
                                    {findings.map(({ ref, finding }) => (
                                        <li key={`${ref.analysisId}-${ref.id}`}>
                                            <AIFindingCard
                                                finding={finding}
                                                now={now}
                                                actions={<FindingVideoLinks finding={finding} videoId={ref.videoId} processedAt={ref.processedAt} now={now} />}
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
                                title="Related goals"
                                icon={<Target aria-hidden />}
                                description={goals.length > 0 ? `${pluralize(activeGoals.length, "goal")} in progress` : undefined}
                                action={<CardLink href={routes.fighter.goals}>All goals</CardLink>}
                            />
                            <CardContent>
                                {goals.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={<Target />}
                                        title={`No ${label.toLowerCase()} goals`}
                                        description={`Your coaches set goals. Ask them if you'd like a target for your ${label.toLowerCase()}.`}
                                    />
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {goals.map((goal) => (
                                            <li key={goal.id}>
                                                <GoalCard goal={goal} now={now} headingLevel={3}>
                                                    <GoalTrend goal={goal} now={now} />
                                                </GoalCard>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Coach tips" icon={<MessageSquareText aria-hidden />} description={`Feedback tagged ${label}`} />
                            <CardContent>
                                {tips.length === 0 ? (
                                    <EmptyState
                                        compact
                                        icon={<MessageSquareText />}
                                        title="No tips yet"
                                        description={`When your coaches tag feedback with ${label}, it shows up here.`}
                                    />
                                ) : (
                                    <ul className="flex flex-col divide-y divide-border">
                                        {tips.map((item) => (
                                            <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                                                <CoachFeedbackItem
                                                    feedback={item}
                                                    coachName={coachNames.get(item.coachId) ?? "Coach"}
                                                    now={now}
                                                    sessionHref={item.sessionId ? routes.fighter.session(item.sessionId) : undefined}
                                                    videoHref={item.videoId ? routes.fighter.video(item.videoId) : undefined}
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

function FindingVideoLinks({ finding, videoId, processedAt, now }: { finding: AIFinding; videoId: string; processedAt: string; now: string }) {
    const moments = finding.timestampsMs.slice(0, MOMENT_LINKS_LIMIT);
    return (
        <>
            {moments.length === 0 ? (
                <ButtonLink href={routes.fighter.video(videoId)} variant="secondary" size="sm">
                    <Play aria-hidden />
                    Open video
                </ButtonLink>
            ) : (
                moments.map((ms, index) => (
                    <ButtonLink key={`${ms}-${index}`} href={`${routes.fighter.video(videoId)}?t=${ms}`} variant={index === 0 ? "secondary" : "ghost"} size="sm">
                        <Play aria-hidden />
                        {index === 0 ? `Watch at ${formatTimestamp(ms)}` : formatTimestamp(ms)}
                    </ButtonLink>
                ))
            )}
            <span className="ml-auto text-xs text-fg-subtle">
                Analysed <time dateTime={processedAt}>{formatRelative(processedAt, now)}</time>
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
): StatCardProps[] {
    const rank = rankTechniques(summary.latest.scores).indexOf(technique) + 1;
    const tiles: StatCardProps[] = [
        {
            label: "Score",
            value: formatNumber(detail.latestScore),
            unit: "/ 100",
            icon: <Gauge aria-hidden />,
            delta: scoreDelta(detail.change4w, summary.comparisonWeeks),
            hint: summary.comparisonWeeks === 0 ? "No earlier week to compare yet" : undefined,
        },
        {
            label: "Rank among techniques",
            value: ordinal(rank),
            unit: `of ${TECHNIQUES.length}`,
            icon: <ListOrdered aria-hidden />,
            hint:
                technique === summary.strongest
                    ? "Your strongest technique"
                    : technique === summary.weakest
                      ? "Your focus area"
                      : `${Math.round(TECHNIQUE_WEIGHTS[technique] * 100)}% of your overall score`,
        },
    ];

    const counts = detail.relatedCounts;
    if (counts && counts.length > 0) {
        const latest = counts[counts.length - 1].value;
        const previous = counts.length > 1 ? counts[counts.length - 2].value : null;
        tiles.push({
            label: technique === "combination" ? "Combinations last week" : "Detected last week",
            value: formatNumber(latest),
            icon: <Layers aria-hidden />,
            delta: previous === null ? undefined : { ...changeDelta(latest - previous, { label: "vs week before" }), sentiment: "neutral" },
        });
    }

    if (detail.rateSeries) {
        const metric = TECHNIQUE_METRICS[detail.rateSeries.metric];
        const rate = latestPair(detail.rateSeries.points.map((point) => point.value));
        tiles.push({
            label: metric.label,
            value: rate.value === null ? "—" : formatMeasure(rate.value, metric.unit),
            icon: <Timer aria-hidden />,
            delta:
                rate.value !== null && rate.previous !== null
                    ? changeDelta(rate.value - rate.previous, { decimals: 1, label: "vs week before" })
                    : undefined,
            hint: rate.value === null ? "No sessions measured last week" : undefined,
        });
    }

    if (detail.speedSeries) {
        const isKick = detail.speedSeries.kind === "kick";
        const speed = latestPair(detail.speedSeries.points.map((point) => point.value));
        tiles.push({
            label: isKick ? "Avg kick speed" : "Avg punch speed",
            value: speed.value === null ? "—" : formatNumber(speed.value, 1),
            unit: speed.value === null ? undefined : "m/s",
            icon: <Timer aria-hidden />,
            delta:
                speed.value !== null && speed.previous !== null
                    ? changeDelta(speed.value - speed.previous, { decimals: 1, label: "vs week before" })
                    : undefined,
            hint: speed.value === null ? `No ${isKick ? "kicks" : "punches"} detected last week` : undefined,
        });
    }

    tiles.push(
        { label: "Recent AI findings", value: formatNumber(findingsCount), icon: <Sparkles aria-hidden />, hint: "From analysed videos" },
        { label: "Goals in progress", value: formatNumber(activeGoalsCount), icon: <Target aria-hidden />, hint: "Set by your coaches" },
    );
    return tiles.slice(0, 4);
}
