import "server-only";

import { Activity, Bandage, CircleCheck, ShieldAlert, ShieldBan, ShieldCheck, ShieldX, Stethoscope } from "lucide-react";

import type { ActivityTimelineItem } from "@/components/domain/activity-timeline";
import type { BodyMapHighlight } from "@/components/domain/body-map";
import { INJURY_STATUS_META } from "@/components/domain/status-badges";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { clearanceLevelLabel, examinationTitle, injuryStatusLabel, injuryTypeName, treatmentTitle } from "@/lib/domain/labels";
import type { Fighter, Injury, MedicalClearance, MedicalExamination, Treatment } from "@/lib/domain/types";
import { daysBetween, formatDate, formatMonthYear } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getMedicalRecord } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { coachesForFighter, doctorsForFighter, getUser } from "@/lib/services/people";
import type { CareTeamMember } from "./care-team-card";

const BODY_MAP_WINDOW_DAYS = 365;

/** Assigned sports doctors and coaches with their account titles, primary contacts flagged. */
export async function loadCareTeam(fighter: Fighter): Promise<CareTeamMember[]> {
    const [doctors, coaches, record] = await Promise.all([
        doctorsForFighter(fighter.id),
        coachesForFighter(fighter.id),
        medicalFeatureAvailable("medicalRecord") ? getMedicalRecord(fighter.id) : null,
    ]);
    const people = [
        ...doctors.map((doctor) => ({ profile: doctor, role: "doctor" as const, primary: doctor.id === record?.primaryDoctorId })),
        ...coaches.map((coach) => ({ profile: coach, role: "coach" as const, primary: coach.id === fighter.primaryCoachId })),
    ];
    const users = await Promise.all(people.map((person) => (person.profile.userId ? getUser(person.profile.userId) : null)));
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
export function injuryHighlights(injuries: Injury[], now: string, locale: Locale = "en"): BodyMapHighlight[] {
    return injuries
        .filter((injury) => injury.status !== "resolved" || (injury.resolvedAt !== null && daysBetween(injury.resolvedAt, now) <= BODY_MAP_WINDOW_DAYS))
        .map((injury) => ({
            region: injury.bodyRegion,
            tone: INJURY_STATUS_META[injury.status].tone,
            label:
                injury.status === "resolved" && injury.resolvedAt
                    ? `${injuryTypeName(injury, locale)} · ${locale === "vi" ? `đã khỏi ${formatMonthYear(injury.resolvedAt, locale)}` : `resolved ${formatMonthYear(injury.resolvedAt, locale)}`}`
                    : `${injuryTypeName(injury, locale)} · ${injuryStatusLabel(injury.status, locale).toLowerCase()}`,
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
export function medicalHistoryItems({ examinations, injuries, treatments, clearances, doctorNames }: MedicalHistoryInput, locale: Locale = "en"): ActivityTimelineItem[] {
    const t = createTranslator(locale);
    const doctor = (id: string) => doctorNames.get(id) ?? t("fighterHistory.doctorFallback");
    const injuryById = new Map(injuries.map((injury) => [injury.id, injury]));
    const items: ActivityTimelineItem[] = [];

    for (const exam of examinations) {
        items.push({
            id: `exam-${exam.id}`,
            icon: Stethoscope,
            tone: exam.outcome === "fit" ? "success" : exam.outcome === "fit_with_restrictions" ? "warning" : "danger",
            title: `${examinationTitle(exam, locale)} — ${t(`examinationOutcome.${exam.outcome}`)}`,
            description: `${t("health.examinationFallback")} · ${formatDate(exam.date, locale)} · ${doctor(exam.doctorId)}`,
            time: exam.date,
        });
    }

    for (const injury of injuries) {
        items.push({
            id: `injury-${injury.id}`,
            icon: Bandage,
            tone: "danger",
            title: locale === "vi" ? `Ghi nhận chấn thương: ${injuryTitle(injury, locale)}` : `Injury recorded: ${injuryTitle(injury, locale)}`,
            description: `${t("health.injuryFallback")} · ${formatDate(injury.occurredAt, locale)} · ${locale === "vi" ? `ghi nhận bởi ${doctor(injury.recordedById)}` : `recorded by ${doctor(injury.recordedById)}`}`,
            time: injury.occurredAt,
            href: routes.fighter.injury(injury.id),
        });
        if (injury.resolvedAt) {
            items.push({
                id: `injury-resolved-${injury.id}`,
                icon: CircleCheck,
                tone: "success",
                title: locale === "vi" ? `Chấn thương đã hồi phục: ${injuryTitle(injury, locale)}` : `Injury resolved: ${injuryTitle(injury, locale)}`,
                description: `${t("health.injuryFallback")} · ${formatDate(injury.resolvedAt, locale)}`,
                time: injury.resolvedAt,
                href: routes.fighter.injury(injury.id),
            });
        }
    }

    for (const treatment of treatments) {
        const injury = injuryById.get(treatment.injuryId);
        const context = injury ? (locale === "vi" ? ` cho ${injuryTitle(injury, locale).toLowerCase()}` : ` for ${injuryTitle(injury, locale).toLowerCase()}`) : "";
        items.push({
            id: `treatment-${treatment.id}`,
            icon: Activity,
            tone: "info",
            title: locale === "vi" ? `Bắt đầu điều trị: ${treatmentTitle(treatment)}` : `Treatment started: ${treatmentTitle(treatment)}`,
            description: `${locale === "vi" ? "Điều trị" : "Treatment"}${context} · ${formatDate(treatment.startDate, locale)} · ${treatment.providerName}`,
            time: treatment.startDate,
            href: injury ? routes.fighter.injury(injury.id) : undefined,
        });
        if (treatment.status === "completed" && treatment.endDate) {
            items.push({
                id: `treatment-done-${treatment.id}`,
                icon: CircleCheck,
                tone: "neutral",
                title: locale === "vi" ? `Hoàn thành điều trị: ${treatmentTitle(treatment)}` : `Treatment completed: ${treatmentTitle(treatment)}`,
                description: `${locale === "vi" ? "Điều trị" : "Treatment"}${context} · ${formatDate(treatment.endDate, locale)}`,
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
            title: `${t("coachClearance.pageTitle")}: ${clearanceLevelLabel(clearance.level, locale)}`,
            description: `${t("nav.clearance")} · ${formatDate(clearance.issuedAt, locale)} · ${doctor(clearance.doctorId)}${
                clearance.restrictions.length > 0 ? (locale === "vi" ? ` · ${clearance.restrictions.length} hạn chế` : ` · ${clearance.restrictions.length} restrictions`) : ""
            }`,
            time: clearance.issuedAt,
        });
        if (clearance.status === "revoked" && clearance.revokedAt) {
            items.push({
                id: `clearance-revoked-${clearance.id}`,
                icon: ShieldBan,
                tone: "danger",
                title: locale === "vi" ? "Thu hồi cấp phép y tế" : "Medical Clearance revoked",
                description: `${t("nav.clearance")} · ${formatDate(clearance.revokedAt, locale)}`,
                time: clearance.revokedAt,
            });
        }
    }

    return items.sort((a, b) => b.time.localeCompare(a.time));
}
