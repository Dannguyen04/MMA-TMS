import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { authenticatedApiRequest } from "@/lib/api/client";
import { STRIKE_TYPES, TECHNIQUES } from "@/lib/domain/labels";
import type { AIFeedback, FindingImpact, ISODate, PerformanceMetric, StrikeType, Technique } from "@/lib/domain/types";
import type { MockDatabase } from "@/lib/mocks/db";
import { average, groupBy, round, sum } from "@/lib/utils";

/**
 * Weekly performance: history, summaries, technique drill-downs and team views.
 *
 * Comparison rule used everywhere: the most recent COMPLETE week (normally last week) is
 * compared with the average of the up to 4 complete weeks before it. The running week is
 * excluded because its volume and footage are partial, and a 4-week average smooths the
 * week-to-week noise of AI-derived scores so a delta reflects a real change.
 */

/** Relative weight of each dimension in the overall performance score. Sums to 1. */
export const TECHNIQUE_WEIGHTS: Record<Technique, number> = {
    jab: 0.14,
    cross: 0.14,
    hook: 0.12,
    kick: 0.12,
    combination: 0.14,
    footwork: 0.12,
    guard: 0.12,
    head_movement: 0.1,
};

export type PerformanceTrend = "improving" | "steady" | "declining";

export interface PerformanceSummary {
    /** Most recent complete week (the running week only when it is the fighter's first). */
    latest: PerformanceMetric;
    /** The week before `latest`, for week-over-week volume comparisons. */
    previous: PerformanceMetric | null;
    /** Weighted overall score of `latest`, 0–100. */
    overall: number;
    /** `overall` minus the overall score of the comparison average. */
    overallDelta: number;
    /** Per-technique score of `latest` minus the comparison average. */
    deltas: Record<Technique, number>;
    /** Weeks in the comparison average (0 when there is no earlier history and deltas are 0). */
    comparisonWeeks: number;
    /** Highest-scoring technique that was actually assessed in `latest`. */
    strongest: Technique;
    /** Lowest-scoring technique that was actually assessed in `latest`. */
    weakest: Technique;
    trend: PerformanceTrend;
}

export interface WeeklyValue {
    weekStart: ISODate;
    value: number;
}

/** Weekly measurement that may be missing (no strikes/sessions that week). */
export interface WeeklyReading {
    weekStart: ISODate;
    value: number | null;
}

export interface TechniqueFindingRef {
    id: string;
    analysisId: string;
    videoId: string;
    title: string;
    impact: FindingImpact;
    confidence: number;
    review: AIFeedback | null;
    processedAt: ISODate;
}

export interface TechniqueDetail {
    technique: Technique;
    history: { weekStart: ISODate; score: number }[];
    /** Score in the most recent complete week. */
    latestScore: number;
    /** `latestScore` minus the average of the up to 4 complete weeks before it. */
    change4w: number;
    /** Weekly detections: strike counts for strikes, combinations for "combination"; null otherwise. */
    relatedCounts: WeeklyValue[] | null;
    /** Hand speed for punches, foot speed for kicks (m/s); null for other techniques. */
    speedSeries: { kind: "punch" | "kick"; points: WeeklyReading[] } | null;
    /** Guard uptime (%) for "guard", head movements per minute for "head_movement"; null otherwise. */
    rateSeries: { metric: "guardUptimePct" | "headMovementsPerMin"; points: WeeklyReading[] } | null;
    /** Most recent AI findings in this category, newest first. */
    findings: TechniqueFindingRef[];
}

export interface TeamPerformanceRow {
    fighterId: string;
    overall: number;
    overallDelta: number;
    /** Scores of the most recent complete week. */
    scores: Record<Technique, number>;
    /** Minutes in the most recent complete week. */
    trainingMinutes: number;
    sessionsCompleted: number;
    trend: PerformanceTrend;
}

