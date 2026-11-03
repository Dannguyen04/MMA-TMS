import { BODY_REGION_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, TrainingRestriction } from "@/lib/domain/types";

export type RestrictionFields = Omit<TrainingRestriction, "id">;

const empty: RestrictionFields = { label: "", blockedTrainingTypes: [], blockedTechniques: [], blockedRegions: [], maxRpe: null };

/** Common restrictions, worded the way coaches read them and mapped to what planning checks enforce. */
export const RESTRICTION_PRESETS: { id: string; restriction: RestrictionFields }[] = [
    { id: "no-sparring", restriction: { ...empty, label: "Không đấu tập", blockedTrainingTypes: ["sparring"] } },
    { id: "no-kicks", restriction: { ...empty, label: "Không đá", blockedTechniques: ["kick"] } },
    {
        id: "no-impact",
        restriction: { ...empty, label: "Không đánh bao, đánh đích hay đấu tập", blockedTrainingTypes: ["heavy_bag", "pad_work", "sparring"] },
    },
    {
        id: "no-punching",
        restriction: { ...empty, label: "Không tập đấm (jab, đấm thẳng, móc hay tổ hợp)", blockedTechniques: ["jab", "cross", "hook", "combination"] },
    },
    { id: "no-right-hand", restriction: { ...empty, label: "Không ra đòn tay phải", blockedRegions: ["right_hand"] } },
    { id: "no-left-hand", restriction: { ...empty, label: "Không ra đòn tay trái", blockedRegions: ["left_hand"] } },
];

export function maxRpeRestriction(maxRpe: number): RestrictionFields {
    return { ...empty, label: `Cường độ buổi tập tối đa RPE ${maxRpe}`, maxRpe };
}

export function protectRegionRestriction(region: BodyRegion): RestrictionFields {
    return { ...empty, label: `Bảo vệ ${BODY_REGION_LABELS[region].toLowerCase()}`, blockedRegions: [region] };
}

export function customRestriction(): RestrictionFields {
    return { ...empty };
}
