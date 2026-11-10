import { BODY_REGION_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, TrainingRestriction } from "@/lib/domain/types";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate";

import { localLabel } from "./examination-presets";

export type RestrictionFields = Omit<TrainingRestriction, "id">;

const empty: RestrictionFields = { label: "", blockedTrainingTypes: [], blockedTechniques: [], blockedRegions: [], maxRpe: null };

/** Restriction labels are saved with the clearance, so they are worded in the language of the doctor who writes them. */
const VI = createTranslator("vi");

const PRESETS: { id: string; label: MessageKey; restriction: Omit<RestrictionFields, "label"> }[] = [
    { id: "no-sparring", label: "doctorMedical.restrictionPreset.noSparring", restriction: { ...empty, blockedTrainingTypes: ["sparring"] } },
    { id: "no-kicks", label: "doctorMedical.restrictionPreset.noKicks", restriction: { ...empty, blockedTechniques: ["kick"] } },
    { id: "no-impact", label: "doctorMedical.restrictionPreset.noImpact", restriction: { ...empty, blockedTrainingTypes: ["heavy_bag", "pad_work", "sparring"] } },
    { id: "no-punching", label: "doctorMedical.restrictionPreset.noPunching", restriction: { ...empty, blockedTechniques: ["jab", "cross", "hook", "combination"] } },
    { id: "no-right-hand", label: "doctorMedical.restrictionPreset.noRightHand", restriction: { ...empty, blockedRegions: ["right_hand"] } },
    { id: "no-left-hand", label: "doctorMedical.restrictionPreset.noLeftHand", restriction: { ...empty, blockedRegions: ["left_hand"] } },
];

/** Common restrictions, worded the way coaches read them and mapped to what planning checks enforce. */
export function restrictionPresets(t: Translator): { id: string; restriction: RestrictionFields }[] {
    return PRESETS.map(({ id, label, restriction }) => ({ id, restriction: { ...restriction, label: t(label) } }));
}

/** The presets worded in Vietnamese. */
export const RESTRICTION_PRESETS: { id: string; restriction: RestrictionFields }[] = restrictionPresets(VI);

export function maxRpeRestriction(maxRpe: number, t: Translator = VI): RestrictionFields {
    return { ...empty, label: t("doctorMedical.restrictionPreset.maxRpe", { n: maxRpe }), maxRpe };
}

export function protectRegionRestriction(region: BodyRegion, t: Translator = VI): RestrictionFields {
    const name = localLabel(t, `bodyRegion.${region}`, BODY_REGION_LABELS[region]).toLowerCase();
    return { ...empty, label: t("doctorMedical.restrictionPreset.protectRegion", { region: name }), blockedRegions: [region] };
}

export function customRestriction(): RestrictionFields {
    return { ...empty };
}
