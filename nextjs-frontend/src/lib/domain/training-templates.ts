import { academyWallClockToIso, addDaysToKey, dayKey, daysBetweenKeys, formatTime, isDateKey } from "@/lib/format";
import { TRAINING_TYPE_LABELS } from "./labels";
import { exerciseNameKey, type ServiceExerciseCategory } from "./training-contract";
import type { TrainingPhase, TrainingType } from "./types";

/**
 * Starting points so coaches don't type a plan or a session from scratch: plan templates, a starter exercise library
 * the templates draw on, session presets per training type, and the date helpers behind "length" chips and weekly
 * repeats. Everything a template fills in can be changed before it is saved. Pure: safe for Server and Client
 * Components.
 */

/* ─── Starter exercise library ────────────────────────────────────────────── */

/** An exercise templates refer to by name; administrators import the ones the library lacks. */
export interface StarterExercise {
    name: string;
    category: ServiceExerciseCategory;
    description: string;
    targetMuscleGroups: string[];
}

export const STARTER_EXERCISES: StarterExercise[] = [
    { name: "Technical shadow boxing", category: "STRIKING", description: "Shadow boxing on the clock with one technical focus per round.", targetMuscleGroups: ["shoulders", "core"] },
    { name: "Jab–cross–hook pad drill", category: "STRIKING", description: "Coach-fed jab, cross and hook combinations on the pads, back to guard after every strike.", targetMuscleGroups: ["shoulders", "core"] },
    { name: "Heavy bag power rounds", category: "STRIKING", description: "Rounds on the heavy bag with full power on the coach's call.", targetMuscleGroups: ["shoulders", "core", "legs"] },
    { name: "Slip-roll line drill", category: "STRIKING", description: "Slips and rolls under a line or a partner's punches, eyes on the target.", targetMuscleGroups: ["core", "legs"] },
    { name: "Pivot-and-angle footwork ladder", category: "STRIKING", description: "Ladder and cone work for pivots, angle exits and staying in stance.", targetMuscleGroups: ["calves", "legs"] },
    { name: "Footwork-only shadow rounds", category: "STRIKING", description: "Shadow rounds with no strikes: in, out, angles and cutting off space.", targetMuscleGroups: ["calves", "legs"] },
    { name: "Cage-cutting footwork", category: "STRIKING", description: "Cutting off the cage and trapping a moving partner without chasing.", targetMuscleGroups: ["legs"] },
    { name: "Controlled sparring rounds", category: "STRIKING", description: "Sparring at an agreed intensity with full gear and a coach watching.", targetMuscleGroups: ["full body"] },
    { name: "Thai pad kick & check rounds", category: "STRIKING", description: "Kicks, knees and checks on Thai pads with a coach holding.", targetMuscleGroups: ["hips", "legs", "core"] },
    { name: "Teep & roundhouse kick bag rounds", category: "STRIKING", description: "Teeps and roundhouse kicks on the heavy bag, both sides.", targetMuscleGroups: ["hips", "legs", "core"] },
    { name: "Muay Thai clinch knees", category: "STRIKING", description: "Clinch control and knees with a partner, swapping the inside position.", targetMuscleGroups: ["neck", "core", "hips"] },
    { name: "Double-leg to single-leg chain", category: "GRAPPLING", description: "A double-leg entry that switches to a single leg when the partner defends.", targetMuscleGroups: ["legs", "back"] },
    { name: "Cage wall get-ups", category: "GRAPPLING", description: "Standing back up along the cage wall from seated and from the knees.", targetMuscleGroups: ["legs", "core"] },
    { name: "Skipping rope rounds", category: "STRENGTH_CONDITIONING", description: "Rope rounds to warm up and build rhythm on the feet.", targetMuscleGroups: ["calves"] },
    { name: "Assault bike intervals", category: "STRENGTH_CONDITIONING", description: "Hard and easy intervals on the air bike.", targetMuscleGroups: ["legs", "full body"] },
    { name: "Sprawl-and-sprint intervals", category: "STRENGTH_CONDITIONING", description: "A sprawl, then a short sprint, repeated against the clock.", targetMuscleGroups: ["full body"] },
    { name: "Kettlebell swings", category: "STRENGTH_CONDITIONING", description: "Two-hand kettlebell swings for hip power.", targetMuscleGroups: ["glutes", "hamstrings", "back"] },
    { name: "Trap-bar deadlift", category: "STRENGTH_CONDITIONING", description: "Heavy trap-bar deadlifts for lower-body strength.", targetMuscleGroups: ["glutes", "hamstrings", "back"] },
    { name: "Bulgarian split squat", category: "STRENGTH_CONDITIONING", description: "Rear-foot-elevated split squats, one leg at a time.", targetMuscleGroups: ["quads", "glutes"] },
    { name: "Nordic hamstring curls", category: "STRENGTH_CONDITIONING", description: "Slow lowering from kneeling with the ankles held, for strong hamstrings.", targetMuscleGroups: ["hamstrings"] },
    { name: "Neck bridges (isometric)", category: "STRENGTH_CONDITIONING", description: "Held neck bridges to strengthen the neck against impact.", targetMuscleGroups: ["neck"] },
    { name: "Band pull-aparts", category: "STRENGTH_CONDITIONING", description: "Pulling a light band apart at chest height for shoulder health.", targetMuscleGroups: ["upper back", "shoulders"] },
    { name: "Thoracic mobility flow", category: "RECOVERY", description: "Rotations and extensions to free up the upper back.", targetMuscleGroups: ["upper back"] },
    { name: "Hip 90/90 mobility flow", category: "RECOVERY", description: "Hip rotation flow from the 90/90 seated position.", targetMuscleGroups: ["hips"] },
    { name: "Shoulder CARs & scapular control", category: "RECOVERY", description: "Slow shoulder circles and shoulder-blade control drills.", targetMuscleGroups: ["shoulders"] },
];