export interface WeeklyVolumeTotals {
    weekStart: ISODate;
    /** False for the running week, whose totals are still accumulating. */
    complete: boolean;
    /** Fighters with a snapshot that week. */
    fighters: number;
    sessionsCompleted: number;
    trainingMinutes: number;
    /** All strikes detected in analysed footage. */
    strikes: number;
    combinations: number;
    /** Session-weighted average RPE; 0 when nobody trained. */
    avgRpe: number;
}

const COMPARISON_WEEKS = 4;
/** Overall-score change (points) needed before a fighter is called improving or declining. */
const TREND_THRESHOLD = 1;
/** A strike counts as assessed when it has at least this many detections and share of strikes. */
const MIN_STRIKE_DETECTIONS = 20;
const MIN_STRIKE_SHARE = 0.05;
const RECENT_FINDINGS_LIMIT = 6;
const WEEK_MS = 7 * 86_400_000;

const techniqueSchema = z.enum(["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"]);
const techniqueScoresSchema = z.object({
    jab: z.number(),
    cross: z.number(),
    hook: z.number(),
    kick: z.number(),
    combination: z.number(),
    footwork: z.number(),
    guard: z.number(),
    head_movement: z.number(),
});
const strikeCountsSchema = z.object({ jab: z.number(), cross: z.number(), hook: z.number(), kick: z.number() });
const performanceMetricSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    weekStart: z.string(),
    scores: techniqueScoresSchema,
    strikeCounts: strikeCountsSchema,
    combinations: z.number(),
    sessionsCompleted: z.number(),
    trainingMinutes: z.number(),
    avgRpe: z.number(),
    avgPunchSpeed: z.number(),
    avgKickSpeed: z.number(),
    guardUptimePct: z.number(),
    headMovementsPerMin: z.number(),
});
const feedbackSchema = z.object({
    decision: z.enum(["confirmed", "corrected", "rejected"]),
    reviewerId: z.string(),
    reviewerName: z.string(),
    reviewedAt: z.string(),
    note: z.string().nullable(),
    correctedLabel: z.string().nullable(),
});
const findingRefSchema = z.object({
    id: z.string(),
    analysisId: z.string(),
    videoId: z.string(),
    title: z.string(),
    impact: z.enum(["strength", "improvement", "concern"]),
    confidence: z.number(),
    review: feedbackSchema.nullable(),
    processedAt: z.string(),
});
const weeklyValueSchema = z.object({ weekStart: z.string(), value: z.number() });
const weeklyReadingSchema = z.object({ weekStart: z.string(), value: z.number().nullable() });
const performanceSummarySchema = z.object({
    latest: performanceMetricSchema,
    previous: performanceMetricSchema.nullable(),
    overall: z.number(),
    overallDelta: z.number(),
    deltas: techniqueScoresSchema,
    comparisonWeeks: z.number().int().nonnegative(),
    strongest: techniqueSchema,
    weakest: techniqueSchema,
    trend: z.enum(["improving", "steady", "declining"]),
});
const techniqueDetailSchema = z.object({
    technique: techniqueSchema,
    history: z.array(z.object({ weekStart: z.string(), score: z.number() })),
    latestScore: z.number(),
    change4w: z.number(),
    relatedCounts: z.array(weeklyValueSchema).nullable(),
    speedSeries: z
        .object({ kind: z.enum(["punch", "kick"]), points: z.array(weeklyReadingSchema) })
        .nullable(),
    rateSeries: z
        .object({ metric: z.enum(["guardUptimePct", "headMovementsPerMin"]), points: z.array(weeklyReadingSchema) })
        .nullable(),
    findings: z.array(findingRefSchema),
});
const teamPerformanceRowSchema = z.object({
    fighterId: z.string(),
    overall: z.number(),
    overallDelta: z.number(),
    scores: techniqueScoresSchema,
    trainingMinutes: z.number(),
    sessionsCompleted: z.number(),
    trend: z.enum(["improving", "steady", "declining"]),
});
const weeklyVolumeSchema = z.object({
    weekStart: z.string(),
    complete: z.boolean(),
    fighters: z.number().int().nonnegative(),
    sessionsCompleted: z.number().int().nonnegative(),
    trainingMinutes: z.number().nonnegative(),
    strikes: z.number().int().nonnegative(),
    combinations: z.number().int().nonnegative(),
    avgRpe: z.number(),
});

