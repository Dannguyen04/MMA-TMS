import { CalendarClock, Hourglass, Radar, ShieldAlert, ShieldQuestion, ShieldX } from "lucide-react";

import { clinicalLinks } from "@/components/clinical/clinical-links";
import type { QueueGroupMeta } from "@/components/dashboard/queue-card";
import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { AIGeneratedBadge, ConfidenceBadge } from "@/components/domain/status-badges";
import { REQUESTER_ROLE_LABELS } from "@/lib/domain/medical-contract";
import { BODY_REGION_LABELS, examinationTitle, injuryTypeName } from "@/lib/domain/labels";
import { daysBetween, formatDate, formatRelative, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { DoctorOverview, FighterHealthSummary } from "@/lib/services/medical";
import type { AttentionItem } from "./attention-list";
import { followUpExaminationHref } from "./follow-up-list";
import { sortTriage } from "./triage-sort";

/** The triage queue's groups, in the order the filter shows them. */
export const TRIAGE_QUEUES = ["clearance", "reviews", "follow-ups", "observations"] as const;
export type TriageQueue = (typeof TRIAGE_QUEUES)[number];

export const TRIAGE_QUEUE_META: Record<TriageQueue, QueueGroupMeta> = {
    clearance: {
        label: "Clearance",
        icon: ShieldAlert,
        empty: { title: "Every clearance is in order", description: "No one is blocked, waiting for a clearance or about to lose one." },
    },
    reviews: {
        label: "Requests",
        icon: Hourglass,
        empty: { title: "No review requests", description: "Fighters and coaches haven't asked for a medical review." },
    },
    "follow-ups": {
        label: "Follow-ups",
        icon: CalendarClock,
        empty: { title: "No follow-ups due", description: "No follow-up examination is due this week or overdue." },
    },
    observations: {
        label: "Observations",
        icon: Radar,
        empty: { title: "No new AI observations", description: "Nothing from video analysis is waiting for your review." },
    },
};

/** Bouts this close make the pre-fight medical the right next step for an expiring clearance. */
const PRE_FIGHT_WINDOW_DAYS = 30;

export interface TriageInput {
    overview: DoctorOverview;
    summaries: FighterHealthSummary[];
    now: string;
    /** API mode: examinations are recorded per scope (training or competition) rather than by demo type. */
    serviceForms: boolean;
}

/**
 * Everything waiting for the sports doctor, most urgent first (see `sortTriage`): review requests and fighters who
 * can't train, clearance gaps and lapsing clearances, follow-ups and new AI observations.
 */
export function buildTriageQueue({ overview, summaries, now, serviceForms }: TriageInput): AttentionItem[] {
    const items: AttentionItem[] = [];
    const profile = (fighterId: string) => routes.doctor.fighter(fighterId);
    const grant = clinicalLinks.grantClearanceFor;
    const examine = (fighterId: string, kind: "baseline" | "pre_fight" | "review") =>
        serviceForms
            ? hrefWith(routes.doctor.newExamination, {}, { fighter: fighterId, scope: kind === "pre_fight" ? "COMPETITION" : "TRAINING" })
            : hrefWith(routes.doctor.newExamination, {}, { fighter: fighterId, type: kind === "review" ? "routine" : kind });

    for (const summary of summaries) {
        const { fighter, clearance, clearanceState, openReviewRequests: requests } = summary;
        const who = { fighterName: fighter.name, fighterHref: profile(fighter.id) };

        if (requests.length > 0) {
            const [oldest] = requests;
            items.push({
                id: `review-${fighter.id}`,
                group: "reviews",
                at: oldest.requestedAt,
                tone: "danger",
                icon: Hourglass,
                kind: requests.length === 1 ? "Review requested" : "Reviews requested",
                ...who,
                title: requests.length === 1 ? `“${oldest.reason}”` : `${pluralize(requests.length, "review request")} waiting — training is paused`,
                detail: `${REQUESTER_ROLE_LABELS[oldest.requesterRole]} · asked ${formatRelative(oldest.requestedAt, now)}${requests.length === 1 ? " · training is paused" : ""}`,
                action: { href: examine(fighter.id, "review"), label: "Examine" },
            });
        }

        // A pending review pauses training on its own; list "not cleared" only when a decision says so.
        const decidedNotCleared =
            clearance?.status === "revoked" || clearance?.level === "not_cleared" || summary.latestExamination?.outcome === "unfit";
        if (clearanceState !== "not_cleared" || (requests.length > 0 && !decidedNotCleared)) continue;
        const injury = summary.activeInjuries[0];
        const since =
            clearance?.status === "revoked"
                ? { at: clearance.revokedAt ?? clearance.issuedAt, text: `Clearance revoked ${formatDate(clearance.revokedAt ?? clearance.issuedAt)}` }
                : clearance?.level === "not_cleared"
                  ? { at: clearance.issuedAt, text: `Not cleared since ${formatDate(clearance.issuedAt)}` }
                  : summary.latestExamination
                    ? { at: summary.latestExamination.date, text: `Found not eligible on ${formatDate(summary.latestExamination.date)}` }
                    : { at: undefined, text: "Training is paused" };
        items.push({
            id: `not-cleared-${fighter.id}`,
            group: "clearance",
            at: since.at,
            tone: "danger",
            icon: ShieldX,
            kind: "Not cleared",
            ...who,
            title: injury
                ? `No training permitted — ${injuryTypeName(injury).toLowerCase()} (${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()})`
                : "No training permitted until re-examined",
            detail: since.text,
            action: { href: profile(fighter.id), label: "Review patient" },
        });
    }

    for (const { fighter, state } of overview.fightersWithoutClearance) {
        const summary = summaries.find((s) => s.fighter.id === fighter.id);
        const who = { fighterName: fighter.name, fighterHref: profile(fighter.id) };
        if (state === "expired") {
            const lapsed = summary?.clearance?.validUntil ?? undefined;
            items.push({
                id: `expired-${fighter.id}`,
                group: "clearance",
                at: lapsed,
                tone: "danger",
                icon: ShieldX,
                kind: "Clearance expired",
                ...who,
                title: "Training is blocked until the clearance is renewed",
                detail: lapsed ? `Expired ${describeDaysUntil(daysBetween(now, lapsed))}` : "Expired",
                action: serviceForms ? { href: examine(fighter.id, "baseline"), label: "Re-examine" } : { href: grant(fighter.id), label: "Renew clearance" },
            });
        } else {
            const examined = Boolean(summary?.latestExamination);
            items.push({
                id: `none-${fighter.id}`,
                group: "clearance",
                tone: "warning",
                icon: ShieldQuestion,
                kind: "No clearance",
                ...who,
                title: "No Medical Clearance on file — coaches can't check training against it",
                detail: examined ? "Examined, clearance not yet issued" : `Joined ${formatRelative(fighter.joinedAt, now)} · no examinations yet`,
                action: examined
                    ? { href: grant(fighter.id), label: "Issue clearance" }
                    : { href: examine(fighter.id, "baseline"), label: serviceForms ? "Record examination" : "Start baseline exam" },
            });
        }
    }

    for (const { fighter, clearance, daysRemaining } of overview.expiringClearances) {
        const bout = fighter.upcomingBout;
        const boutSoon = bout !== null && daysBetween(now, bout.date) <= PRE_FIGHT_WINDOW_DAYS;
        items.push({
            id: `expiring-${fighter.id}`,
            group: "clearance",
            at: clearance.validUntil ?? undefined,
            tone: "warning",
            icon: CalendarClock,
            kind: "Clearance expiring",
            fighterName: fighter.name,
            fighterHref: profile(fighter.id),
            title: `${clearance.level === "restricted" ? "Restricted clearance" : "Full clearance"} expires ${describeDaysUntil(daysRemaining)}`,
            detail: boutSoon && bout ? `Fights ${describeDaysUntil(daysBetween(now, bout.date))} — pre-fight medical due` : `Valid until ${formatDate(clearance.validUntil ?? now)}`,
            action: boutSoon
                ? { href: examine(fighter.id, "pre_fight"), label: "Start pre-fight medical" }
                : serviceForms
                  ? { href: examine(fighter.id, "baseline"), label: "Re-examine" }
                  : { href: grant(fighter.id), label: "Renew clearance" },
        });
    }

    for (const followUp of overview.followUpsDue) {
        const overdue = followUp.daysUntil < 0;
        items.push({
            id: `follow-up-${followUp.examination.id}`,
            group: "follow-ups",
            at: followUp.date,
            tone: overdue ? "danger" : "info",
            icon: CalendarClock,
            kind: overdue ? "Follow-up overdue" : "Follow-up due",
            fighterName: followUp.fighter.name,
            fighterHref: profile(followUp.fighter.id),
            title: overdue
                ? `Follow-up examination overdue by ${pluralize(-followUp.daysUntil, "day")}`
                : `${capitalize(describeDaysUntil(followUp.daysUntil))}: follow-up examination`,
            detail: `Set at the ${examinationTitle(followUp.examination).toLowerCase()} on ${formatDate(followUp.examination.date)}`,
            action: { href: followUpExaminationHref(followUp), label: "Start examination" },
        });
    }

    for (const { alert, fighter } of overview.newAlerts) {
        items.push({
            id: `alert-${alert.id}`,
            group: "observations",
            at: alert.detectedAt,
            tone: "ai",
            icon: Radar,
            kind: "AI observation",
            badges: (
                <>
                    <AIGeneratedBadge size="sm" />
                    <ConfidenceBadge confidence={alert.confidence} size="sm" />
                </>
            ),
            fighterName: fighter.name,
            fighterHref: profile(fighter.id),
            title: alert.pattern,
            detail: `${BODY_REGION_LABELS[alert.bodyRegion]} · observed ${formatRelative(alert.detectedAt, now)}`,
            action: { href: routes.doctor.aiAlert(alert.id), label: "Review observation" },
        });
    }

    return sortTriage(items);
}