/* ─── Plan templates ──────────────────────────────────────────────────────── */

/** One exercise in a template, named as in the starter library, with its prescription. Minutes are whole. */
export interface TemplateExercise {
    name: string;
    category: ServiceExerciseCategory;
    sets: number | null;
    reps: number | null;
    /** Total time in seconds, a whole number of minutes. */
    durationSec: number | null;
    targetRpe: number | null;
    notes: string | null;
}

export type PlanTemplateId = "boxing_fundamentals" | "muay_thai_conditioning" | "fight_camp" | "fight_week_taper" | "return_from_rehab";

export interface PlanTemplate {
    id: PlanTemplateId;
    /** Card label, also the plan title it fills in. */
    label: string;
    /** One line on the card, e.g. "Sharper hands and defence". */
    summary: string;
    phase: TrainingPhase;
    weeks: number;
    objective: string;
    notes: string;
    exercises: TemplateExercise[];
}

const MIN = 60;

/** A template exercise with the starter library's category. */
function item(name: string, prescription: Omit<TemplateExercise, "name" | "category">): TemplateExercise {
    const starter = STARTER_EXERCISES.find((exercise) => exercise.name === name);
    if (!starter) throw new Error(`Template exercise "${name}" is not in the starter library.`);
    return { name, category: starter.category, ...prescription };
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
    {
        id: "boxing_fundamentals",
        label: "Boxing fundamentals",
        summary: "Straight punches, defence and footwork",
        phase: "build",
        weeks: 4,
        objective: "Sharpen the jab and straight punches, slip and roll on cue, and move on angles behind them.",
        notes: "Two technical sessions and one bag session a week. Keep sparring light and technical.",
        exercises: [
            item("Technical shadow boxing", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 4, notes: "3-minute rounds. Return to guard after every punch." }),
            item("Jab–cross–hook pad drill", { sets: 5, reps: null, durationSec: 15 * MIN, targetRpe: 6, notes: "3-minute rounds, 1 minute rest." }),
            item("Slip-roll line drill", { sets: 4, reps: null, durationSec: 8 * MIN, targetRpe: 5, notes: "2-minute rounds. Eyes on the punch." }),
            item("Pivot-and-angle footwork ladder", { sets: 4, reps: null, durationSec: 8 * MIN, targetRpe: 4, notes: null }),
            item("Heavy bag power rounds", { sets: 4, reps: null, durationSec: 12 * MIN, targetRpe: 7, notes: "Full power for the last 30 seconds of each round." }),
            item("Skipping rope rounds", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 5, notes: null }),
            item("Band pull-aparts", { sets: 3, reps: 15, durationSec: null, targetRpe: 4, notes: "Between rounds, for shoulder health." }),
        ],
    },
    {
        id: "muay_thai_conditioning",
        label: "Muay Thai conditioning",
        summary: "Kicks, knees and clinch at a steady pace",
        phase: "base",
        weeks: 6,
        objective: "Build the engine for five hard rounds of kicks, knees and clinch work at a steady pace.",
        notes: "Add a round each week. Check shins and feet before every kick session.",
        exercises: [
            item("Skipping rope rounds", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 5, notes: null }),
            item("Thai pad kick & check rounds", { sets: 5, reps: null, durationSec: 15 * MIN, targetRpe: 7, notes: "3-minute rounds, 1 minute rest." }),
            item("Teep & roundhouse kick bag rounds", { sets: 5, reps: null, durationSec: 15 * MIN, targetRpe: 7, notes: "Both sides every round." }),
            item("Muay Thai clinch knees", { sets: 4, reps: null, durationSec: 12 * MIN, targetRpe: 7, notes: "3-minute rounds with a partner." }),
            item("Assault bike intervals", { sets: 8, reps: null, durationSec: 8 * MIN, targetRpe: 8, notes: "30 seconds hard, 30 seconds easy." }),
            item("Kettlebell swings", { sets: 4, reps: 15, durationSec: null, targetRpe: 6, notes: null }),
            item("Hip 90/90 mobility flow", { sets: 2, reps: null, durationSec: 10 * MIN, targetRpe: 2, notes: "To finish every session." }),
        ],
    },
    {
        id: "fight_camp",
        label: "Fight camp",
        summary: "Game plan, five-round conditioning, weight",
        phase: "fight_camp",
        weeks: 8,
        objective: "Peak for fight night: sharpen the game plan, build five-round conditioning and make weight safely.",
        notes: "Sparring stays within the Medical Clearance. Weigh in every morning and log it.",
        exercises: [
            item("Controlled sparring rounds", { sets: 5, reps: null, durationSec: 25 * MIN, targetRpe: 8, notes: "5-minute rounds. Check partner and gear first." }),
            item("Cage-cutting footwork", { sets: 4, reps: null, durationSec: 12 * MIN, targetRpe: 6, notes: null }),
            item("Double-leg to single-leg chain", { sets: 5, reps: 6, durationSec: null, targetRpe: 7, notes: "Finish against the cage." }),
            item("Cage wall get-ups", { sets: 4, reps: 5, durationSec: null, targetRpe: 7, notes: null }),
            item("Sprawl-and-sprint intervals", { sets: 6, reps: null, durationSec: 6 * MIN, targetRpe: 9, notes: "20 seconds of work, 40 seconds of rest." }),
            item("Trap-bar deadlift", { sets: 4, reps: 5, durationSec: null, targetRpe: 7, notes: "Heavy but fast. No grinding reps." }),
            item("Neck bridges (isometric)", { sets: 3, reps: null, durationSec: null, targetRpe: 5, notes: "30-second holds." }),
            item("Thoracic mobility flow", { sets: 1, reps: null, durationSec: 10 * MIN, targetRpe: 2, notes: null }),
        ],
    },
    {
        id: "fight_week_taper",
        label: "Fight-week taper",
        summary: "Less volume, same speed, fresh on the night",
        phase: "taper",
        weeks: 2,
        objective: "Arrive fresh and sharp on fight night: cut the volume, keep speed and timing, and make weight.",
        notes: "No hard sparring. Short, fast rounds. Sleep and recovery come first.",
        exercises: [
            item("Technical shadow boxing", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 4, notes: null }),
            item("Jab–cross–hook pad drill", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 6, notes: "Fast and crisp. Stop before fatigue sets in." }),
            item("Footwork-only shadow rounds", { sets: 3, reps: null, durationSec: 6 * MIN, targetRpe: 3, notes: null }),
            item("Skipping rope rounds", { sets: 2, reps: null, durationSec: 6 * MIN, targetRpe: 4, notes: null }),
            item("Shoulder CARs & scapular control", { sets: 2, reps: 5, durationSec: null, targetRpe: 2, notes: null }),
            item("Hip 90/90 mobility flow", { sets: 1, reps: null, durationSec: 10 * MIN, targetRpe: 2, notes: null }),
        ],
    },
    {
        id: "return_from_rehab",
        label: "Return from rehab",
        summary: "Graded return within the doctor's limits",
        phase: "rehab",
        weeks: 3,
        objective: "Return to full training step by step while staying inside the doctor's restrictions.",
        notes: "Follow the Medical Clearance. Stop any drill that brings back pain and tell the sports doctor.",
        exercises: [
            item("Thoracic mobility flow", { sets: 1, reps: null, durationSec: 10 * MIN, targetRpe: 2, notes: null }),
            item("Hip 90/90 mobility flow", { sets: 1, reps: null, durationSec: 10 * MIN, targetRpe: 2, notes: null }),
            item("Shoulder CARs & scapular control", { sets: 2, reps: 5, durationSec: null, targetRpe: 2, notes: null }),
            item("Technical shadow boxing", { sets: 3, reps: null, durationSec: 9 * MIN, targetRpe: 3, notes: "Light. Technique only." }),
            item("Footwork-only shadow rounds", { sets: 3, reps: null, durationSec: 6 * MIN, targetRpe: 3, notes: null }),
            item("Bulgarian split squat", { sets: 3, reps: 8, durationSec: null, targetRpe: 5, notes: "Bodyweight in week 1." }),
            item("Nordic hamstring curls", { sets: 3, reps: 5, durationSec: null, targetRpe: 6, notes: null }),
            item("Band pull-aparts", { sets: 3, reps: 15, durationSec: null, targetRpe: 3, notes: null }),
        ],
    },
];

