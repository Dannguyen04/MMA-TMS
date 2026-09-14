import { daysBetween } from "@/lib/format";
import type { PerformanceMetric, StrikeType, Technique } from "@/lib/domain/types";
import { clamp, round } from "@/lib/utils";
import { mockFighters } from "./people";
import { createRandom, type Random } from "./random";
import { fromToday, mondayOffset, weekStart } from "./time";

/**
 * Weekly performance snapshots: one per fighter per week for the last 12 weeks
 * (`weekStart(11)` … `weekStart(0)`). Week 0 is the running week, so its volume only
 * covers the training days that have happened so far.
 *
 * Each fighter has a readable profile (baseline scores, 12-week trend, weekly volume,
 * detections, speeds) plus an optional storyline event from people.ts. Events are
 * anchored in days before today, exactly like the injury dates in the storylines, so the
 * affected weeks follow the calendar. Noise is seeded per record id.
 *
 * Conventions consumers rely on:
 * - A score for a technique that was not assessed that week (restricted by an injury, or
 *   no training at all) is carried forward from the previous week.
 * - `avgPunchSpeed` / `avgKickSpeed` are 0 when no strikes of that kind were detected.
 * - `avgRpe`, `guardUptimePct` and `headMovementsPerMin` are 0 in a week without sessions.
 */

const HISTORY_WEEKS = 12;
/** Monday–Saturday; Sunday is the rest day. */
const TRAINING_DAYS_PER_WEEK = 6;
/** A fighter's joining week has its own snapshot only when they trained most of it (joined Monday or Tuesday). */
const MIN_TRAINING_DAYS_IN_JOINING_WEEK = 5;
/** Weekday index of today, 0 = Monday … 6 = Sunday. */
const TODAY_INDEX = -mondayOffset();

type ScoreTable = Record<Technique, number>;
type DetectionKind = StrikeType | "combination";
/** A value right after an event starts, and the value it reaches by this week. */
type Progression = readonly [atEvent: number, thisWeek: number];

interface StorylineEvent {
    /** Days before today the event began — matches people.ts. */
    daysAgo: number;
    /** Training volume multiplier while the event applies. */
    volume?: Progression;
    /** Multiplier on detected strikes/combinations while the event applies. */
    detections?: Partial<Record<DetectionKind, number>>;
    /** Points added to technique scores while the event applies. */
    scoreShift?: Partial<Record<Technique, Progression>>;
    /** Techniques no longer assessed once the event fully applies (scores carry forward). */
    unassessed?: Technique[];
    rpeShift?: Progression;
    /** Maximum session RPE allowed by the Medical Clearance. */
    rpeCap?: number;
    punchSpeedShift?: Progression;
}

interface FighterProfile {
    fighterId: string;
    /** Scores 11 weeks ago. */
    baseline: ScoreTable;
    /** Points gained (or lost) by this week, applied linearly across the history. */
    trend: Partial<ScoreTable>;
    /** Spread of week-to-week score noise, in points. */
    noise: number;
    /** A normal full training week. */
    volume: { sessions: number; minutes: number; rpe: number };
    /** Fight-camp ramp: volume and RPE rise linearly from `fromWeek` to this week. */
    camp?: { fromWeek: number; volumeRise: number; rpeRise: number };
    /** Detections in the analysed footage of a normal full week. */
    detections: Record<DetectionKind, number>;
    /** Average peak speeds in m/s; `punchTrend` is the change reached by this week. */
    speed: { punch: number; kick: number; punchTrend?: number };
    event?: StorylineEvent;
}

interface WeekContext {
    weeksAgo: number;
    /** Share of the week's training days that have happened (1 for past weeks). */
    elapsed: number;
    /** Position in the history window: 0 for the oldest week, 1 for this week. */
    position: number;
    /** Fight-camp progress: 0 before or at camp start, 1 this week. */
    camp: number;
    /** Share of the elapsed training days affected by the storyline event, 0–1. */
    impact: number;
    /** Progress since the event: 0 in the event week, 1 this week. */
    sinceEvent: number;
}

