import type { EligibilityReason } from "./medical-contract";
import type { PlanStatus, Role, VideoStatus } from "./types";

/**
 * A fighter's journey from an active account to their first AI analysis, derived from what the app can already
 * read: the sports doctor assignments, the medical service's training verdict, training plans and uploads.
 * Pure; safe for Server and Client Components.
 *
 * The medical rules come from the service contract:
 * - Eligibility is the service's verdict. Nothing here reads SCAT6 scores or looks for "some clearance".
 * - `eligible: false` with no reasons is still not eligible.
 * - A reason the interface doesn't know still blocks training; it is never dropped.
 * - An examination recorded without details (legacy) isn't read as "not examined": only the verdict's
 *   `EXAMINATION_REQUIRED` says the baseline is missing.
 */

export const JOURNEY_STEP_IDS = ["account", "doctor", "baseline", "clearance", "plan", "analysis"] as const;
export type JourneyStepId = (typeof JOURNEY_STEP_IDS)[number];

/**
 * - done: finished.
 * - current: the step in progress, and it's the viewer's move.
 * - waiting: the step in progress, waiting on someone else.
 * - upcoming: comes after the step in progress.
 * - unknown: the viewer may not read it, or it didn't load.
 */
export type JourneyStepStatus = "done" | "current" | "waiting" | "upcoming" | "unknown";

/** Who moves a step forward. */
export type JourneyOwner = "admin" | "doctor" | "coach" | "fighter";

/** Whose words the journey speaks in: the fighter reads "your sports doctor", an admin reads "Assign a sports doctor". */
export type JourneyViewer = Role;

/** What a step's data says, independent of the viewer. Pages pick longer copy or an action from it. */
export type JourneyCode =
    | "account_active"
    | "doctor_assigned"
    | "doctor_missing"
    | "baseline_done"
    | "baseline_pending"
    | "cleared"
    | "cleared_restricted"
    | "clearance_pending"
    | "review_pending"
    | "not_eligible"
    | "clearance_expired"
    | "clearance_unspecified"
    | "plan_active"
    | "plan_draft"
    | "plan_missing"
    | "analysis_ready"
    | "analysis_processing"
    | "analysis_failed"
    | "analysis_missing"
    | "unknown";

export interface JourneyStep {
    id: JourneyStepId;
    label: string;
    owner: JourneyOwner;
    status: JourneyStepStatus;
    code: JourneyCode;
    /** The person behind the step when known: the assigned doctor, the coach preparing the plan. */
    person: string | null;
    /** One short line in the viewer's words: what happened, or what happens next and who does it. */
    detail: string;
    /** Training is blocked for a reason someone has to act on (not eligible, expired, review pending, unexplained). */
    attention: boolean;
}

export interface FighterJourney {
    viewer: JourneyViewer;
    steps: JourneyStep[];
    /** The step in progress (current or waiting); null when every known step is done. */
    active: JourneyStep | null;
    /** Every step is done. Unknown steps keep the journey incomplete. */
    complete: boolean;
    doneCount: number;
    /** The medical service's training verdict: true when eligible, null when it couldn't be read. */
    cleared: boolean | null;
}

export interface JourneyPerson {
    id: string;
    name: string;
}

export interface JourneyInput {
    viewer: JourneyViewer;
    /** The fighter's current sports doctors; null when the assignments couldn't be read. */
    doctors: readonly JourneyPerson[] | null;
    /** The fighter's current coaches, the primary one first; null when unknown. */
    coaches: readonly JourneyPerson[] | null;
    /** The medical service's TRAINING verdict, reasons as sent; null when it couldn't be read. */
    eligibility: { eligible: boolean; reasons: readonly string[] } | null;
    /** The governing clearance carries restrictions. */
    restricted: boolean;
    /** The fighter's training plans, any status; null when they couldn't be read. */
    plans: readonly { status: PlanStatus; title: string; coachId: string }[] | null;
    /** The fighter's uploads; null when they couldn't be read. */
    videos: readonly { status: VideoStatus; uploadedAt: string }[] | null;
}

export const JOURNEY_STEP_LABELS: Record<JourneyStepId, string> = {
    account: "Account active",
    doctor: "Sports doctor",
    baseline: "Baseline exam",
    clearance: "Medical Clearance",
    plan: "Training plan",
    analysis: "First AI analysis",
};

export const JOURNEY_STEP_OWNERS: Record<JourneyStepId, JourneyOwner> = {
    account: "admin",
    doctor: "admin",
    baseline: "doctor",
    clearance: "doctor",
    plan: "coach",
    analysis: "fighter",
};

export const JOURNEY_OWNER_LABELS: Record<JourneyOwner, string> = {
    admin: "Academy admin",
    doctor: "Sports doctor",
    coach: "Coach",
    fighter: "Fighter",
};

/** Screen-reader wording for each status. */
export const JOURNEY_STATUS_LABELS: Record<JourneyStepStatus, string> = {
    done: "Done",
    current: "Your next step",
    waiting: "In progress",
    upcoming: "Not started",
    unknown: "Status unavailable",
};

