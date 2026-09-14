import { CalendarClock, CalendarX2, ShieldAlert, ShieldQuestion, ShieldX, Sparkles, Target } from "lucide-react";

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

export interface CoachAttentionInput {
    roster: RosterEntry[];
    /** Every roster session this week, all statuses. */
    weekSessions: TrainingSession[];
    reviewQueue: ReviewQueueItem[];
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
 * The coach's prioritised to-do list: fighters who must not train, sessions that conflict with
 * Medical Clearance, lapsing clearances, AI findings that need a human, missed sessions and goals at risk.
 */
export function buildCoachAttention({ roster, weekSessions, reviewQueue, missed, goalsAtRisk, warningDays, now }: CoachAttentionInput): AttentionItem[] {
    const blocked: AttentionItem[] = [];
    const conflicts: AttentionItem[] = [];
    const expiring: AttentionItem[] = [];
    const noClearance: AttentionItem[] = [];
    const warnings: AttentionItem[] = [];
    const names = new Map(roster.map((entry) => [entry.fighter.id, entry.fighter.name]));

    for (const { fighter, clearance, clearanceState: state, daysRemaining, upcoming } of roster) {
        const who = { fighterName: fighter.name, fighterHref: routes.coach.fighter(fighter.id) };

        if (state === "not_cleared" || state === "expired") {
            const scheduled = upcoming.length;
            const cancelled = weekSessions.filter((session) => session.fighterId === fighter.id && session.status === "cancelled").length;
            blocked.push({
                id: `blocked-${fighter.id}`,
                tone: "danger",
                icon: ShieldX,
                kind: state === "expired" ? "Clearance expired" : "Not cleared",
                ...who,
                title:
                    scheduled > 0
                        ? `${pluralize(scheduled, "session")} still scheduled — cancel or reschedule`
                        : state === "expired"
                          ? "Training is blocked until a sports doctor renews the clearance"
                          : "No training until the sports doctor clears them",
                detail:
                    scheduled > 0
                        ? "Training isn't permitted without a valid clearance"
                        : cancelled > 0
                          ? `${pluralize(cancelled, "session")} cancelled this week`
                          : "Only the sports doctor can change this",
                action: scheduled > 0 ? { href: fighterSessionsHref(fighter.id), label: "Review sessions" } : { href: routes.coach.clearance, label: "View clearance" },
            });
            continue;
        }

        if (state === "none") {
            noClearance.push({
                id: `none-${fighter.id}`,
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

    const ai: AttentionItem[] = reviewQueue
        .filter((item) => item.lowConfidenceFindings > 0)
        .map(({ analysis, video, fighter, lowConfidenceFindings }) => ({
            id: `ai-${analysis.id}`,
            tone: "ai",
            icon: Sparkles,
            kind: "AI review",
            badges: <AIGeneratedBadge size="sm" />,
            fighterName: fighter.name,
            fighterHref: routes.coach.fighter(fighter.id),
            title: `${pluralize(lowConfidenceFindings, "low-confidence finding")} to confirm or correct`,
            detail: `${video.title} · analysed ${formatRelative(analysis.processedAt, now)}`,
            action: { href: routes.coach.video(video.id), label: "Review analysis" },
        }));

    const missedItems: AttentionItem[] = missed.map((session) => ({
        id: `missed-${session.id}`,
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

    return [...blocked, ...conflicts, ...expiring, ...noClearance, ...warnings, ...ai, ...missedItems, ...goalItems];
}
