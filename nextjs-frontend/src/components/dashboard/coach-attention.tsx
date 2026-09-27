import { CalendarClock, CalendarX2, Hourglass, ShieldAlert, ShieldQuestion, ShieldX, Sparkles, Target, type LucideIcon } from "lucide-react";

import { describeDaysUntil } from "@/components/domain/domain-format";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import type { AttentionItem } from "@/components/medical/attention-list";
import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceExpiresSoon, goalProgressPct } from "@/lib/domain/rules";
import type { Goal, TrainingSession } from "@/lib/domain/types";
import { daysBetween, formatDate, formatRelative, formatShortDate, formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { ReviewQueueItem } from "@/lib/services/videos";
import { sessionsWith, type RosterEntry, type SessionCheck } from "./roster-data";

/** The corner queue's groups, in the order the filter shows them. */
export const COACH_QUEUES = ["clearance", "sessions", "reviews", "goals"] as const;
export type CoachQueue = (typeof COACH_QUEUES)[number];

export const COACH_QUEUE_META: Record<CoachQueue, { label: string; icon: LucideIcon; empty: { title: string; description: string } }> = {
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
    reviews: {
        label: "Reviews",
        icon: Sparkles,
        empty: { title: "No analyses to review", description: "Every AI analysis on your roster has your review." },
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

/**
 * The coach's corner queue, most urgent first: fighters who must not train, sessions that clash with Medical
 * Clearance, lapsing clearances, AI analyses waiting for a human, missed sessions and goals at risk. Each item
 * is filed under one {@link CoachQueue} so the page can filter it.
 */
export function buildCoachAttention({ roster, weekSessions, reviewQueue, reviewCount = 0, missed, goalsAtRisk, warningDays, now }: CoachAttentionInput): AttentionItem[] {
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

    return [...blocked, ...conflicts, ...expiring, ...noClearance, ...warnings, ...reviews, ...missedItems, ...goalItems];
}