/** "You" when the viewer moves the step themselves. */
export function journeyOwnerLabel(owner: JourneyOwner, viewer: JourneyViewer): string {
    return owner === viewer ? "You" : JOURNEY_OWNER_LABELS[owner];
}

/* ─── Reading the data ────────────────────────────────────────────────────── */

const has = (reasons: readonly string[], reason: EligibilityReason) => reasons.includes(reason);

/**
 * Whether the baseline examination is on file, from the verdict alone. The service lists EXAMINATION_REQUIRED
 * whenever it is missing, so a verdict that names other reasons (or is eligible) means it's there. A verdict with
 * no reasons at all can't tell.
 */
function baselineOnFile(eligibility: JourneyInput["eligibility"]): boolean | null {
    if (!eligibility) return null;
    if (has(eligibility.reasons, "EXAMINATION_REQUIRED")) return false;
    if (eligibility.eligible) return true;
    return eligibility.reasons.length > 0 ? true : null;
}

/** Why the fighter isn't cleared, most serious first. Anything unexplained (no reasons, or only unknown ones) is "unspecified". */
function clearanceCode(eligibility: NonNullable<JourneyInput["eligibility"]>, restricted: boolean): JourneyCode {
    const { eligible, reasons } = eligibility;
    if (eligible) return restricted ? "cleared_restricted" : "cleared";
    if (has(reasons, "EXAMINATION_NOT_ELIGIBLE")) return "not_eligible";
    if (has(reasons, "REVIEW_REQUEST_PENDING")) return "review_pending";
    if (has(reasons, "CLEARANCE_EXPIRED")) return "clearance_expired";
    if (has(reasons, "CLEARANCE_REQUIRED") || has(reasons, "EXAMINATION_REQUIRED")) return "clearance_pending";
    return "clearance_unspecified";
}

const ATTENTION_CODES: ReadonlySet<JourneyCode> = new Set(["not_eligible", "review_pending", "clearance_expired", "clearance_unspecified"]);

/** The newest upload decides, except that any finished analysis counts. */
function analysisCode(videos: NonNullable<JourneyInput["videos"]>): JourneyCode {
    if (videos.some((video) => video.status === "completed")) return "analysis_ready";
    const latest = [...videos].sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))[0];
    if (!latest) return "analysis_missing";
    return latest.status === "failed" ? "analysis_failed" : "analysis_processing";
}

/* ─── Copy ────────────────────────────────────────────────────────────────── */

interface Facts {
    viewer: JourneyViewer;
    doctor: string | null;
    coach: string | null;
}

/** The line for the step in progress, in the viewer's words. */
function activeDetail(code: JourneyCode, { viewer, doctor, coach }: Facts): string {
    const fighter = viewer === "fighter";
    switch (code) {
        case "doctor_missing":
            if (fighter) return "Waiting for the academy to assign your sports doctor";
            return viewer === "admin" ? "Assign a sports doctor" : "Waiting for the academy to assign a sports doctor";
        case "baseline_pending":
            if (viewer === "doctor") return "Record the baseline exam";
            if (fighter) return doctor ? `Your baseline exam is with ${doctor}` : "Waiting for your baseline exam";
            return doctor ? `Baseline exam with ${doctor}` : "Waiting for the baseline exam";
        case "clearance_pending":
            if (viewer === "doctor") return "Issue the Medical Clearance";
            if (fighter) return doctor ? `Waiting for your Medical Clearance from ${doctor}` : "Waiting for your Medical Clearance";
            return doctor ? `Waiting for ${doctor} to issue the clearance` : "Waiting for the sports doctor to issue the clearance";
        case "review_pending":
            if (viewer === "doctor") return "Examine the fighter to answer the review request";
            return fighter ? "Medical review pending: training waits for an exam" : "Medical review pending";
        case "not_eligible":
            return fighter ? "Not cleared to train after your latest exam" : "Not cleared to train after the latest exam";
        case "clearance_expired":
            if (viewer === "doctor") return "Renew the expired clearance";
            return fighter ? "Your Medical Clearance has expired" : "Medical Clearance expired";
        case "clearance_unspecified":
            return "Not cleared to train yet";
        case "plan_draft":
            if (viewer === "coach") return "Activate the draft plan";
            if (fighter) return `${coach ?? "Your coach"} is preparing your plan`;
            return "Draft plan, not active yet";
        case "plan_missing":
            if (viewer === "coach") return "Build a training plan";
            if (fighter) return coach ? `Waiting for ${coach} to set up your plan` : "Waiting for your coach to set up a plan";
            return "Waiting for a training plan";
        case "analysis_missing":
            return fighter || viewer === "coach" ? "Upload a video for AI analysis" : "Waiting for a first video";
        case "analysis_processing":
            return fighter ? "Your video is being analysed" : "Video being analysed";
        case "analysis_failed":
            return fighter ? "Your last upload didn't process. Try another clip" : "Last upload didn't process";
        default:
            return "";
    }
}

const UPCOMING_DETAIL: Partial<Record<JourneyStepId, string>> = {
    baseline: "After a sports doctor is assigned",
    clearance: "After the baseline exam",
    plan: "After Medical Clearance",
};

