import { Gavel, Stethoscope, UserSearch, UsersRound } from "lucide-react";

import type { QueueGroupMeta } from "@/components/dashboard/queue-card";
import type { AttentionItem } from "@/components/medical/attention-list";
import { applicantName, type Application } from "@/lib/domain/admissions";
import type { CareRole } from "@/lib/domain/care-team";
import { weightClassLabel } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { CareTeamGap } from "@/lib/services/care-team-gaps";

/**
 * The administrator's Today queue: the hand-offs only an administrator can make, in the order an applicant becomes a
 * fighter who can train. Each item names one person and one verb.
 */
export const ADMIN_QUEUES = ["assessor", "decision", "careTeam"] as const;
export type AdminQueue = (typeof ADMIN_QUEUES)[number];

const EN = createTranslator("en");

/** Each queue's filter label and empty state, in the viewer's language. */
export function adminQueueMeta(t: Translator = EN): Record<AdminQueue, QueueGroupMeta> {
    return {
        assessor: {
            label: t("screens.admin.queue.assessor.label"),
            icon: UserSearch,
            empty: { title: t("screens.admin.queue.assessor.emptyTitle"), description: t("screens.admin.queue.assessor.emptyDescription") },
        },
        decision: {
            label: t("screens.admin.queue.decision.label"),
            icon: Gavel,
            empty: { title: t("screens.admin.queue.decision.emptyTitle"), description: t("screens.admin.queue.decision.emptyDescription") },
        },
        careTeam: {
            label: t("screens.admin.queue.careTeam.label"),
            icon: UsersRound,
            empty: { title: t("screens.admin.queue.careTeam.emptyTitle"), description: t("screens.admin.queue.careTeam.emptyDescription") },
        },
    };
}

/** What a fighter's missing care team asks of the administrator: the step's title and its button. */
export function careTeamNextStep(missing: readonly CareRole[], t: Translator = EN): { title: string; action: string } | null {
    const coach = missing.includes("coach");
    const doctor = missing.includes("doctor");
    if (coach && doctor) return { title: t("screens.admin.nextStep.both.title"), action: t("screens.admin.nextStep.both.action") };
    if (doctor) return { title: t("screens.admin.nextStep.doctor.title"), action: t("screens.admin.nextStep.doctor.action") };
    if (coach) return { title: t("screens.admin.nextStep.coach.title"), action: t("screens.admin.nextStep.coach.action") };
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
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

const oldestFirst = (a: { at?: string }, b: { at?: string }) => (a.at ?? "").localeCompare(b.at ?? "");

function careTeamItem(gap: CareTeamGap, now: string, locale: Locale, t: Translator): AttentionItem {
    const step = careTeamNextStep(gap.missing, t);
    const doctor = gap.missing.includes("doctor");
    const both = doctor && gap.missing.includes("coach");
    const joined = t("screens.admin.attention.joined", { when: formatRelative(gap.joinedAt, now, locale) });
    return {
        id: `care-${gap.fighterId}`,
        group: "careTeam",
        // Without a sports doctor there's no baseline examination, so the fighter can't train at all.
        tone: doctor ? "warning" : "info",
        icon: doctor ? Stethoscope : UsersRound,
        kind: both ? t("screens.admin.attention.kind.noCareTeam") : doctor ? t("screens.admin.attention.kind.noDoctor") : t("screens.admin.attention.kind.noCoach"),
        at: gap.joinedAt,
        fighterName: gap.name,
        fighterHref: routes.admin.user(gap.userId),
        title: doctor ? t("screens.admin.attention.title.noDoctor") : t("screens.admin.attention.title.noCoach"),
        detail: both ? t("screens.admin.attention.needsCoachToo", { joined }) : joined,
        action: {
            href: routes.admin.userCareTeam(gap.userId),
            label: both ? t("screens.admin.attention.action.careTeam") : (step?.action ?? t("screens.admin.attention.action.assign")),
        },
    };
}

/**
 * Most urgent first: fighters who can't train for want of a sports doctor, applicants waiting only on your decision,
 * applicants without an assessing coach, then fighters who only miss a coach. The longest-waiting go first in each.
 */
export function buildAdminAttention({ applications, careTeamGaps, coachName, now, locale = "en" }: AdminAttentionInput): AttentionItem[] {
    const t = createTranslator(locale);
    const relative = (iso: string) => formatRelative(iso, now, locale);
    const decisions: AttentionItem[] = applications
        .filter((application) => application.status === "passed")
        .map((application): AttentionItem => ({
            id: `decision-${application.id}`,
            group: "decision",
            tone: "primary",
            icon: Gavel,
            kind: t("screens.admin.attention.kind.passed"),
            at: application.assessment?.assessedAt ?? application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: t("screens.admin.attention.title.decision"),
            detail: application.assessment
                ? t("screens.admin.attention.assessedBy", { coach: coachName(application.assessment.coachId), when: relative(application.assessment.assessedAt) })
                : t("screens.admin.attention.applied", { when: relative(application.submittedAt) }),
            action: { href: routes.admin.admission(application.id), label: t("screens.admin.attention.action.decide") },
        }))
        .sort(oldestFirst);

    const assessors: AttentionItem[] = applications
        .filter((application) => application.status === "submitted" && !application.evaluator)
        .map((application): AttentionItem => ({
            id: `assessor-${application.id}`,
            group: "assessor",
            tone: "info",
            icon: UserSearch,
            kind: t("screens.admin.attention.kind.needsAssessor"),
            at: application.submittedAt,
            fighterName: applicantName(application.applicant),
            fighterHref: routes.admin.admission(application.id),
            title: t("screens.admin.attention.title.assessor"),
            detail: t("screens.admin.attention.appliedWeightClass", {
                when: relative(application.submittedAt),
                weightClass: weightClassLabel(application.applicant.weightClass, locale),
            }),
            action: { href: routes.admin.admission(application.id), label: t("screens.admin.attention.action.assessor") },
        }))
        .sort(oldestFirst);

    const care = (careTeamGaps ?? []).map((gap) => careTeamItem(gap, now, locale, t));
    const noDoctor = care.filter((item) => item.tone === "warning");
    const noCoach = care.filter((item) => item.tone !== "warning");

    return [...noDoctor, ...decisions, ...assessors, ...noCoach];
}