const profiles: FighterProfile[] = [
    {
        // Fight camp for Lotus Fight Night 18: jab/cross rising, hook lagging, guard slow to improve.
        fighterId: "f-minh-tran",
        baseline: { jab: 74, cross: 72, hook: 62, kick: 80, combination: 72, footwork: 81, guard: 68, head_movement: 70 },
        trend: { jab: 8, cross: 8, hook: 5, kick: 2, combination: 5, footwork: 2, guard: 6, head_movement: 2 },
        noise: 1.5,
        volume: { sessions: 9, minutes: 520, rpe: 6.3 },
        camp: { fromWeek: 6, volumeRise: 0.3, rpeRise: 0.7 },
        detections: { jab: 420, cross: 330, hook: 200, kick: 250, combination: 150 },
        speed: { punch: 8.1, kick: 12.4, punchTrend: 0.4 },
    },
    {
        // Grappling-heavy profile; left hamstring strain in sparring 24 days ago.
        fighterId: "f-lucas-ferreira",
        baseline: { jab: 72, cross: 70, hook: 66, kick: 68, combination: 67, footwork: 74, guard: 78, head_movement: 68 },
        trend: { jab: 1, cross: 1, guard: 1 },
        noise: 1.5,
        volume: { sessions: 10, minutes: 600, rpe: 6.5 },
        detections: { jab: 170, cross: 125, hook: 70, kick: 65, combination: 45 },
        speed: { punch: 7.1, kick: 10.8 },
        event: {
            daysAgo: 24,
            volume: [0.35, 0.45],
            detections: { kick: 0, combination: 0.6 },
            unassessed: ["kick", "head_movement", "footwork"],
            rpeShift: [-1.1, -0.6],
            rpeCap: 7,
        },
    },
    {
        // Boxer: elite head movement and footwork, high jab volume, almost no kicks.
        fighterId: "f-aigerim-sadykova",
        baseline: { jab: 84, cross: 80, hook: 78, kick: 46, combination: 82, footwork: 86, guard: 81, head_movement: 91 },
        trend: { jab: 2, cross: 2, hook: 2, combination: 3, footwork: 2, head_movement: 2 },
        noise: 1.5,
        volume: { sessions: 9, minutes: 500, rpe: 6.4 },
        camp: { fromWeek: 5, volumeRise: 0.2, rpeRise: 0.5 },
        detections: { jab: 640, cross: 440, hook: 310, kick: 4, combination: 220 },
        speed: { punch: 8.9, kick: 9.4 },
    },
    {
        // Karate: excellent kicks. Right-shoulder asymmetry on the cross flagged 9 days ago.
        fighterId: "f-kenji-morita",
        baseline: { jab: 80, cross: 79, hook: 71, kick: 88, combination: 78, footwork: 86, guard: 74, head_movement: 75 },
        trend: { jab: 1, cross: 1, kick: 2, footwork: 1 },
        noise: 1.5,
        volume: { sessions: 9, minutes: 520, rpe: 6.4 },
        detections: { jab: 340, cross: 250, hook: 90, kick: 320, combination: 120 },
        speed: { punch: 8.6, kick: 13.4 },
        event: {
            daysAgo: 9,
            volume: [0.9, 0.85],
            detections: { cross: 0.6 },
            scoreShift: { cross: [-3, -8] },
            punchSpeedShift: [-0.2, -0.5],
            rpeCap: 8,
        },
    },
    {
        // Steady veteran wrestler; concussion in sparring 6 days ago — no training since.
        fighterId: "f-diego-alvarez",
        baseline: { jab: 72, cross: 71, hook: 69, kick: 60, combination: 67, footwork: 74, guard: 78, head_movement: 69 },
        trend: { footwork: 1 },
        noise: 1.5,
        volume: { sessions: 9, minutes: 540, rpe: 6.6 },
        detections: { jab: 190, cross: 150, hook: 95, kick: 40, combination: 55 },
        speed: { punch: 7.4, kick: 10.2 },
        event: { daysAgo: 6, volume: [0, 0] },
    },
    {
        // Amateur kickboxer: elite kicks, hands improving from a low base.
        fighterId: "f-linh-pham",
        baseline: { jab: 60, cross: 61, hook: 59, kick: 86, combination: 64, footwork: 72, guard: 65, head_movement: 60 },
        trend: { jab: 6, cross: 6, hook: 5, kick: 3, combination: 4, footwork: 2, guard: 2, head_movement: 2 },
        noise: 1.5,
        volume: { sessions: 7, minutes: 420, rpe: 6.1 },
        detections: { jab: 300, cross: 220, hook: 120, kick: 290, combination: 95 },
        speed: { punch: 7.5, kick: 12.6 },
    },
    {
        // Right 5th metacarpal fracture on the heavy bag 11 days ago: footwork and conditioning only.
        fighterId: "f-marcus-hale",
        baseline: { jab: 80, cross: 83, hook: 77, kick: 82, combination: 80, footwork: 79, guard: 76, head_movement: 72 },
        trend: { jab: 1, combination: 1 },
        noise: 1.5,
        volume: { sessions: 9, minutes: 560, rpe: 6.6 },
        detections: { jab: 390, cross: 300, hook: 200, kick: 260, combination: 140 },
        speed: { punch: 8.0, kick: 12.1 },
        event: {
            daysAgo: 11,
            volume: [0.85, 0.9],
            detections: { jab: 0.03, cross: 0, hook: 0, kick: 0.05, combination: 0 },
            unassessed: ["jab", "cross", "hook", "kick", "combination"],
            rpeShift: [-0.5, -0.4],
            punchSpeedShift: [-1, -1],
        },
    },
    {
        // Judoka who strikes well enough; steady, camp for Lotus Fight Night 17.
        fighterId: "f-sofia-kowalski",
        baseline: { jab: 73, cross: 72, hook: 68, kick: 70, combination: 70, footwork: 76, guard: 78, head_movement: 71 },
        trend: { jab: 2, cross: 2, hook: 1, kick: 1, combination: 2, footwork: 1, guard: 1, head_movement: 1 },
        noise: 1.5,
        volume: { sessions: 8, minutes: 500, rpe: 6.4 },
        camp: { fromWeek: 7, volumeRise: 0.25, rpeRise: 0.5 },
        detections: { jab: 240, cross: 180, hook: 110, kick: 95, combination: 75 },
        speed: { punch: 7.5, kick: 10.6 },
    },
    {
        // Camp for Lotus Fight Night 17; weight cut fatigue over the last two weeks.
        fighterId: "f-hoang-long",
        baseline: { jab: 74, cross: 72, hook: 70, kick: 79, combination: 73, footwork: 77, guard: 69, head_movement: 68 },
        trend: { jab: 2, cross: 2, kick: 2, combination: 2, footwork: 1, guard: 1, head_movement: 1 },
        noise: 1.5,
        volume: { sessions: 8, minutes: 480, rpe: 6.6 },
        camp: { fromWeek: 7, volumeRise: 0.3, rpeRise: 0.5 },
        detections: { jab: 330, cross: 250, hook: 150, kick: 230, combination: 110 },
        speed: { punch: 8.3, kick: 12.0 },
        event: {
            daysAgo: daysAgoAtWeekStart(1),
            scoreShift: { footwork: [-2, -3], combination: [-2, -3], head_movement: [-1, -2] },
            rpeShift: [0.8, 1.1],
            punchSpeedShift: [-0.2, -0.3],
        },
    },
    {
        // Left knee MCL sprain 38 days ago: no kicks since, boxing returning, volume rebuilding.
        fighterId: "f-tariq-haddad",
        baseline: { jab: 84, cross: 86, hook: 82, kick: 55, combination: 82, footwork: 74, guard: 82, head_movement: 76 },
        trend: {},
        noise: 1.5,
        volume: { sessions: 9, minutes: 540, rpe: 6.3 },
        detections: { jab: 460, cross: 340, hook: 250, kick: 14, combination: 160 },
        speed: { punch: 7.2, kick: 9.6 },
        event: {
            daysAgo: 38,
            volume: [0.35, 0.85],
            detections: { kick: 0 },
            unassessed: ["kick"],
            scoreShift: {
                jab: [-3, -1],
                cross: [-4, -1],
                hook: [-4, -1],
                combination: [-4, -1],
                footwork: [-8, -2],
                head_movement: [-5, -2],
            },
            rpeShift: [-1, -0.3],
        },
    },
    {
        // Consistent high performer.
        fighterId: "f-emma-lindqvist",
        baseline: { jab: 85, cross: 84, hook: 80, kick: 86, combination: 84, footwork: 85, guard: 83, head_movement: 80 },
        trend: { jab: 1, kick: 1, combination: 1 },
        noise: 1.8,
        volume: { sessions: 9, minutes: 540, rpe: 6.3 },
        detections: { jab: 410, cross: 310, hook: 190, kick: 280, combination: 150 },
        speed: { punch: 8.4, kick: 12.6 },
    },
    {
        // New amateur (joined 12 days ago); history covers the two weeks he has trained.
        fighterId: "f-bao-nguyen",
        baseline: { jab: 60, cross: 62, hook: 57, kick: 55, combination: 56, footwork: 58, guard: 61, head_movement: 55 },
        trend: {},
        noise: 1.5,
        volume: { sessions: 6, minutes: 330, rpe: 6.0 },
        detections: { jab: 220, cross: 170, hook: 100, kick: 75, combination: 50 },
        speed: { punch: 6.9, kick: 10.0 },
    },
];