type PerformanceStore = Pick<MockDatabase, "performanceMetrics" | "aiAnalyses">;

/** The demo store after the simulated latency. Loaded lazily so API mode never evaluates it. */
async function demoStore(): Promise<PerformanceStore> {
    const { db, simulateLatency } = await import("@/lib/mocks/db");
    await simulateLatency();
    return db();
}

/** Weekly snapshots for a fighter, oldest first, limited to the most recent `weeks`. */
export async function getPerformanceHistory(fighterId: string, weeks = 12): Promise<PerformanceMetric[]> {
    if (!isDemoAuthEnabled()) {
        return authenticatedApiRequest(
            `/performance/fighters/${encodeURIComponent(fighterId)}/history?weeks=${encodeURIComponent(weeks)}`,
            z.array(performanceMetricSchema),
        );
    }
    const store = await demoStore();
    return fighterHistory(store, fighterId).slice(-weeks);
}

/** Weighted mean of technique scores using {@link TECHNIQUE_WEIGHTS}, rounded to one decimal. */
export function overallScore(scores: Record<Technique, number>): number {
    return round(sum(TECHNIQUES.map((t) => scores[t] * TECHNIQUE_WEIGHTS[t])), 1);
}

/** Headline performance for a fighter, or null when no snapshots exist. */
export async function getPerformanceSummary(fighterId: string): Promise<PerformanceSummary | null> {
    if (!isDemoAuthEnabled()) {
        return authenticatedApiRequest(
            `/performance/fighters/${encodeURIComponent(fighterId)}/summary`,
            performanceSummarySchema.nullable(),
        );
    }
    const store = await demoStore();
    return summarize(fighterHistory(store, fighterId));
}

/** Weekly score, detections, speed and recent AI findings for one technique; null without history. */
export async function getTechniqueDetail(fighterId: string, technique: Technique): Promise<TechniqueDetail | null> {
    if (!isDemoAuthEnabled()) {
        return authenticatedApiRequest(
            `/performance/fighters/${encodeURIComponent(fighterId)}/techniques/${encodeURIComponent(technique)}`,
            techniqueDetailSchema.nullable(),
        );
    }
    const store = await demoStore();
    const history = fighterHistory(store, fighterId);
    const comparison = comparisonWindow(history);
    if (!comparison) return null;

    const { latest, earlier } = comparison;
    const baseline = earlier.length > 0 ? average(earlier.map((m) => m.scores[technique])) : latest.scores[technique];
    return {
        technique,
        history: history.map((m) => ({ weekStart: m.weekStart, score: m.scores[technique] })),
        latestScore: latest.scores[technique],
        change4w: round(latest.scores[technique] - baseline, 1),
        relatedCounts: relatedCounts(history, technique),
        speedSeries: speedSeries(history, technique),
        rateSeries: rateSeries(history, technique),
        findings: recentFindings(store, fighterId, technique),
    };
}

/** One row per fighter with snapshots, best overall score first. */
export async function getTeamPerformance(fighterIds: string[]): Promise<TeamPerformanceRow[]> {
    if (!isDemoAuthEnabled()) {
        if (fighterIds.length === 0) return [];
        const params = new URLSearchParams();
        fighterIds.forEach((fighterId) => params.append("fighterId", fighterId));
        return authenticatedApiRequest(`/performance/team?${params.toString()}`, z.array(teamPerformanceRowSchema));
    }
    const store = await demoStore();
    const rows: TeamPerformanceRow[] = [];
    for (const fighterId of fighterIds) {
        const summary = summarize(fighterHistory(store, fighterId));
        if (!summary) continue;
        rows.push({
            fighterId,
            overall: summary.overall,
            overallDelta: summary.overallDelta,
            scores: summary.latest.scores,
            trainingMinutes: summary.latest.trainingMinutes,
            sessionsCompleted: summary.latest.sessionsCompleted,
            trend: summary.trend,
        });
    }
    return rows.sort((a, b) => b.overall - a.overall);
}

