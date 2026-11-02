import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { BODY_REGION_LABELS, techniqueLabel, trainingTypeLabel } from "./labels";
import { clearanceState } from "./rules";
import type { BodyRegion, MedicalClearance, Technique, TrainingRestriction, TrainingType } from "./types";

/** What a restriction asks of planned training, in the terms the scheduler checks. */
export interface RestrictionEffects {
    /** Training types that must not be planned. */
    blocksTypes: TrainingType[];
    /** Techniques to avoid; the coach must acknowledge a session that includes them. */
    avoidTechniques: Technique[];
    /** Body regions to protect; the coach must acknowledge a session that loads them. */
    protectRegions: BodyRegion[];
    maxRpe: number | null;
}

/**
 * How strongly a restriction constrains training:
 * - "block": it forbids at least one training type;
 * - "limit": it caps session intensity (RPE) without forbidding a type;
 * - "warn": it only names techniques or body regions, which need coach acknowledgement.
 */
export type RestrictionSeverity = "block" | "limit" | "warn";

export function restrictionEffects(restriction: TrainingRestriction): RestrictionEffects {
    return {
        blocksTypes: restriction.blockedTrainingTypes,
        avoidTechniques: restriction.blockedTechniques,
        protectRegions: restriction.blockedRegions,
        maxRpe: restriction.maxRpe,
    };
}

/**
 * Blocked training types and RPE caps block a session, techniques and regions only warn.
 * Escalating technique restrictions to blocking is a product decision to make here;
 * this function and the restriction UI follow that rule.
 */
export function restrictionSeverity(restriction: TrainingRestriction): RestrictionSeverity {
    if (restriction.blockedTrainingTypes.length > 0) return "block";
    if (restriction.maxRpe !== null) return "limit";
    return "warn";
}

export interface PlannedTraining {
    type: TrainingType;
    /** Planned intensity; null when none was set, which skips the intensity check. */
    targetRpe: number | null;
    techniques: Technique[];
    loadsRegions: BodyRegion[];
}

export type ClearanceConflictCode =
    | "no_clearance"
    | "expired"
    | "not_cleared"
    | "blocked_type"
    | "exceeds_rpe"
    | "restricted_technique"
    | "protected_region"
    | "suspended";

export interface ClearanceConflict {
    code: ClearanceConflictCode;
    /** "block" means the session must not go ahead as planned; "warn" needs coach judgement. */
    severity: "block" | "warn";
    type?: TrainingType;
    label?: string;
    targetRpe?: number;
    maxRpe?: number;
    techniques?: Technique[];
    regions?: BodyRegion[];
    date?: string;
    /** "suspended" only: who is suspended. Its `date` is the last suspended day, absent once only a clearance can end it. */
    fighterName?: string;
    /** Optional fallback message */
    message?: string;
}

/**
 * Checks planned training against the fighter's Medical Clearance.
 * Coaches see these conflicts when scheduling; the doctor's clearance is always the authority.
 * Returns structured conflict codes without English sentences (T-015).
 */
export function checkTrainingAgainstClearance(
    planned: PlannedTraining,
    clearance: MedicalClearance | null,
    now: string | Date = new Date(),
): ClearanceConflict[] {
    const state = clearanceState(clearance, now);

    if (state === "none") {
        return [{ code: "no_clearance", severity: "warn" }];
    }
    if (state === "expired" && clearance) {
        return [
            {
                code: "expired",
                severity: "block",
                date: clearance.validUntil ?? clearance.issuedAt,
            },
        ];
    }
    if (state === "not_cleared") {
        return [{ code: "not_cleared", severity: "block" }];
    }
    if (!clearance || state === "full") return [];

    const conflicts: ClearanceConflict[] = [];
    for (const restriction of clearance.restrictions) {
        if (restriction.blockedTrainingTypes.includes(planned.type)) {
            conflicts.push({
                code: "blocked_type",
                severity: "block",
                type: planned.type,
                label: restriction.label,
            });
        }
        if (restriction.maxRpe !== null && planned.targetRpe !== null && planned.targetRpe > restriction.maxRpe) {
            conflicts.push({
                code: "exceeds_rpe",
                severity: "block",
                targetRpe: planned.targetRpe,
                maxRpe: restriction.maxRpe,
            });
        }
        const techniques = planned.techniques.filter((t) => restriction.blockedTechniques.includes(t));
        if (techniques.length > 0) {
            conflicts.push({
                code: "restricted_technique",
                severity: "warn",
                techniques,
                label: restriction.label,
            });
        }
        const regions = planned.loadsRegions.filter((r) => restriction.blockedRegions.includes(r));
        if (regions.length > 0) {
            conflicts.push({
                code: "protected_region",
                severity: "warn",
                regions,
                label: restriction.label,
            });
        }
    }
    return conflicts;
}

/**
 * Translates a structured ClearanceConflict into the user's language.
 */
export function clearanceConflictMessage(t: Translator, conflict: ClearanceConflict, locale: Locale = "en"): string {
    switch (conflict.code) {
        case "no_clearance":
            return t("training.conflict.noClearance");
        case "expired":
            return t("training.conflict.expired", { date: conflict.date ? formatDate(conflict.date, locale) : "" });
        case "not_cleared":
            return t("training.conflict.notCleared");
        case "blocked_type":
            return t("training.conflict.blockedType", {
                type: conflict.type ? trainingTypeLabel(t, conflict.type) : "",
                label: conflict.label ?? "",
            });
        case "exceeds_rpe":
            return t("training.conflict.exceedsRpe", {
                target: conflict.targetRpe ?? "",
                max: conflict.maxRpe ?? "",
            });
        case "restricted_technique":
            return t("training.conflict.restrictedTechnique", {
                techniques: (conflict.techniques ?? []).map((tech) => techniqueLabel(t, tech)).join(", "),
                label: conflict.label ?? "",
            });
        case "protected_region":
            return t("training.conflict.protectedRegion", {
                regions: (conflict.regions ?? []).map((reg) => BODY_REGION_LABELS[reg] ?? reg).join(", "),
                label: conflict.label ?? "",
            });
        case "suspended":
            return t("training.gate2.suspended", {
                name: conflict.fighterName ?? "",
                type: conflict.type ? trainingTypeLabel(t, conflict.type).toLowerCase() : "",
                until: conflict.date ? t("training.gate2.through", { date: formatDate(conflict.date, locale) }) : t("training.gate2.untilCleared"),
            });
        default:
            return conflict.message ?? "";
    }
}
