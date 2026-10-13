import { CalendarClock, CalendarX2, ClipboardCheck, ClipboardPlus, Hourglass, ShieldAlert, ShieldQuestion, ShieldX, Sparkles, Target } from "lucide-react";

import { describeDaysUntil } from "@/components/domain/domain-format";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import type { AttentionItem } from "@/components/medical/attention-list";
import { applicantName, type Application } from "@/lib/domain/admissions";
import { TRAINING_TYPE_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { clearanceExpiresSoon, goalProgressPct } from "@/lib/domain/rules";
import type { Goal, TrainingPlan, TrainingSession } from "@/lib/domain/types";
import { daysBetween, formatDate, formatRelative, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { ReviewQueueItem } from "@/lib/services/videos";
import type { QueueGroupMeta } from "./queue-card";
import { sessionsWith, type RosterEntry, type SessionCheck } from "./roster-data";

/** The corner queue's groups, in the order the filter shows them. */
export const COACH_QUEUES = ["clearance", "sessions", "onboarding", "reviews", "applicants", "goals"] as const;
export type CoachQueue = (typeof COACH_QUEUES)[number];

export const COACH_QUEUE_META: Record<CoachQueue, QueueGroupMeta> = {
    clearance: {
        label: "Clearance",
        icon: ShieldAlert,
        empty: { title: "Every fighter can train", description: "No one is paused, waiting for a clearance or about to lose one." },
    },
    sessions: {
        label: "Sessions",
        icon: CalendarX2,
        empty: { title: "Sessions are on track", description: "No clashes with Medical Clearance and no missed sessions this week." },
    },
    onboarding: {
        label: "Needs a plan",
        icon: ClipboardPlus,
        empty: { title: "Every cleared fighter has a plan", description: "Fighters cleared to train wait here until they have an active training plan." },
    },
    reviews: {
        label: "Reviews",
        icon: Sparkles,
        empty: { title: "No analyses to review", description: "Every AI analysis on your roster has your review." },
    },
    applicants: {
        label: "Applicants",
        icon: ClipboardCheck,
        empty: { title: "No one to assess", description: "Applicants appear here when an administrator asks you to assess them." },
    },
    goals: {
        label: "Goals",
        icon: Target,
        empty: { title: "No goals at risk", description: "Every open goal is on pace." },
    },
};

export interface CoachAttentionInput {
    roster: RosterEntry[];
    /** Every roster session this week, all statuses. */
    weekSessions: TrainingSession[];
    reviewQueue: ReviewQueueItem[];
    /**
     * Analyses awaiting review when the per-analysis queue isn't available (API mode): shown as one summary row
     * pointing to the Film room.
     */
    reviewCount?: number;
    /** Missed sessions in the last 7 days. */
    missed: TrainingSession[];
    goalsAtRisk: Goal[];
    /**
     * Every plan on the roster, any status, to find fighters cleared to train without an active one. Left out when the
     * plans weren't read: the group stays empty rather than flagging everyone.
     */
    plans?: TrainingPlan[];
    /** Applications an administrator asked this coach to assess. */
    applicants?: Application[];
    /** Clearances lapsing within this many days are flagged. */
    warningDays: number;
    /** Server time (ISO). */
    now: string;
}

/** Roster sessions filtered to one fighter. */
export function fighterSessionsHref(fighterId: string): string {
    return hrefWith(routes.coach.sessions, {}, { fighter: fighterId });
}

function firstMessage(checks: SessionCheck[], severity: "block" | "warn"): string {
    return checks[0]?.conflicts.find((conflict) => conflict.severity === severity)?.message ?? "";
}

function sessionAction(checks: SessionCheck[], fighterId: string): AttentionItem["action"] {
    return checks.length === 1
        ? { href: routes.coach.session(checks[0].session.id), label: "Review session" }
        : { href: fighterSessionsHref(fighterId), label: "Review sessions" };
}

/** Fighters the sports doctor cleared to train who have no active plan: the coach's next step after clearance. */
function planItems(roster: RosterEntry[], plans: TrainingPlan[]): AttentionItem[] {
    return roster.flatMap(({ fighter, clearanceState }) => {
        if (clearanceState !== "full" && clearanceState !== "restricted") return [];
        const own = plans.filter((plan) => plan.fighterId === fighter.id);
        if (own.some((plan) => plan.status === "active")) return [];
        const draft = own.filter((plan) => plan.status === "draft").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const restricted = clearanceState === "restricted" ? "Cleared with restrictions — build the plan around them" : "Medical Clearance is in place";
        return [
            {
                id: `plan-${fighter.id}`,
                group: "onboarding",
                tone: "info",
                icon: ClipboardPlus,
                kind: draft ? "Draft plan" : own.length === 0 ? "No plan yet" : "No active plan",
                fighterName: fighter.name,
                fighterHref: routes.coach.fighter(fighter.id),
                title: draft ? "Cleared to train, but the plan is still a draft" : own.length === 0 ? "Cleared to train, no training plan yet" : "Cleared to train, no active plan",
                detail: draft ? `${draft.title} · activate it to start scheduling` : restricted,
                action: draft ? { href: routes.coach.plan(draft.id), label: "Finish plan" } : { href: hrefWith(routes.coach.newPlan, {}, { fighter: fighter.id }), label: "Build plan" },
            },
        ];
    });
}

/** Entrance assessments waiting for this coach, the longest-waiting first. */
function applicantItems(applications: Application[], now: string): AttentionItem[] {
    return applications
        .filter((application) => application.status === "submitted" && !application.assessment)
        .map((application) => ({ application, since: application.evaluator?.since ?? application.submittedAt }))
        .sort((a, b) => a.since.localeCompare(b.since))
        .map(({ application, since }) => ({
            id: `applicant-${application.id}`,
            group: "applicants",
            tone: "info",
            icon: ClipboardCheck,
            kind: "Entrance assessment",
            at: since,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.coach.admission(application.id),
            title: "Waiting for your entrance assessment",
            detail: `Assigned ${formatRelative(since, now)} · ${WEIGHT_CLASS_LABELS[application.applicant.weightClass]}`,
            action: { href: routes.coach.admission(application.id), label: "Assess" },
        }));
}

/**
 * The coach's corner queue, most urgent first: fighters who must not train, sessions that clash with Medical
 * Clearance, lapsing clearances, cleared fighters without a plan, AI analyses waiting for a human, applicants to
 * assess, missed sessions and goals at risk. Each item is filed under one {@link CoachQueue} so the page can filter it.
 */
export function buildCoachAttention({
    roster,
    weekSessions,
    reviewQueue,
    reviewCount = 0,
    missed,
    goalsAtRisk,
    plans,
    applicants = [],
    warningDays,
    now,
}: CoachAttentionInput): AttentionItem[] {
    const blocked: AttentionItem[] = [];
    const conflicts: AttentionItem[] = [];
    const expiring: AttentionItem[] = [];
    const noClearance: AttentionItem[] = [];
    const warnings: AttentionItem[] = [];
    const names = new Map(roster.map((entry) => [entry.fighter.id, entry.fighter.name]));

    for (const { fighter, clearance, clearanceState: state, eligibility, daysRemaining, upcoming } of roster) {
        const who = { fighterName: fighter.name, fighterHref: routes.coach.fighter(fighter.id) };

        if (state === "not_cleared" || state === "expired") {
            const scheduled = upcoming.length;
            const cancelled = weekSessions.filter((session) => session.fighterId === fighter.id && session.status === "cancelled").length;
            // A pending review pauses training even though the clearance itself still stands.
            const reviewPending = state === "not_cleared" && (eligibility?.reasons.includes("REVIEW_REQUEST_PENDING") ?? false);
            blocked.push({
                id: `blocked-${fighter.id}`,
                group: "clearance",
                tone: "danger",
                icon: reviewPending ? Hourglass : ShieldX,
                kind: reviewPending ? "Medical review" : state === "expired" ? "Clearance expired" : "Not cleared",
                ...who,
                title:
                    scheduled > 0
                        ? `${pluralize(scheduled, "session")} still scheduled — cancel or reschedule`
                        : reviewPending
                          ? "Paused until the sports doctor examines them"
                          : state === "expired"
                            ? "Training is blocked until a sports doctor renews the clearance"
                            : "No training until the sports doctor clears them",
                detail:
                    scheduled > 0
                        ? reviewPending
                            ? "A medical review was requested, so training waits for the doctor"
                            : "Training isn't permitted without a valid clearance"
                        : cancelled > 0
                          ? `${pluralize(cancelled, "session")} cancelled this week`
                          : reviewPending
                            ? "A medical review was requested; training resumes once the doctor has seen them"
                            : "Only the sports doctor can change this",
                action: scheduled > 0 ? { href: fighterSessionsHref(fighter.id), label: "Review sessions" } : { href: routes.coach.clearance, label: "View clearance" },
            });
            continue;
        }

        if (state === "none") {
            noClearance.push({
                id: `none-${fighter.id}`,
                group: "clearance",
                tone: "warning",
                icon: ShieldQuestion,
                kind: "No clearance",
                ...who,
                title:
                    upcoming.length > 0
                        ? `${pluralize(upcoming.length, "upcoming session")} can't be checked against medical guidance`
                        : "No Medical Clearance on file yet",
                detail: "The sports doctor issues one after a baseline examination",
                action: { href: routes.coach.clearance, label: "View clearance" },
            });
            continue;
        }

        const validUntil = clearance?.validUntil ?? null;
        const expiresSoon = clearanceExpiresSoon(clearance, warningDays, now);
        const blocks = sessionsWith(upcoming, "block");
        const afterExpiry = blocks.filter((check) => expiresSoon && validUntil !== null && daysBetween(validUntil, check.session.scheduledAt) > 0);
        const otherBlocks = blocks.filter((check) => !afterExpiry.includes(check));
        const warns = sessionsWith(upcoming, "warn").filter((check) => !blocks.includes(check));

        if (otherBlocks.length > 0) {
            conflicts.push({
                id: `conflict-${fighter.id}`,
                group: "sessions",
                tone: "danger",
                icon: CalendarX2,
                kind: "Session conflict",
                ...who,
                title: `${pluralize(otherBlocks.length, "upcoming session")} ${otherBlocks.length === 1 ? "conflicts" : "conflict"} with Medical Clearance`,
                detail: firstMessage(otherBlocks, "block"),
                action: sessionAction(otherBlocks, fighter.id),
            });
        }
        if (expiresSoon && validUntil) {
            expiring.push({
                id: `expiring-${fighter.id}`,
                group: "clearance",
                tone: "warning",
                icon: CalendarClock,
                kind: "Clearance expiring",
                ...who,
                title: `${state === "restricted" ? "Restricted clearance" : "Clearance"} expires ${describeDaysUntil(daysRemaining ?? 0)}`,
                detail:
                    afterExpiry.length > 0
                        ? `${pluralize(afterExpiry.length, "session")} booked after ${formatShortDate(validUntil)} will be blocked unless it's renewed`
                        : `Valid until ${formatDate(validUntil)} — the sports doctor renews it`,
                action: afterExpiry.length > 0 ? sessionAction(afterExpiry, fighter.id) : { href: routes.coach.clearance, label: "View clearance" },
            });
        }
        if (warns.length > 0) {
            warnings.push({
                id: `warn-${fighter.id}`,
                group: "sessions",
                tone: "warning",
                icon: ShieldAlert,
                kind: "Clearance check",
                ...who,
                title: `${pluralize(warns.length, "upcoming session")} ${warns.length === 1 ? "needs" : "need"} a clearance check`,
                detail: firstMessage(warns, "warn"),
                action: sessionAction(warns, fighter.id),
            });
        }
    }

    // Every analysis waiting for a coach, low-confidence findings first.
    const reviews: AttentionItem[] = [...reviewQueue]
        .sort((a, b) => b.lowConfidenceFindings - a.lowConfidenceFindings)
        .map(({ analysis, video, fighter, unreviewedFindings, lowConfidenceFindings }) => ({
            id: `ai-${analysis.id}`,
            group: "reviews",
            tone: "ai",
            icon: Sparkles,
            kind: "AI review",
            badges: <AIGeneratedBadge size="sm" />,
            fighterName: fighter.name,
            fighterHref: routes.coach.fighter(fighter.id),
            title:
                lowConfidenceFindings > 0
                    ? `${pluralize(lowConfidenceFindings, "low-confidence finding")} to confirm or correct`
                    : unreviewedFindings > 0
                      ? `${pluralize(unreviewedFindings, "finding")} waiting for your review`
                      : "Analysis waiting for your review",
            detail: `${video.title} · analysed ${formatRelative(analysis.processedAt, now)}`,
            action: { href: routes.coach.video(video.id), label: "Review analysis" },
        }));
    if (reviews.length === 0 && reviewCount > 0) {
        reviews.push({
            id: "ai-summary",
            group: "reviews",
            tone: "ai",
            icon: Sparkles,
            kind: "AI review",
            badges: <AIGeneratedBadge size="sm" />,
            title: `${pluralize(reviewCount, "analysis", "analyses")} waiting for your review`,
            detail: "Confirm or correct the AI findings before fighters see them",
            action: { href: routes.coach.videoAnalysis, label: "Open Film room" },
        });
    }

    const missedItems: AttentionItem[] = missed.map((session) => ({
        id: `missed-${session.id}`,
        group: "sessions",
        tone: "warning",
        icon: CalendarX2,
        kind: "Missed session",
        fighterName: names.get(session.fighterId) ?? "Fighter",
        fighterHref: routes.coach.fighter(session.fighterId),
        title: session.title,
        detail: `${formatWeekdayDate(session.scheduledAt)} · ${TRAINING_TYPE_LABELS[session.type]}`,
        action: { href: routes.coach.session(session.id), label: "View session" },
    }));

    const goalsByFighter = new Map<string, Goal[]>();
    for (const goal of goalsAtRisk) goalsByFighter.set(goal.fighterId, [...(goalsByFighter.get(goal.fighterId) ?? []), goal]);
    const goalItems: AttentionItem[] = [...goalsByFighter.entries()].map(([fighterId, goals]) => ({
        id: `goals-${fighterId}`,
        group: "goals",
        tone: "warning",
        icon: Target,
        kind: goals.length === 1 ? "Goal at risk" : "Goals at risk",
        fighterName: names.get(fighterId) ?? "Fighter",
        fighterHref: routes.coach.fighter(fighterId),
        title: goals.length === 1 ? goals[0].title : `${pluralize(goals.length, "goal")} behind pace`,
        detail:
            goals.length === 1
                ? `${goalProgressPct(goals[0])}% to target · due ${formatShortDate(goals[0].dueDate)}`
                : goals.map((goal) => goal.title).join(" · "),
        action: { href: routes.coach.fighterGoals(fighterId), label: "View goals" },
    }));

    const onboarding = plans ? planItems(roster, plans) : [];

    return [...blocked, ...conflicts, ...expiring, ...noClearance, ...warnings, ...onboarding, ...reviews, ...applicantItems(applicants, now), ...missedItems, ...goalItems];
}