export const mockPerformanceMetrics: PerformanceMetric[] = profiles.flatMap(buildHistory);

/* ─── Calendar ────────────────────────────────────────────────────────────── */

/** Days before today of the Monday that starts the week `weeksAgo`. */
function daysAgoAtWeekStart(weeksAgo: number): number {
    return weeksAgo * 7 + TODAY_INDEX;
}

/** Which week (weeks ago) a day `daysAgo` before today falls in, and its weekday (0 = Monday). */
function locateDay(daysAgo: number): { weeksAgo: number; weekday: number } {
    const weeksAgo = Math.max(0, Math.ceil((daysAgo - TODAY_INDEX) / 7));
    return { weeksAgo, weekday: weeksAgo * 7 - daysAgo + TODAY_INDEX };
}

function elapsedTrainingDays(weeksAgo: number): number {
    return weeksAgo > 0 ? TRAINING_DAYS_PER_WEEK : Math.min(TRAINING_DAYS_PER_WEEK, TODAY_INDEX + 1);
}

/**
 * Oldest week with data: the full window, or the first week the fighter trained most of —
 * the joining week when they joined early in it, otherwise the week after.
 */
function firstWeek(fighterId: string): number {
    const joinedAt = mockFighters.find((f) => f.id === fighterId)?.joinedAt;
    const oldest = HISTORY_WEEKS - 1;
    if (!joinedAt) return oldest;
    const joined = locateDay(daysBetween(joinedAt, fromToday(0)));
    const trainedDays = TRAINING_DAYS_PER_WEEK - joined.weekday;
    return Math.min(oldest, trainedDays >= MIN_TRAINING_DAYS_IN_JOINING_WEEK ? joined.weeksAgo : joined.weeksAgo - 1);
}

