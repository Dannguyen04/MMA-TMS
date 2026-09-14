import type { InjuryType } from "@/lib/domain/types";

/**
 * Starting points for recovery plans. Durations are typical, not prescriptive — the doctor
 * adjusts phases, dates and milestones to the athlete before saving.
 */

export interface RecoveryTemplatePhase {
    name: string;
    goal: string;
    durationDays: number;
    milestones: string[];
}

export interface RecoveryTemplate {
    id: "muscle_strain" | "ligament_sprain" | "fracture" | "concussion" | "general";
    label: string;
    summary: string;
    phases: RecoveryTemplatePhase[];
}

export const RECOVERY_TEMPLATES: RecoveryTemplate[] = [
    {
        id: "muscle_strain",
        label: "Muscle strain",
        summary: "5 phases · about 6 weeks",
        phases: [
            {
                name: "Protection & pain control",
                goal: "Settle pain and protect the healing muscle while keeping the rest of the body moving.",
                durationDays: 5,
                milestones: ["Pain-free walking", "Strain grade confirmed"],
            },
            {
                name: "Early loading & mobility",
                goal: "Restore range of motion and start pain-free isometric loading.",
                durationDays: 9,
                milestones: ["Pain-free isometric holds at three joint angles", "Range of motion within 10° of the uninjured side"],
            },
            {
                name: "Progressive strengthening",
                goal: "Build eccentric strength and restore running mechanics.",
                durationDays: 14,
                milestones: [
                    "Eccentric exercises 3×6 without pain",
                    "Running at 70% of max velocity pain-free",
                    "Strength ≥ 90% of the uninjured side",
                ],
            },
            {
                name: "Sport-specific reconditioning",
                goal: "Reintroduce explosive movements, kicks and grappling progressively.",
                durationDays: 8,
                milestones: ["Full-speed sprints and changes of direction", "Technical drills at full effort without symptoms"],
            },
            {
                name: "Return to full training",
                goal: "Tolerate full training weeks, including live rounds, before restrictions are lifted.",
                durationDays: 6,
                milestones: ["Live rounds without symptoms", "Return-to-training assessment passed"],
            },
        ],
    },
    {
        id: "ligament_sprain",
        label: "Ligament sprain",
        summary: "4 phases · about 6 weeks",
        phases: [
            {
                name: "Protection & swelling control",
                goal: "Protect the ligament, control swelling and keep pain-free movement.",
                durationDays: 7,
                milestones: ["Swelling settling", "Full weight-bearing without a limp"],
            },
            {
                name: "Range of motion & early strength",
                goal: "Restore full range of motion and start closed-chain strengthening.",
                durationDays: 10,
                milestones: ["Full range of motion", "Single-leg balance for 30 seconds"],
            },
            {
                name: "Strength & proprioception",
                goal: "Build strength, stability and control under progressive load.",
                durationDays: 14,
                milestones: ["Strength ≥ 90% of the uninjured side", "Hop tests within 10% of the uninjured side", "Stability under lateral load"],
            },
            {
                name: "Sport-specific return",
                goal: "Return to footwork, kicks and live training with the joint protected as needed.",
                durationDays: 10,
                milestones: [
                    "Pad work with kicks without symptoms",
                    "Controlled sparring without instability",
                    "Return-to-training assessment passed",
                ],
            },
        ],
    },
    {
        id: "fracture",
        label: "Fracture",
        summary: "4 phases · about 10 weeks",
        phases: [
            {
                name: "Immobilisation & protection",
                goal: "Protect the fracture while maintaining conditioning of uninjured areas.",
                durationDays: 28,
                milestones: ["Alignment confirmed on follow-up imaging", "Conditioning maintained without loading the fracture"],
            },
            {
                name: "Mobilisation",
                goal: "Restore range of motion after immobilisation and begin light loading.",
                durationDays: 14,
                milestones: ["Healing confirmed by the treating clinician", "Range of motion within 10% of the uninjured side"],
            },
            {
                name: "Strengthening & load",
                goal: "Rebuild strength and tolerance to progressive load.",
                durationDays: 14,
                milestones: ["Grip or load strength ≥ 85% of the uninjured side", "Pain-free loading through the healed bone"],
            },
            {
                name: "Graded return to impact",
                goal: "Reintroduce impact progressively — bag and pads before live rounds.",
                durationDays: 14,
                milestones: ["Light bag and pad work without pain", "Full-power strikes without pain", "Return-to-training assessment passed"],
            },
        ],
    },
    {
        id: "concussion",
        label: "Concussion — graded return",
        summary: "6 stages · at least 24 hours each",
        phases: [
            {
                name: "Symptom-limited activity",
                goal: "Relative rest for the first 24–48 hours, then daily activities that don't provoke symptoms.",
                durationDays: 2,
                milestones: ["24–48 hours of relative rest completed", "Daily activities without worsening symptoms"],
            },
            {
                name: "Light aerobic exercise",
                goal: "Walking or stationary cycling at a slow to moderate pace; no resistance training.",
                durationDays: 2,
                milestones: ["Light aerobic session without symptom increase", "No symptoms at rest"],
            },
            {
                name: "Sport-specific exercise (no contact)",
                goal: "Individual drills away from contact — running, skipping and shadow boxing.",
                durationDays: 2,
                milestones: ["Running and skipping drills without symptoms", "Shadow boxing without symptoms"],
            },
            {
                name: "Non-contact training drills",
                goal: "Harder drills with no head-impact risk, plus resistance training. Must be symptom-free.",
                durationDays: 3,
                milestones: ["Pad work without symptoms", "Resistance training resumed", "Concussion screening back to baseline"],
            },
            {
                name: "Full-contact practice (after medical clearance)",
                goal: "Normal training including controlled contact, only after the doctor's clearance.",
                durationDays: 3,
                milestones: ["Medical Clearance for contact training", "Controlled sparring without symptoms"],
            },
            {
                name: "Return to competition",
                goal: "Unrestricted training and eligibility to compete.",
                durationDays: 2,
                milestones: ["Full training week without symptoms", "Medical Clearance updated to full"],
            },
        ],
    },
    {
        id: "general",
        label: "General return to training",
        summary: "3 phases · about 3 weeks",
        phases: [
            {
                name: "Settle symptoms",
                goal: "Reduce pain and inflammation while protecting the injured area.",
                durationDays: 5,
                milestones: ["Pain at rest settled", "Daily activities pain-free"],
            },
            {
                name: "Restore function",
                goal: "Recover range of motion and strength with progressive exercise.",
                durationDays: 10,
                milestones: ["Full range of motion", "Strength close to the uninjured side"],
            },
            {
                name: "Return to training",
                goal: "Progress back to full training, protecting the area where needed.",
                durationDays: 7,
                milestones: ["Technical training without symptoms", "Return-to-training assessment passed"],
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

export function recommendedTemplate(type: InjuryType): RecoveryTemplate {
    const id = TEMPLATE_FOR_TYPE[type];
    return RECOVERY_TEMPLATES.find((template) => template.id === id) ?? RECOVERY_TEMPLATES[RECOVERY_TEMPLATES.length - 1];
}
