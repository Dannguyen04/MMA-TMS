import { BODY_REGION_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, TrainingRestriction } from "@/lib/domain/types";

export type RestrictionFields = Omit<TrainingRestriction, "id">;

const empty: RestrictionFields = { label: "", blockedTrainingTypes: [], blockedTechniques: [], blockedRegions: [], maxRpe: null };

/** Common restrictions, worded the way coaches read them and mapped to what planning checks enforce. */
export const RESTRICTION_PRESETS: { id: string; restriction: RestrictionFields }[] = [
    { id: "no-sparring", restriction: { ...empty, label: "No sparring", blockedTrainingTypes: ["sparring"] } },
    { id: "no-kicks", restriction: { ...empty, label: "No kicks", blockedTechniques: ["kick"] } },
    {
        id: "no-impact",
        restriction: { ...empty, label: "No heavy bag, pad work or sparring", blockedTrainingTypes: ["heavy_bag", "pad_work", "sparring"] },
    },
    {
        id: "no-punching",
        restriction: { ...empty, label: "No punching drills (jab, cross, hook or combinations)", blockedTechniques: ["jab", "cross", "hook", "combination"] },
    },
    { id: "no-right-hand", restriction: { ...empty, label: "No striking with the right hand", blockedRegions: ["right_hand"] } },
    { id: "no-left-hand", restriction: { ...empty, label: "No striking with the left hand", blockedRegions: ["left_hand"] } },
];

export function maxRpeRestriction(maxRpe: number): RestrictionFields {
    return { ...empty, label: `Max session intensity RPE ${maxRpe}`, maxRpe };
}

export function protectRegionRestriction(region: BodyRegion): RestrictionFields {
    return { ...empty, label: `Protect ${BODY_REGION_LABELS[region].toLowerCase()}`, blockedRegions: [region] };
}

export function customRestriction(): RestrictionFields {
    return { ...empty };
}