function weekContext(profile: FighterProfile, weeksAgo: number): WeekContext {
    const elapsedDays = elapsedTrainingDays(weeksAgo);
    const context: WeekContext = {
        weeksAgo,
        elapsed: elapsedDays / TRAINING_DAYS_PER_WEEK,
        position: (HISTORY_WEEKS - 1 - weeksAgo) / (HISTORY_WEEKS - 1),
        camp: profile.camp && weeksAgo < profile.camp.fromWeek ? (profile.camp.fromWeek - weeksAgo) / profile.camp.fromWeek : 0,
        impact: 0,
        sinceEvent: 0,
    };
    if (!profile.event) return context;

    const start = locateDay(profile.event.daysAgo);
    if (weeksAgo > start.weeksAgo) return context;
    context.sinceEvent = start.weeksAgo === 0 ? 1 : (start.weeksAgo - weeksAgo) / start.weeksAgo;
    context.impact = weeksAgo < start.weeksAgo ? 1 : clamp(elapsedDays - start.weekday, 0, elapsedDays) / elapsedDays;
    return context;
}

/* ─── Generation ──────────────────────────────────────────────────────────── */

function buildHistory(profile: FighterProfile): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];
    let previousScores: ScoreTable | null = null;
    for (let weeksAgo = firstWeek(profile.fighterId); weeksAgo >= 0; weeksAgo--) {
        const metric = buildWeek(profile, weekContext(profile, weeksAgo), previousScores);
        metrics.push(metric);
        previousScores = metric.scores;
    }
    return metrics;
}