export function planTemplate(id: string | undefined): PlanTemplate | undefined {
    return PLAN_TEMPLATES.find((template) => template.id === id);
}

/** Objective suggestions per phase, offered as chips on the plan form. */
export const PHASE_OBJECTIVE_SUGGESTIONS: Record<TrainingPhase, string[]> = {
    base: ["Build general fitness and a steady pace for three rounds.", "Clean up technique before the next camp."],
    build: ["Raise intensity and add fight-specific conditioning.", "Sharpen combinations and finish them with power."],
    fight_camp: ["Peak for fight night and make weight safely.", "Drill the game plan for the next opponent."],
    taper: ["Arrive fresh and sharp on fight night.", "Keep speed and timing while cutting volume."],
    rehab: ["Return to full training within the doctor's restrictions.", "Rebuild strength and range of motion without pain."],
    maintenance: ["Keep fitness and skills ticking over between camps.", "Train consistently without building fatigue."],
};

/* ─── Matching templates to the library ──────────────────────────────────── */

export interface CatalogExercise {
    id: string;
    name: string;
}

export interface ResolvedTemplateExercise extends TemplateExercise {
    exerciseId: string;
}

export interface ResolvedTemplate {
    /** Template exercises found in the library, in template order. */
    items: ResolvedTemplateExercise[];
    /** Template exercises the library doesn't have: shown to the coach and skipped. */
    missing: TemplateExercise[];
}