/** Team totals per week for the most recent `weeks` weeks, oldest first. */
export async function getWeeklyVolume(fighterIds: string[], weeks = 12): Promise<WeeklyVolumeTotals[]> {
    if (!isDemoAuthEnabled()) {
        if (fighterIds.length === 0) return [];
        const params = new URLSearchParams({ weeks: String(weeks) });
        fighterIds.forEach((fighterId) => params.append("fighterId", fighterId));
        return authenticatedApiRequest(`/performance/weekly-volume?${params.toString()}`, z.array(weeklyVolumeSchema));
    }
    const store = await demoStore();
    const selected = new Set(fighterIds);
    const byWeek = groupBy(
        store.performanceMetrics.filter((m) => selected.has(m.fighterId)),
        (m) => m.weekStart,
    );
    const now = Date.now();
    return Object.entries(byWeek)
        .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
        .slice(-weeks)
        .map(([weekStart, metrics]) => {
            const sessions = sum(metrics.map((m) => m.sessionsCompleted));
            return {
                weekStart,
                complete: isCompleteWeek(weekStart, now),
                fighters: metrics.length,
                sessionsCompleted: sessions,
                trainingMinutes: sum(metrics.map((m) => m.trainingMinutes)),
                strikes: sum(metrics.map(totalStrikes)),
                combinations: sum(metrics.map((m) => m.combinations)),
                avgRpe: sessions === 0 ? 0 : round(sum(metrics.map((m) => m.avgRpe * m.sessionsCompleted)) / sessions, 1),
            };
        });
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fighterHistory(store: PerformanceStore, fighterId: string): PerformanceMetric[] {
    return store.performanceMetrics
        .filter((m) => m.fighterId === fighterId)
        .sort((a, b) => Date.parse(a.weekStart) - Date.parse(b.weekStart));
}

function isCompleteWeek(weekStart: ISODate, now: number): boolean {
    return Date.parse(weekStart) + WEEK_MS <= now;
}

/** The week to report on and the complete weeks it is compared with. */
function comparisonWindow(history: PerformanceMetric[]): { latest: PerformanceMetric; index: number; earlier: PerformanceMetric[] } | null {
    if (history.length === 0) return null;
    const now = Date.now();
    const lastComplete = history.findLastIndex((m) => isCompleteWeek(m.weekStart, now));
    const index = lastComplete === -1 ? history.length - 1 : lastComplete;
    return { latest: history[index], index, earlier: history.slice(Math.max(0, index - COMPARISON_WEEKS), index) };
}

function summarize(history: PerformanceMetric[]): PerformanceSummary | null {
    const comparison = comparisonWindow(history);
    if (!comparison) return null;
    const { latest, index, earlier } = comparison;

    const baseline = earlier.length > 0 ? averageScores(earlier) : latest.scores;
    const overall = overallScore(latest.scores);
    const overallDelta = round(overall - overallScore(baseline), 1);
    const ranked = assessedTechniques(latest).sort((a, b) => latest.scores[b] - latest.scores[a]);

    return {
        latest,
        previous: index > 0 ? history[index - 1] : null,
        overall,
        overallDelta,
        deltas: mapTechniques((t) => round(latest.scores[t] - baseline[t], 1)),
        comparisonWeeks: earlier.length,
        strongest: ranked[0],
        weakest: ranked[ranked.length - 1],
        trend: overallDelta >= TREND_THRESHOLD ? "improving" : overallDelta <= -TREND_THRESHOLD ? "declining" : "steady",
    };
}

function averageScores(metrics: PerformanceMetric[]): Record<Technique, number> {
    return mapTechniques((t) => average(metrics.map((m) => m.scores[t])));
}

function mapTechniques(value: (technique: Technique) => number): Record<Technique, number> {
    return {
        jab: value("jab"),
        cross: value("cross"),
        hook: value("hook"),
        kick: value("kick"),
        combination: value("combination"),
        footwork: value("footwork"),
        guard: value("guard"),
        head_movement: value("head_movement"),
    };
}

const STRIKE_TECHNIQUES: readonly Technique[] = STRIKE_TYPES;

function isStrikeType(technique: Technique): technique is StrikeType {
    return STRIKE_TECHNIQUES.includes(technique);
}

function totalStrikes(metric: PerformanceMetric): number {
    return sum(STRIKE_TYPES.map((s) => metric.strikeCounts[s]));
}

/**
 * Techniques with enough footage that week to rank. Strikes barely thrown (a boxer's kicks,
 * restricted strikes during injury) keep a stale score and are left out of strongest/weakest.
 */
function assessedTechniques(metric: PerformanceMetric): Technique[] {
    const strikes = totalStrikes(metric);
    return TECHNIQUES.filter((technique) => {
        if (isStrikeType(technique)) {
            const count = metric.strikeCounts[technique];
            return count >= MIN_STRIKE_DETECTIONS && count / strikes >= MIN_STRIKE_SHARE;
        }
        if (technique === "combination") return metric.combinations > 0;
        return true;
    });
}

function relatedCounts(history: PerformanceMetric[], technique: Technique): WeeklyValue[] | null {
    if (isStrikeType(technique)) return history.map((m) => ({ weekStart: m.weekStart, value: m.strikeCounts[technique] }));
    if (technique === "combination") return history.map((m) => ({ weekStart: m.weekStart, value: m.combinations }));
    return null;
}

/** Speeds are recorded as 0 when nothing was detected; exposed as null so charts show a gap. */
function speedSeries(history: PerformanceMetric[], technique: Technique): TechniqueDetail["speedSeries"] {
    if (!isStrikeType(technique)) return null;
    const kind = technique === "kick" ? "kick" : "punch";
    return {
        kind,
        points: history.map((m) => reading(m.weekStart, kind === "kick" ? m.avgKickSpeed : m.avgPunchSpeed)),
    };
}

function rateSeries(history: PerformanceMetric[], technique: Technique): TechniqueDetail["rateSeries"] {
    if (technique === "guard") {
        return { metric: "guardUptimePct", points: history.map((m) => reading(m.weekStart, m.guardUptimePct)) };
    }
    if (technique === "head_movement") {
        return { metric: "headMovementsPerMin", points: history.map((m) => reading(m.weekStart, m.headMovementsPerMin)) };
    }
    return null;
}

function reading(weekStart: ISODate, value: number): WeeklyReading {
    return { weekStart, value: value > 0 ? value : null };
}

function recentFindings(store: PerformanceStore, fighterId: string, technique: Technique): TechniqueFindingRef[] {
    return store.aiAnalyses
        .filter((analysis) => analysis.fighterId === fighterId)
        .flatMap((analysis) =>
            analysis.findings
                .filter((finding) => finding.category === technique)
                .map<TechniqueFindingRef>((finding) => ({
                    id: finding.id,
                    analysisId: analysis.id,
                    videoId: analysis.videoId,
                    title: finding.title,
                    impact: finding.impact,
                    confidence: finding.confidence,
                    review: finding.review,
                    processedAt: analysis.processedAt,
                })),
        )
        .sort((a, b) => b.processedAt.localeCompare(a.processedAt))
        .slice(0, RECENT_FINDINGS_LIMIT);
}
