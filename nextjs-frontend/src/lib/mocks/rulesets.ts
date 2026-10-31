import type { CompetitionRuleset, WeightClassOption } from "@/lib/domain/bout";
import type { TrainingType } from "@/lib/domain/types";

/**
 * The three presets migration 024 seeds (T-003 §1, Tech spec §2.2), with the same names: these are data, so they
 * stay in the language the backend stores them in. Sources: docs/FIGHT-CAMP-DOMAIN-RESEARCH.md §2 and §5.
 */

function classes(limits: number[], openLabel: string): WeightClassOption[] {
    return [
        ...limits.map((kg) => ({ code: String(kg), label: `${kg} kg`, limitKg: kg })),
        { code: `${limits[limits.length - 1]}+`, label: openLabel, limitKg: null },
    ];
}

const ALL_BUT_RECOVERY: TrainingType[] = ["shadow_boxing", "pad_work", "heavy_bag", "sparring", "technical_drilling", "grappling", "strength_conditioning"];

export const VMMAF_2021_ID = "rs-vmmaf-2021";
export const AIBA_REFERENCE_ID = "rs-aiba-reference";
export const CUSTOM_RULESET_ID = "rs-custom";

export const mockRulesets: CompetitionRuleset[] = [
    {
        id: VMMAF_2021_ID,
        name: "MMA – VMMAF 2021",
        sport: "MMA",
        organizer: "VMMAF",
        verified: true,
        sourceNote:
            "Luật thi đấu Võ thuật tổng hợp, VMMAF, QĐ 01/QĐ-LĐVTTHVN ngày 01/02/2021: hạng cân theo Điều 7, cân trước ngày thi 1 ngày theo Điều 9. Hồ sơ y tế và đình chỉ theo điều lệ từng giải.",
        weightClasses: classes([44, 48, 52, 56, 60, 65, 70, 77, 84, 93, 120], "Over 120 kg"),
        requirementTemplates: [],
        fightWeekDays: 7,
        requirementsDueDays: 7,
        acuteWindowDays: 7,
        acuteLossLimitPctLong: 8,
        acuteLossLimitPctShort: 5,
        suspensionRules: [],
        defaultBlockedSessionTypes: ["sparring", "grappling"],
        restDaysAfterBout: 0,
    },
    {
        id: AIBA_REFERENCE_ID,
        name: "Boxing nghiệp dư – AIBA (tham khảo)",
        sport: "BOXING",
        organizer: "AIBA",
        verified: false,
        sourceNote:
            "Hạng cân AIBA 2002 (suy ra từ QĐ 1502/QĐ-UBTDTT); đình chỉ theo BSL Generic Medical Guidance as per the AIBA Technical & Competition Rules, mục 2.3. Chưa đối chiếu với ban tổ chức.",
        weightClasses: classes([48, 51, 54, 57, 60, 63.5, 67, 71, 75, 81, 91], "Over 91 kg"),
        requirementTemplates: [],
        fightWeekDays: 7,
        requirementsDueDays: 7,
        acuteWindowDays: 7,
        acuteLossLimitPctLong: 8,
        acuteLossLimitPctShort: 5,
        suspensionRules: [
            { reason: ["KO", "TKO"], minDays: 30 },
            { reason: ["KO", "TKO"], priorCount: 1, withinDays: 90, minDays: 90 },
            { reason: ["KO", "TKO"], priorCount: 2, withinDays: 365, minDays: 365 },
            { loc: "UNDER_1_MIN", minDays: 90 },
            { loc: "OVER_1_MIN", minDays: 180 },
        ],
        defaultBlockedSessionTypes: ALL_BUT_RECOVERY,
        restDaysAfterBout: 0,
    },
    {
        id: CUSTOM_RULESET_ID,
        name: "Tự nhập",
        sport: "MMA",
        organizer: null,
        verified: false,
        sourceNote: null,
        weightClasses: [],
        requirementTemplates: [],
        fightWeekDays: 7,
        requirementsDueDays: 7,
        acuteWindowDays: 7,
        acuteLossLimitPctLong: 8,
        acuteLossLimitPctShort: 5,
        suspensionRules: [],
        defaultBlockedSessionTypes: ["sparring"],
        restDaysAfterBout: 0,
    },
];