function catalogIndex(catalog: CatalogExercise[]): Map<string, CatalogExercise> {
    const index = new Map<string, CatalogExercise>();
    for (const exercise of catalog) {
        const key = exerciseNameKey(exercise.name);
        if (!index.has(key)) index.set(key, exercise);
    }
    return index;
}

/** Finds each template exercise in the library by name, ignoring case, spacing and dash style. */
export function resolvePlanTemplate(template: Pick<PlanTemplate, "exercises">, catalog: CatalogExercise[]): ResolvedTemplate {
    const index = catalogIndex(catalog);
    const items: ResolvedTemplateExercise[] = [];
    const missing: TemplateExercise[] = [];
    for (const exercise of template.exercises) {
        const match = index.get(exerciseNameKey(exercise.name));
        if (match) items.push({ ...exercise, exerciseId: match.id });
        else missing.push(exercise);
    }
    return { items, missing };
}

/** Starter exercises the library doesn't have yet (matched by name like the templates), in starter order. */
export function missingStarterExercises(catalog: Pick<CatalogExercise, "name">[]): StarterExercise[] {
    const names = new Set(catalog.map((exercise) => exerciseNameKey(exercise.name)));
    return STARTER_EXERCISES.filter((exercise) => !names.has(exerciseNameKey(exercise.name)));
}

/* ─── Plan dates and titles ───────────────────────────────────────────────── */

/** Plan lengths offered as one-tap chips next to the start date. */
export const PLAN_LENGTH_WEEKS = [4, 6, 8, 12] as const;

/** The last day of a plan that starts on `startKey` and runs for `weeks` full weeks. */
export function planEndKey(startKey: string, weeks: number): string {
    return addDaysToKey(startKey, weeks * 7 - 1);
}