/** The line for a step that hasn't started: what it waits for, or what's already moving. */
function upcomingDetail(id: JourneyStepId, code: JourneyCode): string {
    if (code === "plan_draft") return "Draft in progress";
    if (code === "analysis_processing") return "Video being analysed";
    if (code === "analysis_failed") return "Last upload didn't process";
    if (id === "analysis") return "Upload a training video";
    return UPCOMING_DETAIL[id] ?? "";
}

/* ─── The journey ─────────────────────────────────────────────────────────── */

interface StepFacts {
    id: JourneyStepId;
    /** Null when unknown. */
    done: boolean | null;
    code: JourneyCode;
    person: string | null;
    /** The line once the step is done. */
    doneDetail: string;
}

export function buildFighterJourney(input: JourneyInput): FighterJourney {
    const { viewer, doctors, coaches, eligibility, restricted, plans, videos } = input;
    const doctorNames = doctors?.map((doctor) => doctor.name) ?? null;
    const doctor = doctorNames?.[0] ?? null;
    const coachName = (id: string | undefined) => coaches?.find((coach) => coach.id === id)?.name ?? null;
    const baseline = baselineOnFile(eligibility);

    // The baseline can only be recorded by an assigned doctor, so a baseline on file means one was assigned.
    const doctorFacts: StepFacts =
        doctorNames && doctorNames.length > 0
            ? { id: "doctor", done: true, code: "doctor_assigned", person: doctorNames.join(", "), doneDetail: doctorNames.join(", ") }
            : baseline === true
              ? { id: "doctor", done: true, code: "doctor_assigned", person: null, doneDetail: doctorNames ? "None assigned right now" : "Assigned" }
              : doctorNames
                ? { id: "doctor", done: false, code: "doctor_missing", person: null, doneDetail: "" }
                : { id: "doctor", done: null, code: "unknown", person: null, doneDetail: "" };

    const activePlan = plans?.find((plan) => plan.status === "active");
    const draftPlan = plans?.find((plan) => plan.status === "draft");
    const planFacts: StepFacts = !plans
        ? { id: "plan", done: null, code: "unknown", person: null, doneDetail: "" }
        : activePlan
          ? { id: "plan", done: true, code: "plan_active", person: coachName(activePlan.coachId), doneDetail: activePlan.title }
          : draftPlan
            ? { id: "plan", done: false, code: "plan_draft", person: coachName(draftPlan.coachId), doneDetail: "" }
            : { id: "plan", done: false, code: "plan_missing", person: coaches?.[0]?.name ?? null, doneDetail: "" };

    const clearance = eligibility ? clearanceCode(eligibility, restricted) : "unknown";
    const analysis = videos ? analysisCode(videos) : "unknown";

    const facts: StepFacts[] = [
        { id: "account", done: true, code: "account_active", person: null, doneDetail: "Fighter account active" },
        doctorFacts,
        {
            id: "baseline",
            done: baseline,
            code: baseline === null ? "unknown" : baseline ? "baseline_done" : "baseline_pending",
            person: doctor,
            doneDetail: "On file",
        },
        {
            id: "clearance",
            done: eligibility ? eligibility.eligible : null,
            code: clearance,
            person: doctor,
            doneDetail: clearance === "cleared_restricted" ? "Cleared with restrictions" : "Cleared to train",
        },
        planFacts,
        { id: "analysis", done: videos ? analysis === "analysis_ready" : null, code: analysis, person: null, doneDetail: "Analysis ready" },
    ];

    // The first step that isn't done (and is known) is the one in progress; later ones wait their turn.
    const steps: JourneyStep[] = [];
    let active: JourneyStep | null = null;
    for (const { id, done, code, person, doneDetail } of facts) {
        const owner = JOURNEY_STEP_OWNERS[id];
        const base = { id, label: JOURNEY_STEP_LABELS[id], owner, code, person };
        if (done === true) {
            steps.push({ ...base, status: "done", detail: doneDetail, attention: false });
        } else if (done === null) {
            steps.push({ ...base, status: "unknown", detail: "Couldn't load", attention: false });
        } else if (active) {
            steps.push({ ...base, status: "upcoming", detail: upcomingDetail(id, code), attention: ATTENTION_CODES.has(code) });
        } else {
            active = {
                ...base,
                status: owner === viewer ? "current" : "waiting",
                detail: activeDetail(code, { viewer, doctor, coach: person }),
                attention: ATTENTION_CODES.has(code),
            };
            steps.push(active);
        }
    }

    const doneCount = steps.filter((step) => step.status === "done").length;
    return {
        viewer,
        steps,
        active,
        complete: doneCount === steps.length,
        doneCount,
        cleared: eligibility ? eligibility.eligible : null,
    };
}

/** Finds one step of a journey by id. */
export function journeyStep(journey: FighterJourney, id: JourneyStepId): JourneyStep {
    const step = journey.steps.find((candidate) => candidate.id === id);
    if (!step) throw new Error(`Unknown journey step: ${id}`);
    return step;
}
