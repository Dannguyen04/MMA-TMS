import { Gavel, Stethoscope, UserSearch, UsersRound } from "lucide-react";

import type { QueueGroupMeta } from "@/components/dashboard/queue-card";
import type { AttentionItem } from "@/components/medical/attention-list";
import { applicantName, type Application } from "@/lib/domain/admissions";
import type { CareRole } from "@/lib/domain/care-team";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CareTeamGap } from "@/lib/services/care-team-gaps";

/**
 * The administrator's Today queue: the hand-offs only an administrator can make, in the order an applicant becomes a
 * fighter who can train. Each item names one person and one verb.
 */
export const ADMIN_QUEUES = ["assessor", "decision", "careTeam"] as const;
export type AdminQueue = (typeof ADMIN_QUEUES)[number];

export const ADMIN_QUEUE_META: Record<AdminQueue, QueueGroupMeta> = {
    assessor: {
        label: "Needs an assessor",
        icon: UserSearch,
        empty: { title: "Every applicant has an assessor", description: "New applications wait here until you choose a coach to assess them." },
    },
    decision: {
        label: "Awaiting your decision",
        icon: Gavel,
        empty: { title: "No decisions waiting", description: "Applicants who pass their entrance assessment wait here for you to approve or reject them." },
    },
    careTeam: {
        label: "Needs a care team",
        icon: UsersRound,
        empty: { title: "Every fighter has a care team", description: "New fighters wait here until they have a coach and a sports doctor." },
    },
};

/** What a fighter's missing care team asks of the administrator: the step's title and its button. */
export function careTeamNextStep(missing: readonly CareRole[]): { title: string; action: string } | null {
    const coach = missing.includes("coach");
    const doctor = missing.includes("doctor");
    if (coach && doctor) return { title: "Next: assign a coach and a sports doctor", action: "Assign a coach and a sports doctor" };
    if (doctor) return { title: "Next: assign a sports doctor", action: "Assign sports doctor" };
    if (coach) return { title: "Next: assign a coach", action: "Assign coach" };
    return null;
}

export interface AdminAttentionInput {
    applications: Application[];
    /** Fighters missing a coach or a sports doctor; null when the assignments couldn't be read. */
    careTeamGaps: CareTeamGap[] | null;
    /** Names an assessing coach from their coach profile id. */
    coachName: (coachId: string) => string;
    /** Server time (ISO). */
    now: string;
}

const oldestFirst = (a: { at?: string }, b: { at?: string }) => (a.at ?? "").localeCompare(b.at ?? "");

function careTeamItem(gap: CareTeamGap, now: string): AttentionItem {
    const step = careTeamNextStep(gap.missing);
    const doctor = gap.missing.includes("doctor");
    const both = doctor && gap.missing.includes("coach");
    const joined = `Joined ${formatRelative(gap.joinedAt, now)}`;
    return {
        id: `care-${gap.fighterId}`,
        group: "careTeam",
        // Without a sports doctor there's no baseline examination, so the fighter can't train at all.
        tone: doctor ? "warning" : "info",
        icon: doctor ? Stethoscope : UsersRound,
        kind: both ? "No care team" : doctor ? "No sports doctor" : "No coach",
        at: gap.joinedAt,
        fighterName: gap.name,
        fighterHref: routes.admin.user(gap.userId),
        title: doctor ? "Can't train until a sports doctor runs the baseline examination" : "No one plans their training yet",
        detail: both ? `${joined} · needs a coach too` : joined,
        action: { href: routes.admin.userCareTeam(gap.userId), label: both ? "Assign care team" : (step?.action ?? "Assign") },
    };
}

/**
 * Most urgent first: fighters who can't train for want of a sports doctor, applicants waiting only on your decision,
 * applicants without an assessing coach, then fighters who only miss a coach. The longest-waiting go first in each.
 */
export function buildAdminAttention({ applications, careTeamGaps, coachName, now }: AdminAttentionInput): AttentionItem[] {
    const decisions: AttentionItem[] = applications
        .filter((application) => application.status === "passed")
        .map((application): AttentionItem => ({
            id: `decision-${application.id}`,
            group: "decision",
            tone: "primary",
            icon: Gavel,
            kind: "Passed assessment",
            at: application.assessment?.assessedAt ?? application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: "Waiting for you to approve or reject",
            detail: application.assessment
                ? `Assessed by ${coachName(application.assessment.coachId)} ${formatRelative(application.assessment.assessedAt, now)}`
                : `Applied ${formatRelative(application.submittedAt, now)}`,
            action: { href: routes.admin.admission(application.id), label: "Decide" },
        }))
        .sort(oldestFirst);

    const assessors: AttentionItem[] = applications
        .filter((application) => application.status === "submitted" && !application.evaluator)
        .map((application): AttentionItem => ({
            id: `assessor-${application.id}`,
            group: "assessor",
            tone: "info",
            icon: UserSearch,
            kind: "Needs an assessor",
            at: application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: "Choose a coach to run the entrance assessment",
            detail: `Applied ${formatRelative(application.submittedAt, now)} · ${WEIGHT_CLASS_LABELS[application.applicant.weightClass]}`,
            action: { href: routes.admin.admission(application.id), label: "Assign assessor" },
        }))
        .sort(oldestFirst);

    const care = (careTeamGaps ?? []).map((gap) => careTeamItem(gap, now));
    const noDoctor = care.filter((item) => item.tone === "warning");
    const noCoach = care.filter((item) => item.tone !== "warning");

    return [...noDoctor, ...decisions, ...assessors, ...noCoach];
}
