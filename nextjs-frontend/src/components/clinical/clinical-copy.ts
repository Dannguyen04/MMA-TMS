import { formatMeasure } from "@/components/domain/domain-format";
import { bodyRegionLabel, injuryTypeName } from "@/lib/domain/labels";
import type { BodyJoint } from "@/lib/domain/medical-contract";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate-client";
import type {
    AbnormalMovementAlert,
    BodyRegion,
    DoctorDecision,
    Injury,
    InjuryMechanism,
    InjurySeverity,
    InjuryStatus,
    InjuryType,
    RecoveryPlanStatus,
    TrainingType,
    Treatment,
    TreatmentStatus,
    TreatmentType,
} from "@/lib/domain/types";

/** Plain-language clinical copy shared by the injury, recovery and AI observation screens. */

/** Callers that don't pass a translator keep the Vietnamese wording these screens always had. */
const VI = createTranslator("vi");

export const BODY_REGION_GROUPS: { label: MessageKey; regions: BodyRegion[] }[] = [
    { label: "doctorClinical.regionGroup.headNeck", regions: ["head", "neck"] },
    { label: "doctorClinical.regionGroup.upperLimb", regions: ["right_shoulder", "left_shoulder", "right_elbow", "left_elbow", "right_hand", "left_hand"] },
    { label: "doctorClinical.regionGroup.trunk", regions: ["chest", "ribs", "lower_back"] },
    {
        label: "doctorClinical.regionGroup.lowerLimb",
        regions: [
            "right_hip",
            "left_hip",
            "right_hamstring",
            "left_hamstring",
            "right_knee",
            "left_knee",
            "right_shin",
            "left_shin",
            "right_ankle",
            "left_ankle",
        ],
    },
];

export const INJURY_SEVERITY_DESCRIPTIONS: Record<InjurySeverity, MessageKey> = {
    minor: "doctorClinical.severityDesc.minor",
    moderate: "doctorClinical.severityDesc.moderate",
    severe: "doctorClinical.severityDesc.severe",
    critical: "doctorClinical.severityDesc.critical",
};

export const OPEN_INJURY_STATUS_DESCRIPTIONS: Record<Exclude<InjuryStatus, "resolved">, MessageKey> = {
    active: "doctorClinical.openStatusDesc.active",
    recovering: "doctorClinical.openStatusDesc.recovering",
};

/* Domain labels in the wording of these screens (the shared `health.*` keys word some of them differently). */

export const regionText = (t: Translator, region: BodyRegion) => t(`doctorClinical.region.${region}`);
export const jointText = (t: Translator, joint: BodyJoint) => t(`doctorClinical.joint.${joint}`);
export const injuryTypeText = (t: Translator, type: InjuryType) => t(`doctorClinical.injuryType.${type}`);
export const severityText = (t: Translator, severity: InjurySeverity) => t(`injurySeverity.${severity}`);
export const mechanismText = (t: Translator, mechanism: InjuryMechanism) => t(`doctorClinical.mechanism.${mechanism}`);
export const treatmentTypeText = (t: Translator, type: TreatmentType) => t(`doctorClinical.treatmentType.${type}`);
export const treatmentStatusText = (t: Translator, status: TreatmentStatus) => t(`doctorClinical.treatmentStatus.${status}`);
export const planStatusText = (t: Translator, status: RecoveryPlanStatus) => t(`doctorClinical.planStatus.${status}`);
export const trainingTypeText = (t: Translator, type: TrainingType) => t(`doctorClinical.trainingType.${type}`);

/** The injury's type, the doctor's own wording when it has no type, or "Injury". */
export function injuryText(t: Translator, injury: Pick<Injury, "type" | "typeLabel">): string {
    if (injury.type) return injuryTypeText(t, injury.type);
    return injury.typeLabel?.trim() || t("doctorClinical.injuryType.fallback");
}

/** The treatment's type, the doctor's own wording when it has no type, or "Treatment". */
export function treatmentText(t: Translator, treatment: Pick<Treatment, "type" | "typeLabel">): string {
    if (treatment.type) return treatmentTypeText(t, treatment.type);
    return treatment.typeLabel?.trim() || t("doctorClinical.treatmentType.fallback");
}

export function injuryTitle(injury: Pick<Injury, "type" | "typeLabel" | "bodyRegion">, locale?: Locale): string {
    return `${injuryTypeName(injury, locale)} — ${bodyRegionLabel(injury.bodyRegion, locale)}`;
}

/** Lower-case "muscle strain, left hamstring" for use inside sentences and option labels. */
export function injuryPhrase(injury: Pick<Injury, "type" | "typeLabel" | "bodyRegion">, t: Translator = VI): string {
    return `${injuryText(t, injury).toLowerCase()}, ${regionText(t, injury.bodyRegion).toLowerCase()}`;
}

/**
 * Words for a 0–10 pain level. With `locale` it uses the fighter-facing `painLabel.*` wording; otherwise the
 * clinical wording, in the language of `t` (Vietnamese when no translator is given).
 */
export function painLabel(level: number, locale?: Locale, t: Translator = VI): string {
    if (locale) {
        const tr = createTranslator(locale);
        if (level <= 0) return tr("painLabel.none");
        if (level <= 3) return tr("painLabel.mild");
        if (level <= 6) return tr("painLabel.moderate");
        if (level <= 9) return tr("painLabel.severe");
        return tr("painLabel.worstPossible");
    }
    if (level <= 0) return t("doctorClinical.pain.none");
    if (level <= 3) return t("doctorClinical.pain.mild");
    if (level <= 6) return t("doctorClinical.pain.moderate");
    if (level <= 9) return t("doctorClinical.pain.severe");
    return t("doctorClinical.pain.worst");
}

/** The unit the AI service stores for metrics that are already relative to the baseline (a data value, not copy). */
const RELATIVE_UNIT = "% mức nền";

/** "14° vs 6° baseline", or "81% of baseline" when the metric is already relative. */
export function describeMetricComparison(metric: AbnormalMovementAlert["metric"], t: Translator = VI): string {
    if (metric.unit === RELATIVE_UNIT) return t("doctorClinical.metric.ofBaseline", { observed: formatMeasure(metric.observed, "%") });
    return t("doctorClinical.metric.vsBaseline", {
        observed: formatMeasure(metric.observed, metric.unit),
        baseline: formatMeasure(metric.baseline, metric.unit),
    });
}

/** Unit to show next to the observed and baseline values on their own. */
export function metricUnit(metric: AbnormalMovementAlert["metric"]): string {
    return metric.unit === RELATIVE_UNIT ? "%" : metric.unit;
}

export const DOCTOR_DECISION_COPY: Record<DoctorDecision, { title: MessageKey; description: MessageKey; past: MessageKey }> = {
    acknowledged: {
        title: "doctorClinical.decision.acknowledged.title",
        description: "doctorClinical.decision.acknowledged.description",
        past: "doctorClinical.decision.acknowledged.past",
    },
    follow_up: {
        title: "doctorClinical.decision.follow_up.title",
        description: "doctorClinical.decision.follow_up.description",
        past: "doctorClinical.decision.follow_up.past",
    },
    dismissed: {
        title: "doctorClinical.decision.dismissed.title",
        description: "doctorClinical.decision.dismissed.description",
        past: "doctorClinical.decision.dismissed.past",
    },
};
