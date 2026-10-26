import { CalendarClock, CalendarX2, ClipboardCheck, ClipboardPlus, Hourglass, ShieldAlert, ShieldQuestion, ShieldX, Sparkles, Target } from "lucide-react";

import { AIGeneratedBadge } from "@/components/domain/status-badges";
import type { AttentionItem } from "@/components/medical/attention-list";
import { applicantName, type Application } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { clearanceExpiresSoon, goalProgressPct } from "@/lib/domain/rules";
import type { Goal, TrainingPlan, TrainingSession } from "@/lib/domain/types";
import { daysBetween, formatDate, formatRelative, formatShortDate, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { ReviewQueueItem } from "@/lib/services/videos";
import type { QueueGroupMeta } from "./queue-card";
import { sessionsWith, type RosterEntry, type SessionCheck } from "./roster-data";

/** The corner queue's groups, in the order the filter shows them. */
export const COACH_QUEUES = ["clearance", "sessions", "onboarding", "reviews", "applicants", "goals"] as const;
export type CoachQueue = (typeof COACH_QUEUES)[number];

const QUEUE_ICONS: Record<CoachQueue, QueueGroupMeta["icon"]> = {
    clearance: ShieldAlert,
    sessions: CalendarX2,
    onboarding: ClipboardPlus,
    reviews: Sparkles,
    applicants: ClipboardCheck,
    goals: Target,
};

/** Each group's filter label, icon and empty state, in the viewer's language. */
export function coachQueueMeta(t: Translator): Record<CoachQueue, QueueGroupMeta> {
    const meta = (queue: CoachQueue): QueueGroupMeta => ({
        label: t(`coachQueue.${queue}`),
        icon: QUEUE_ICONS[queue],
        empty: { title: t(`coachQueue.${queue}.emptyTitle`), description: t(`coachQueue.${queue}.emptyText`) },
    });
    return Object.fromEntries(COACH_QUEUES.map((queue) => [queue, meta(queue)])) as Record<CoachQueue, QueueGroupMeta>;
}

export const COACH_QUEUE_META: Record<CoachQueue, QueueGroupMeta> = coachQueueMeta(createTranslator("en"));

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
    /** The viewer's language; English when omitted. */
    t?: Translator;
    locale?: Locale;
}

/** Roster sessions filtered to one fighter. */
export function fighterSessionsHref(fighterId: string): string {
    return hrefWith(routes.coach.sessions, {}, { fighter: fighterId });
}

function firstMessage(checks: SessionCheck[], severity: "block" | "warn"): string {
    return checks[0]?.conflicts.find((conflict) => conflict.severity === severity)?.message ?? "";
}