/** Days a plan spans, counting both the first and the last day; null when either date is missing or reversed. */
export function planSpanDays(startKey: string, endKey: string): number | null {
    if (!isDateKey(startKey) || !isDateKey(endKey)) return null;
    const days = daysBetweenKeys(startKey, endKey) + 1;
    return days > 0 ? days : null;
}

/** Whole weeks a plan spans when it is an exact number of weeks, otherwise null. */
export function planWholeWeeks(startKey: string, endKey: string): number | null {
    const days = planSpanDays(startKey, endKey);
    return days !== null && days % 7 === 0 ? days / 7 : null;
}

const TITLE_MAX = 120;
const COPY_SUFFIX = " (copy)";

/** "Fight camp" → "Fight camp (copy)", shortened so it fits the title limit. */
export function copyTitle(title: string): string {
    const base = title.trim();
    return `${base.slice(0, TITLE_MAX - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`;
}

/* ─── Session presets ─────────────────────────────────────────────────────── */

export interface SessionPreset {
    durationMin: number;
    /** Offered as a one-tap note, never filled in on its own. */
    notes: string;
}

/** Defaults per training type the training service can schedule. Technical drilling (demo only) has none. */
export const SESSION_PRESETS: Partial<Record<TrainingType, SessionPreset>> = {
    shadow_boxing: { durationMin: 45, notes: "Bring wraps. 3-minute rounds on the clock." },
    pad_work: { durationMin: 60, notes: "Bring wraps and gloves." },
    heavy_bag: { durationMin: 45, notes: "Bring wraps and bag gloves." },
    sparring: { durationMin: 60, notes: "Full gear: headgear, mouthguard, shin guards and sparring gloves." },
    grappling: { durationMin: 75, notes: "Bring a rash guard and grappling shorts." },
    strength_conditioning: { durationMin: 60, notes: "Bring training shoes and a water bottle." },
    recovery_mobility: { durationMin: 40, notes: "Light session. Wear comfortable clothes." },
};

/** Duration used when a type has no preset. */
export const DEFAULT_SESSION_MINUTES = 60;

export function presetDuration(type: TrainingType): number {
    return SESSION_PRESETS[type]?.durationMin ?? DEFAULT_SESSION_MINUTES;
}

/** "Pad work — Fight camp", or just the type when there's no plan; shortened to the title limit. */
export function suggestedSessionTitle(type: TrainingType, planTitle?: string | null): string {
    const label = TRAINING_TYPE_LABELS[type];
    const plan = planTitle?.trim();
    const title = plan ? `${label} — ${plan}` : label;
    return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1).trimEnd()}…` : title;
}

/* ─── Weekly repeats ──────────────────────────────────────────────────────── */

/** The most sessions one "Repeat weekly" schedules, counting the first. */
export const MAX_WEEKLY_REPEATS = 12;

export interface WeeklyDates {
    /** Date keys one week apart, starting with the first session's. */
    dates: string[];
    /** Weeks left out because they fall after the plan's last day. */
    skipped: number;
}

/**
 * `count` weekly dates from `firstKey` (at most 12). Dates after `lastKey` (the plan's last day) are left out;
 * the first date is always kept because the coach chose it.
 */
export function weeklyDates(firstKey: string, count: number, lastKey: string | null = null): WeeklyDates {
    const total = Math.max(1, Math.min(MAX_WEEKLY_REPEATS, Math.floor(count)));
    const all = Array.from({ length: total }, (_, index) => addDaysToKey(firstKey, index * 7));
    const dates = all.filter((date, index) => index === 0 || lastKey === null || !isDateKey(lastKey) || date <= lastKey);
    return { dates, skipped: all.length - dates.length };
}

/**
 * The slot for "Schedule again": one week after the session, at the same academy time, moved on a further week
 * at a time until it is no longer in the past.
 */
export function nextWeeklySlot(scheduledAt: string, now: string | Date = new Date()): { date: string; time: string } {
    const time = formatTime(scheduledAt);
    const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
    let date = addDaysToKey(dayKey(scheduledAt), 7);
    for (let guard = 0; guard < 520 && Date.parse(academyWallClockToIso(date, time)) < nowMs; guard += 1) date = addDaysToKey(date, 7);
    return { date, time };
}
