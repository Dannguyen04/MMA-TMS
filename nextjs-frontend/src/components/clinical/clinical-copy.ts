import { formatMeasure } from "@/components/domain/domain-format";
import { BODY_REGION_LABELS, bodyRegionLabel, injuryTypeName } from "@/lib/domain/labels";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import type { AbnormalMovementAlert, BodyRegion, DoctorDecision, Injury, InjurySeverity, InjuryStatus } from "@/lib/domain/types";

/** Plain-language clinical copy shared by the injury, recovery and AI observation screens. */

export const BODY_REGION_GROUPS: { label: string; regions: BodyRegion[] }[] = [
    { label: "Head & neck", regions: ["head", "neck"] },
    { label: "Upper limb", regions: ["right_shoulder", "left_shoulder", "right_elbow", "left_elbow", "right_hand", "left_hand"] },
    { label: "Trunk", regions: ["chest", "ribs", "lower_back"] },
    {
        label: "Lower limb",
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

export const INJURY_SEVERITY_DESCRIPTIONS: Record<InjurySeverity, string> = {
    minor: "Little or no training time lost. Symptoms usually settle within about a week with modified training.",
    moderate: "Training time lost, typically one to four weeks. Needs structured treatment and a recovery plan.",
    severe: "Significant structural damage or more than four weeks out. May need imaging, specialist referral or surgery.",
    critical: "Needs urgent specialist care. No training until the sports doctor says otherwise.",
};

export const OPEN_INJURY_STATUS_DESCRIPTIONS: Record<Exclude<InjuryStatus, "resolved">, string> = {
    active: "Acute phase — under treatment, not yet returning to training.",
    recovering: "Past the acute phase, progressing through a return-to-training plan.",
};

export function injuryTitle(injury: Pick<Injury, "type" | "typeLabel" | "bodyRegion">, locale?: Locale): string {
    return `${injuryTypeName(injury, locale)} — ${bodyRegionLabel(injury.bodyRegion, locale)}`;
}

/** Lower-case "muscle strain, left hamstring" for use inside sentences and option labels. */
export function injuryPhrase(injury: Pick<Injury, "type" | "bodyRegion">): string {
    return `${injuryTypeName(injury).toLowerCase()}, ${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()}`;
}

export function painLabel(level: number, locale?: Locale): string {
    if (locale) {
        const t = createTranslator(locale);
        if (level <= 0) return t("painLabel.none");
        if (level <= 3) return t("painLabel.mild");
        if (level <= 6) return t("painLabel.moderate");
        if (level <= 9) return t("painLabel.severe");
        return t("painLabel.worstPossible");
    }
    if (level <= 0) return "No pain";
    if (level <= 3) return "Mild";
    if (level <= 6) return "Moderate";
    if (level <= 9) return "Severe";
    return "Worst imaginable";
}

const RELATIVE_UNIT = "% of baseline";

/** "14° vs 6° baseline", or "81% of baseline" when the metric is already relative. */
export function describeMetricComparison(metric: AbnormalMovementAlert["metric"]): string {
    if (metric.unit === RELATIVE_UNIT) return `${formatMeasure(metric.observed, "%")} of baseline`;
    return `${formatMeasure(metric.observed, metric.unit)} vs ${formatMeasure(metric.baseline, metric.unit)} baseline`;
}

/** Unit to show next to the observed and baseline values on their own. */
export function metricUnit(metric: AbnormalMovementAlert["metric"]): string {
    return metric.unit === RELATIVE_UNIT ? "%" : metric.unit;
}

export const DOCTOR_DECISION_COPY: Record<DoctorDecision, { title: string; description: string; past: string }> = {
    acknowledged: {
        title: "Acknowledge",
        description: "Noted as clinically plausible. No action beyond routine monitoring at the next scheduled contact.",
        past: "Acknowledged",
    },
    follow_up: {
        title: "Schedule follow-up",
        description: "Needs clinical follow-up. Coaches are told a follow-up is scheduled and to check Medical Clearance — without clinical detail.",
        past: "Follow-up scheduled",
    },
    dismissed: {
        title: "Dismiss",
        description: "Not clinically relevant, for example a technique choice, camera angle or tracking artefact. The observation is closed.",
        past: "Dismissed",
    },
};