function sessionAction(t: Translator, checks: SessionCheck[], fighterId: string): AttentionItem["action"] {
    return checks.length === 1
        ? { href: routes.coach.session(checks[0].session.id), label: t("attention.action.reviewSession") }
        : { href: fighterSessionsHref(fighterId), label: t("attention.action.reviewSessions") };
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
function describeDays(t: Translator, days: number): string {
    if (days === 0) return t("time.today");
    if (days === 1) return t("time.tomorrow");
    if (days === -1) return t("time.yesterday");
    return days > 0 ? plural(t, "time.inDays", days) : plural(t, "time.daysAgo", -days);
}

/** Fighters the sports doctor cleared to train who have no active plan: the coach's next step after clearance. */
function planItems(t: Translator, roster: RosterEntry[], plans: TrainingPlan[]): AttentionItem[] {
    return roster.flatMap(({ fighter, clearanceState }) => {
        if (clearanceState !== "full" && clearanceState !== "restricted") return [];
        const own = plans.filter((plan) => plan.fighterId === fighter.id);
        if (own.some((plan) => plan.status === "active")) return [];
        const draft = own.filter((plan) => plan.status === "draft").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const restricted = t(clearanceState === "restricted" ? "attention.plan.restricted" : "attention.plan.cleared");
        return [
            {
                id: `plan-${fighter.id}`,
                group: "onboarding",
                tone: "info",
                icon: ClipboardPlus,
                kind: t(draft ? "attention.kind.draftPlan" : own.length === 0 ? "attention.kind.noPlanYet" : "attention.kind.noActivePlan"),
                fighterName: fighter.name,
                fighterHref: routes.coach.fighter(fighter.id),
                title: t(draft ? "attention.plan.draftTitle" : own.length === 0 ? "attention.plan.noPlanTitle" : "attention.plan.noActiveTitle"),
                detail: draft ? t("attention.plan.draftDetail", { title: draft.title }) : restricted,
                action: draft
                    ? { href: routes.coach.plan(draft.id), label: t("attention.action.finishPlan") }
                    : { href: hrefWith(routes.coach.newPlan, {}, { fighter: fighter.id }), label: t("attention.action.buildPlan") },
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
    t = createTranslator("en"),
    locale = "en",
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
                kind: t(reviewPending ? "attention.kind.medicalReview" : state === "expired" ? "attention.kind.clearanceExpired" : "attention.kind.notCleared"),
                ...who,
                title:
                    scheduled > 0
                        ? plural(t, "attention.blocked.stillScheduled", scheduled)
                        : t(reviewPending ? "attention.blocked.reviewPending" : state === "expired" ? "attention.blocked.expired" : "attention.blocked.notCleared"),
                detail:
                    scheduled > 0
                        ? t(reviewPending ? "attention.blocked.waitsForDoctor" : "attention.blocked.needsClearance")
                        : cancelled > 0
                          ? plural(t, "attention.blocked.cancelled", cancelled)
                          : t(reviewPending ? "attention.blocked.resumesAfterReview" : "attention.blocked.doctorOnly"),
                action:
                    scheduled > 0
                        ? { href: fighterSessionsHref(fighter.id), label: t("attention.action.reviewSessions") }
                        : { href: routes.coach.clearance, label: t("attention.action.viewClearance") },
            });
            continue;
        }

        if (state === "none") {
            noClearance.push({
                id: `none-${fighter.id}`,
                group: "clearance",
                tone: "warning",
                icon: ShieldQuestion,
                kind: t("attention.kind.noClearance"),
                ...who,
                title: upcoming.length > 0 ? plural(t, "attention.none.uncheckable", upcoming.length) : t("attention.none.noClearance"),
                detail: t("attention.none.detail"),
                action: { href: routes.coach.clearance, label: t("attention.action.viewClearance") },
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
                kind: t("attention.kind.sessionConflict"),
                ...who,
                title: plural(t, "attention.conflict.title", otherBlocks.length),
                detail: firstMessage(otherBlocks, "block"),
                action: sessionAction(t, otherBlocks, fighter.id),
            });
        }
        if (expiresSoon && validUntil) {
            expiring.push({
                id: `expiring-${fighter.id}`,
                group: "clearance",
                tone: "warning",
                icon: CalendarClock,
                kind: t("attention.kind.clearanceExpiring"),
                ...who,
                title: t(state === "restricted" ? "attention.expiring.restricted" : "attention.expiring.full", { when: describeDays(t, daysRemaining ?? 0) }),
                detail:
                    afterExpiry.length > 0
                        ? plural(t, "attention.expiring.blockedAfter", afterExpiry.length, { date: formatShortDate(validUntil, locale) })
                        : t("attention.expiring.validUntil", { date: formatDate(validUntil, locale) }),
                action:
                    afterExpiry.length > 0
                        ? sessionAction(t, afterExpiry, fighter.id)
                        : { href: routes.coach.clearance, label: t("attention.action.viewClearance") },
            });
        }
        if (warns.length > 0) {
            warnings.push({
                id: `warn-${fighter.id}`,
                group: "sessions",
                tone: "warning",
                icon: ShieldAlert,
                kind: t("attention.kind.clearanceCheck"),
                ...who,
                title: plural(t, "attention.warn.title", warns.length),
                detail: firstMessage(warns, "warn"),
                action: sessionAction(t, warns, fighter.id),
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
            kind: t("attention.kind.aiReview"),
            badges: <AIGeneratedBadge size="sm" />,
            fighterName: fighter.name,
            fighterHref: routes.coach.fighter(fighter.id),
            title:
                lowConfidenceFindings > 0
                    ? plural(t, "attention.review.lowConfidence", lowConfidenceFindings)
                    : unreviewedFindings > 0
                      ? plural(t, "attention.review.unreviewed", unreviewedFindings)
                      : t("attention.review.waiting"),
            detail: t("attention.review.detail", { video: video.title, when: formatRelative(analysis.processedAt, now, locale) }),
            action: { href: routes.coach.video(video.id), label: t("attention.action.reviewAnalysis") },
        }));
    if (reviews.length === 0 && reviewCount > 0) {
        reviews.push({
            id: "ai-summary",
            group: "reviews",
            tone: "ai",
            icon: Sparkles,
            kind: t("attention.kind.aiReview"),
            badges: <AIGeneratedBadge size="sm" />,
            title: plural(t, "attention.review.summary", reviewCount),
            detail: t("attention.review.summaryDetail"),
            action: { href: routes.coach.videoAnalysis, label: t("attention.action.openFilmRoom") },
        });
    }

    const missedItems: AttentionItem[] = missed.map((session) => ({
        id: `missed-${session.id}`,
        group: "sessions",
        tone: "warning",
        icon: CalendarX2,
        kind: t("attention.kind.missedSession"),
        fighterName: names.get(session.fighterId) ?? t("attention.fighterFallback"),
        fighterHref: routes.coach.fighter(session.fighterId),
        title: session.title,
        detail: `${formatWeekdayDate(session.scheduledAt, locale)} · ${t(`trainingType.${session.type}`)}`,
        action: { href: routes.coach.session(session.id), label: t("attention.action.viewSession") },
    }));

    const goalsByFighter = new Map<string, Goal[]>();
    for (const goal of goalsAtRisk) goalsByFighter.set(goal.fighterId, [...(goalsByFighter.get(goal.fighterId) ?? []), goal]);
    const goalItems: AttentionItem[] = [...goalsByFighter.entries()].map(([fighterId, goals]) => ({
        id: `goals-${fighterId}`,
        group: "goals",
        tone: "warning",
        icon: Target,
        kind: t(goals.length === 1 ? "attention.kind.goalAtRisk" : "attention.kind.goalsAtRisk"),
        fighterName: names.get(fighterId) ?? t("attention.fighterFallback"),
        fighterHref: routes.coach.fighter(fighterId),
        title: goals.length === 1 ? goals[0].title : t("attention.goals.behind", { n: goals.length }),
        detail:
            goals.length === 1
                ? t("attention.goals.detail", { pct: goalProgressPct(goals[0]), date: formatShortDate(goals[0].dueDate, locale) })
                : goals.map((goal) => goal.title).join(" · "),
        action: { href: routes.coach.fighterGoals(fighterId), label: t("attention.action.viewGoals") },
    }));

    const onboarding = plans ? planItems(t, roster, plans) : [];

    return [...blocked, ...conflicts, ...expiring, ...noClearance, ...warnings, ...onboarding, ...reviews, ...applicantItems(applicants, now), ...missedItems, ...goalItems];
}