function buildWeek(profile: FighterProfile, week: WeekContext, previousScores: ScoreTable | null): PerformanceMetric {
    const id = `pm-${profile.fighterId}-w${week.weeksAgo}`;
    const random = createRandom(id);
    const { event } = profile;

    const volumeFactor =
        week.elapsed *
        (1 + (profile.camp?.volumeRise ?? 0) * week.camp) *
        eventFactor(event?.volume ? progress(event.volume, week) : 1, week);
    const sessionsCompleted = volumeFactor === 0 ? 0 : Math.max(1, Math.round(profile.volume.sessions * volumeFactor + random.jitter(0.6)));
    const trained = sessionsCompleted > 0;

    const scores = buildScores(profile, week, previousScores, trained, random);
    const detect = (kind: DetectionKind) => {
        const count = profile.detections[kind] * volumeFactor * eventFactor(event?.detections?.[kind] ?? 1, week);
        return trained ? Math.max(0, Math.round(count * (1 + random.jitter(0.08)))) : 0;
    };
    const strikeCounts: Record<StrikeType, number> = { jab: detect("jab"), cross: detect("cross"), hook: detect("hook"), kick: detect("kick") };
    const combinations = detect("combination");

    const punchSpeed =
        profile.speed.punch +
        (profile.speed.punchTrend ?? 0) * week.position +
        (event?.punchSpeedShift ? progress(event.punchSpeedShift, week) * week.impact : 0) +
        random.jitter(0.15);
    const kickSpeed = profile.speed.kick + random.jitter(0.2);
    const punches = strikeCounts.jab + strikeCounts.cross + strikeCounts.hook;

    return {
        id,
        fighterId: profile.fighterId,
        weekStart: weekStart(week.weeksAgo),
        scores,
        strikeCounts,
        combinations,
        sessionsCompleted,
        trainingMinutes: trained ? Math.round((profile.volume.minutes * volumeFactor * (1 + random.jitter(0.06))) / 5) * 5 : 0,
        avgRpe: trained ? weekRpe(profile, week, random) : 0,
        avgPunchSpeed: punches > 0 ? round(clamp(punchSpeed, 6, 10), 1) : 0,
        avgKickSpeed: strikeCounts.kick > 0 ? round(clamp(kickSpeed, 9, 14), 1) : 0,
        guardUptimePct: trained ? round(clamp(scores.guard * 0.8 + 18 + random.jitter(1.5), 0, 100), 1) : 0,
        headMovementsPerMin: trained ? round(clamp(2 + scores.head_movement * 0.14 + random.jitter(0.4), 0, 30), 1) : 0,
    };
}

function buildScores(
    profile: FighterProfile,
    week: WeekContext,
    previousScores: ScoreTable | null,
    trained: boolean,
    random: Random,
): ScoreTable {
    const unassessed = new Set(week.impact === 1 ? (profile.event?.unassessed ?? []) : []);
    const score = (technique: Technique) => {
        const noise = random.jitter(profile.noise);
        const carried = previousScores?.[technique];
        if (carried !== undefined && (!trained || unassessed.has(technique))) return carried;
        const shift = profile.event?.scoreShift?.[technique];
        const value =
            profile.baseline[technique] +
            (profile.trend[technique] ?? 0) * week.position +
            (shift ? progress(shift, week) * week.impact : 0) +
            noise;
        return Math.round(clamp(value, 0, 100));
    };
    return {
        jab: score("jab"),
        cross: score("cross"),
        hook: score("hook"),
        kick: score("kick"),
        combination: score("combination"),
        footwork: score("footwork"),
        guard: score("guard"),
        head_movement: score("head_movement"),
    };
}

function weekRpe(profile: FighterProfile, week: WeekContext, random: Random): number {
    const { event } = profile;
    const planned =
        profile.volume.rpe +
        (profile.camp?.rpeRise ?? 0) * week.camp +
        (event?.rpeShift ? progress(event.rpeShift, week) * week.impact : 0) +
        random.jitter(0.25);
    const capped = event?.rpeCap === undefined ? planned : planned + (Math.min(planned, event.rpeCap) - planned) * week.impact;
    return round(clamp(capped, 5, 8), 1);
}

/** Value of a progression for this week, moving from the event week to this week. */
function progress(progression: Progression, week: WeekContext): number {
    return progression[0] + (progression[1] - progression[0]) * week.sinceEvent;
}

/** Blends a multiplier with 1 by the share of the week the event affected. */
function eventFactor(factor: number, week: WeekContext): number {
    return 1 + (factor - 1) * week.impact;
}
