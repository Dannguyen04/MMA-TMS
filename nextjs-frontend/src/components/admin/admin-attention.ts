import { Gavel, Stethoscope, UserSearch, UsersRound } from "lucide-react";

import type { QueueGroupMeta } from "@/components/dashboard/queue-card";
import type { AttentionItem } from "@/components/medical/attention-list";
import { applicantName, type Application } from "@/lib/domain/admissions";
import type { CareRole } from "@/lib/domain/care-team";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { CareTeamGap } from "@/lib/services/care-team-gaps";

function localeOf(t: Translator): Locale {
    return t.locale === "en" ? "en" : "vi";
}

/**
 * The administrator's Today queue: the hand-offs only an administrator can make, in the order an applicant becomes a
 * fighter who can train. Each item names one person and one verb.
 */
export const ADMIN_QUEUES = ["assessor", "decision", "careTeam"] as const;
export type AdminQueue = (typeof ADMIN_QUEUES)[number];

export function adminQueueMeta(t: Translator): Record<AdminQueue, QueueGroupMeta> {
    return {
        assessor: {
            label: t("adminBody.queue.assessor"),
            icon: UserSearch,
            empty: { title: t("adminBody.queue.assessor.emptyTitle"), description: t("adminBody.queue.assessor.emptyText") },
        },
        decision: {
            label: t("adminBody.queue.decision"),
            icon: Gavel,
            empty: { title: t("adminBody.queue.decision.emptyTitle"), description: t("adminBody.queue.decision.emptyText") },
        },
        careTeam: {
            label: t("adminBody.queue.care"),
            icon: UsersRound,
            empty: { title: t("adminBody.queue.care.emptyTitle"), description: t("adminBody.queue.care.emptyText") },
        },
    };
}

/** What a fighter's missing care team asks of the administrator: the step's title and its button. */
export function careTeamNextStep(missing: readonly CareRole[], t: Translator): { title: string; action: string } | null {
    const coach = missing.includes("coach");
    const doctor = missing.includes("doctor");
    if (coach && doctor) return { title: t("adminBody.care.bothTitle"), action: t("adminBody.care.bothAction") };
    if (doctor) return { title: t("adminBody.care.doctorTitle"), action: t("adminBody.care.doctorAction") };
    if (coach) return { title: t("adminBody.care.coachTitle"), action: t("adminBody.care.coachAction") };
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
    t: Translator;
}

const oldestFirst = (a: { at?: string }, b: { at?: string }) => (a.at ?? "").localeCompare(b.at ?? "");

function careTeamItem(gap: CareTeamGap, now: string, t: Translator): AttentionItem {
    const step = careTeamNextStep(gap.missing, t);
    const doctor = gap.missing.includes("doctor");
    const both = doctor && gap.missing.includes("coach");
    const when = formatRelative(gap.joinedAt, now, localeOf(t));
    return {
        id: `care-${gap.fighterId}`,
        group: "careTeam",
        // Without a sports doctor there's no baseline examination, so the fighter can't train at all.
        tone: doctor ? "warning" : "info",
        icon: doctor ? Stethoscope : UsersRound,
        kind: both ? t("adminBody.care.kindBoth") : doctor ? t("adminBody.care.kindDoctor") : t("adminBody.care.kindCoach"),
        at: gap.joinedAt,
        fighterName: gap.name,
        fighterHref: routes.admin.user(gap.userId),
        title: doctor ? t("adminBody.care.cantTrain") : t("adminBody.care.noPlan"),
        detail: both ? t("adminBody.care.joinedNeedsCoach", { when }) : t("adminBody.care.joined", { when }),
        action: { href: routes.admin.userCareTeam(gap.userId), label: both ? t("adminBody.care.bothQueue") : (step?.action ?? t("adminBody.care.assign")) },
    };
}

/**
 * Most urgent first: fighters who can't train for want of a sports doctor, applicants waiting only on your decision,
 * applicants without an assessing coach, then fighters who only miss a coach. The longest-waiting go first in each.
 */
export function buildAdminAttention({ applications, careTeamGaps, coachName, now, t }: AdminAttentionInput): AttentionItem[] {
    const locale = localeOf(t);
    const decisions: AttentionItem[] = applications
        .filter((application) => application.status === "passed")
        .map((application): AttentionItem => ({
            id: `decision-${application.id}`,
            group: "decision",
            tone: "primary",
            icon: Gavel,
            kind: t("adminBody.decision.kind"),
            at: application.assessment?.assessedAt ?? application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: t("adminBody.decision.title"),
            detail: application.assessment
                ? t("adminBody.decision.assessed", { name: coachName(application.assessment.coachId), when: formatRelative(application.assessment.assessedAt, now, locale) })
                : t("adminBody.decision.applied", { when: formatRelative(application.submittedAt, now, locale) }),
            action: { href: routes.admin.admission(application.id), label: t("adminBody.decision.action") },
        }))
        .sort(oldestFirst);

    const assessors: AttentionItem[] = applications
        .filter((application) => application.status === "submitted" && !application.evaluator)
        .map((application): AttentionItem => ({
            id: `assessor-${application.id}`,
            group: "assessor",
            tone: "info",
            icon: UserSearch,
            kind: t("adminBody.queue.assessor"),
            at: application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: t("adminBody.assessor.title"),
            detail: t("adminBody.assessor.detail", { when: formatRelative(application.submittedAt, now, locale), weight: WEIGHT_CLASS_LABELS[application.applicant.weightClass] }),
            action: { href: routes.admin.admission(application.id), label: t("adminBody.assessor.action") },
        }))
        .sort(oldestFirst);

    const care = (careTeamGaps ?? []).map((gap) => careTeamItem(gap, now, t));
    const noDoctor = care.filter((item) => item.tone === "warning");
    const noCoach = care.filter((item) => item.tone !== "warning");

    return [...noDoctor, ...decisions, ...assessors, ...noCoach];
}
