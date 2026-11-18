import type { InjuryType } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";

/**
 * Starting points for recovery plans. Durations are typical, not prescriptive — the doctor
 * adjusts phases, dates and milestones to the athlete before saving. The text fields are dictionary keys: the
 * form fills the phases in the viewer's language.
 */

export interface RecoveryTemplatePhase {
    name: MessageKey;
    goal: MessageKey;
    durationDays: number;
    milestones: MessageKey[];
}

export interface RecoveryTemplate {
    id: "muscle_strain" | "ligament_sprain" | "fracture" | "concussion" | "general";
    label: MessageKey;
    summary: MessageKey;
    phases: RecoveryTemplatePhase[];
}

export const RECOVERY_TEMPLATES: RecoveryTemplate[] = [
    {
        id: "muscle_strain",
        label: "doctorClinical.template.muscleStrain.label",
        summary: "doctorClinical.template.muscleStrain.summary",
        phases: [
            {
                name: "doctorClinical.template.muscleStrain.phase1.name",
                goal: "doctorClinical.template.muscleStrain.phase1.goal",
                durationDays: 5,
                milestones: [
                    "doctorClinical.template.muscleStrain.phase1.milestone1",
                    "doctorClinical.template.muscleStrain.phase1.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.muscleStrain.phase2.name",
                goal: "doctorClinical.template.muscleStrain.phase2.goal",
                durationDays: 9,
                milestones: [
                    "doctorClinical.template.muscleStrain.phase2.milestone1",
                    "doctorClinical.template.muscleStrain.phase2.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.muscleStrain.phase3.name",
                goal: "doctorClinical.template.muscleStrain.phase3.goal",
                durationDays: 14,
                milestones: [
                    "doctorClinical.template.muscleStrain.phase3.milestone1",
                    "doctorClinical.template.muscleStrain.phase3.milestone2",
                    "doctorClinical.template.muscleStrain.phase3.milestone3",
                ],
            },
            {
                name: "doctorClinical.template.muscleStrain.phase4.name",
                goal: "doctorClinical.template.muscleStrain.phase4.goal",
                durationDays: 8,
                milestones: [
                    "doctorClinical.template.muscleStrain.phase4.milestone1",
                    "doctorClinical.template.muscleStrain.phase4.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.muscleStrain.phase5.name",
                goal: "doctorClinical.template.muscleStrain.phase5.goal",
                durationDays: 6,
                milestones: [
                    "doctorClinical.template.muscleStrain.phase5.milestone1",
                    "doctorClinical.template.muscleStrain.phase5.milestone2",
                ],
            },
        ],
    },
    {
        id: "ligament_sprain",
        label: "doctorClinical.template.ligamentSprain.label",
        summary: "doctorClinical.template.ligamentSprain.summary",
        phases: [
            {
                name: "doctorClinical.template.ligamentSprain.phase1.name",
                goal: "doctorClinical.template.ligamentSprain.phase1.goal",
                durationDays: 7,
                milestones: [
                    "doctorClinical.template.ligamentSprain.phase1.milestone1",
                    "doctorClinical.template.ligamentSprain.phase1.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.ligamentSprain.phase2.name",
                goal: "doctorClinical.template.ligamentSprain.phase2.goal",
                durationDays: 10,
                milestones: [
                    "doctorClinical.template.ligamentSprain.phase2.milestone1",
                    "doctorClinical.template.ligamentSprain.phase2.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.ligamentSprain.phase3.name",
                goal: "doctorClinical.template.ligamentSprain.phase3.goal",
                durationDays: 14,
                milestones: [
                    "doctorClinical.template.ligamentSprain.phase3.milestone1",
                    "doctorClinical.template.ligamentSprain.phase3.milestone2",
                    "doctorClinical.template.ligamentSprain.phase3.milestone3",
                ],
            },
            {
                name: "doctorClinical.template.ligamentSprain.phase4.name",
                goal: "doctorClinical.template.ligamentSprain.phase4.goal",
                durationDays: 10,
                milestones: [
                    "doctorClinical.template.ligamentSprain.phase4.milestone1",
                    "doctorClinical.template.ligamentSprain.phase4.milestone2",
                    "doctorClinical.template.ligamentSprain.phase4.milestone3",
                ],
            },
        ],
    },
    {
        id: "fracture",
        label: "doctorClinical.template.fracture.label",
        summary: "doctorClinical.template.fracture.summary",
        phases: [
            {
                name: "doctorClinical.template.fracture.phase1.name",
                goal: "doctorClinical.template.fracture.phase1.goal",
                durationDays: 28,
                milestones: [
                    "doctorClinical.template.fracture.phase1.milestone1",
                    "doctorClinical.template.fracture.phase1.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.fracture.phase2.name",
                goal: "doctorClinical.template.fracture.phase2.goal",
                durationDays: 14,
                milestones: [
                    "doctorClinical.template.fracture.phase2.milestone1",
                    "doctorClinical.template.fracture.phase2.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.fracture.phase3.name",
                goal: "doctorClinical.template.fracture.phase3.goal",
                durationDays: 14,
                milestones: [
                    "doctorClinical.template.fracture.phase3.milestone1",
                    "doctorClinical.template.fracture.phase3.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.fracture.phase4.name",
                goal: "doctorClinical.template.fracture.phase4.goal",
                durationDays: 14,
                milestones: [
                    "doctorClinical.template.fracture.phase4.milestone1",
                    "doctorClinical.template.fracture.phase4.milestone2",
                    "doctorClinical.template.fracture.phase4.milestone3",
                ],
            },
        ],
    },
    {
        id: "concussion",
        label: "doctorClinical.template.concussion.label",
        summary: "doctorClinical.template.concussion.summary",
        phases: [
            {
                name: "doctorClinical.template.concussion.phase1.name",
                goal: "doctorClinical.template.concussion.phase1.goal",
                durationDays: 2,
                milestones: [
                    "doctorClinical.template.concussion.phase1.milestone1",
                    "doctorClinical.template.concussion.phase1.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.concussion.phase2.name",
                goal: "doctorClinical.template.concussion.phase2.goal",
                durationDays: 2,
                milestones: [
                    "doctorClinical.template.concussion.phase2.milestone1",
                    "doctorClinical.template.concussion.phase2.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.concussion.phase3.name",
                goal: "doctorClinical.template.concussion.phase3.goal",
                durationDays: 2,
                milestones: [
                    "doctorClinical.template.concussion.phase3.milestone1",
                    "doctorClinical.template.concussion.phase3.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.concussion.phase4.name",
                goal: "doctorClinical.template.concussion.phase4.goal",
                durationDays: 3,
                milestones: [
                    "doctorClinical.template.concussion.phase4.milestone1",
                    "doctorClinical.template.concussion.phase4.milestone2",
                    "doctorClinical.template.concussion.phase4.milestone3",
                ],
            },
            {
                name: "doctorClinical.template.concussion.phase5.name",
                goal: "doctorClinical.template.concussion.phase5.goal",
                durationDays: 3,
                milestones: [
                    "doctorClinical.template.concussion.phase5.milestone1",
                    "doctorClinical.template.concussion.phase5.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.concussion.phase6.name",
                goal: "doctorClinical.template.concussion.phase6.goal",
                durationDays: 2,
                milestones: [
                    "doctorClinical.template.concussion.phase6.milestone1",
                    "doctorClinical.template.concussion.phase6.milestone2",
                ],
            },
        ],
    },
    {
        id: "general",
        label: "doctorClinical.template.general.label",
        summary: "doctorClinical.template.general.summary",
        phases: [
            {
                name: "doctorClinical.template.general.phase1.name",
                goal: "doctorClinical.template.general.phase1.goal",
                durationDays: 5,
                milestones: [
                    "doctorClinical.template.general.phase1.milestone1",
                    "doctorClinical.template.general.phase1.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.general.phase2.name",
                goal: "doctorClinical.template.general.phase2.goal",
                durationDays: 10,
                milestones: [
                    "doctorClinical.template.general.phase2.milestone1",
                    "doctorClinical.template.general.phase2.milestone2",
                ],
            },
            {
                name: "doctorClinical.template.general.phase3.name",
                goal: "doctorClinical.template.general.phase3.goal",
                durationDays: 7,
                milestones: [
                    "doctorClinical.template.general.phase3.milestone1",
                    "doctorClinical.template.general.phase3.milestone2",
                ],
            },
        ],
    },
];

const TEMPLATE_FOR_TYPE: Record<InjuryType, RecoveryTemplate["id"]> = {
    strain: "muscle_strain",
    sprain: "ligament_sprain",
    fracture: "fracture",
    concussion: "concussion",
    contusion: "general",
    laceration: "general",
    tendinopathy: "general",
    impingement: "general",
};

export function recommendedTemplate(type: InjuryType | null): RecoveryTemplate {
    const id = type ? TEMPLATE_FOR_TYPE[type] : undefined;
    return RECOVERY_TEMPLATES.find((template) => template.id === id) ?? RECOVERY_TEMPLATES[RECOVERY_TEMPLATES.length - 1];
}
