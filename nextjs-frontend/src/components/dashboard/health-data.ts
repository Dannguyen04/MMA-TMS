import "server-only";

import { Activity, Bandage, CircleCheck, ShieldAlert, ShieldBan, ShieldCheck, ShieldX, Stethoscope } from "lucide-react";

import type { ActivityTimelineItem } from "@/components/domain/activity-timeline";
import type { BodyMapHighlight } from "@/components/domain/body-map";
import { INJURY_STATUS_META } from "@/components/domain/status-badges";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import {
    CLEARANCE_LEVEL_LABELS,
    EXAMINATION_OUTCOME_LABELS,
    EXAMINATION_TYPE_LABELS,
    INJURY_STATUS_LABELS,
    INJURY_TYPE_LABELS,
    TREATMENT_TYPE_LABELS,
} from "@/lib/domain/labels";
import type { Fighter, Injury, MedicalClearance, MedicalExamination, Treatment } from "@/lib/domain/types";
import { daysBetween, formatDate, formatMonthYear } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getMedicalRecord } from "@/lib/services/medical";
import { coachesForFighter, doctorsForFighter, getUser } from "@/lib/services/people";
import type { CareTeamMember } from "./care-team-card";

const BODY_MAP_WINDOW_DAYS = 365;

/** Assigned sports doctors and coaches with their account titles, primary contacts flagged. */
export async function loadCareTeam(fighter: Fighter): Promise<CareTeamMember[]> {
    const [doctors, coaches, record] = await Promise.all([doctorsForFighter(fighter.id), coachesForFighter(fighter.id), getMedicalRecord(fighter.id)]);
    const people = [
        ...doctors.map((doctor) => ({ profile: doctor, role: "doctor" as const, primary: doctor.id === record?.primaryDoctorId })),
        ...coaches.map((coach) => ({ profile: coach, role: "coach" as const, primary: coach.id === fighter.primaryCoachId })),
    ];
    const users = await Promise.all(people.map((person) => getUser(person.profile.userId)));
    return people.map(({ profile, role, primary }, index) => ({
        id: profile.id,
        name: profile.name,
        specialty: profile.specialty,
        role,
        primary,
        title: users[index]?.title ?? (role === "doctor" ? "Sports doctor" : "Coach"),
    }));
}

/** Open injuries plus those resolved in the last 12 months, for the fighter's body map. */
export function injuryHighlights(injuries: Injury[], now: string): BodyMapHighlight[] {
    return injuries
        .filter((injury) => injury.status !== "resolved" || (injury.resolvedAt !== null && daysBetween(injury.resolvedAt, now) <= BODY_MAP_WINDOW_DAYS))
        .map((injury) => ({
            region: injury.bodyRegion,
            tone: INJURY_STATUS_META[injury.status].tone,
            label:
                injury.status === "resolved" && injury.resolvedAt
                    ? `${INJURY_TYPE_LABELS[injury.type]} · resolved ${formatMonthYear(injury.resolvedAt)}`
                    : `${INJURY_TYPE_LABELS[injury.type]} · ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}`,
        }));
}

export interface MedicalHistoryInput {
    examinations: MedicalExamination[];
    injuries: Injury[];
    treatments: Treatment[];
    clearances: MedicalClearance[];
    doctorNames: Map<string, string>;
}

/** One timeline of the fighter's own medical events, newest first. Examinations, injuries, treatments and clearance decisions stay distinct. */
export function medicalHistoryItems({ examinations, injuries, treatments, clearances, doctorNames }: MedicalHistoryInput): ActivityTimelineItem[] {
    const doctor = (id: string) => doctorNames.get(id) ?? "Sports doctor";
    const injuryById = new Map(injuries.map((injury) => [injury.id, injury]));
    const items: ActivityTimelineItem[] = [];

    for (const exam of examinations) {
        items.push({
            id: `exam-${exam.id}`,
            icon: Stethoscope,
            tone: exam.outcome === "fit" ? "success" : exam.outcome === "fit_with_restrictions" ? "warning" : "danger",
            title: `${EXAMINATION_TYPE_LABELS[exam.type]} — ${EXAMINATION_OUTCOME_LABELS[exam.outcome]}`,
            description: `Examination · ${formatDate(exam.date)} · ${doctor(exam.doctorId)}`,
            time: exam.date,
        });
    }

    for (const injury of injuries) {
        items.push({
            id: `injury-${injury.id}`,
            icon: Bandage,
            tone: "danger",
            title: `Injury recorded: ${injuryTitle(injury)}`,
            description: `Injury · ${formatDate(injury.occurredAt)} · recorded by ${doctor(injury.recordedById)}`,
            time: injury.occurredAt,
            href: routes.fighter.injury(injury.id),
        });
        if (injury.resolvedAt) {
            items.push({
                id: `injury-resolved-${injury.id}`,
                icon: CircleCheck,
                tone: "success",
                title: `Injury resolved: ${injuryTitle(injury)}`,
                description: `Injury · ${formatDate(injury.resolvedAt)}`,
                time: injury.resolvedAt,
                href: routes.fighter.injury(injury.id),
            });
        }
    }

    for (const treatment of treatments) {
        const injury = injuryById.get(treatment.injuryId);
        const context = injury ? ` for ${injuryTitle(injury).toLowerCase()}` : "";
        items.push({
            id: `treatment-${treatment.id}`,
            icon: Activity,
            tone: "info",
            title: `Treatment started: ${TREATMENT_TYPE_LABELS[treatment.type]}`,
            description: `Treatment${context} · ${formatDate(treatment.startDate)} · ${treatment.providerName}`,
            time: treatment.startDate,
            href: injury ? routes.fighter.injury(injury.id) : undefined,
        });
        if (treatment.status === "completed" && treatment.endDate) {
            items.push({
                id: `treatment-done-${treatment.id}`,
                icon: CircleCheck,
                tone: "neutral",
                title: `Treatment completed: ${TREATMENT_TYPE_LABELS[treatment.type]}`,
                description: `Treatment${context} · ${formatDate(treatment.endDate)}`,
                time: treatment.endDate,
                href: injury ? routes.fighter.injury(injury.id) : undefined,
            });
        }
    }

    for (const clearance of clearances) {
        items.push({
            id: `clearance-${clearance.id}`,
            icon: clearance.level === "full" ? ShieldCheck : clearance.level === "restricted" ? ShieldAlert : ShieldX,
            tone: clearance.level === "full" ? "success" : clearance.level === "restricted" ? "warning" : "danger",
            title: `Medical Clearance: ${CLEARANCE_LEVEL_LABELS[clearance.level]}`,
            description: `Clearance · ${formatDate(clearance.issuedAt)} · ${doctor(clearance.doctorId)}${
                clearance.restrictions.length > 0 ? ` · ${clearance.restrictions.length} restrictions` : ""
            }`,
            time: clearance.issuedAt,
        });
        if (clearance.status === "revoked" && clearance.revokedAt) {
            items.push({
                id: `clearance-revoked-${clearance.id}`,
                icon: ShieldBan,
                tone: "danger",
                title: "Medical Clearance revoked",
                description: `Clearance · ${formatDate(clearance.revokedAt)}`,
                time: clearance.revokedAt,
            });
        }
    }

    return items.sort((a, b) => b.time.localeCompare(a.time));
}
