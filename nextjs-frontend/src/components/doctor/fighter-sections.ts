import type { MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** A tab of the profile. */
export type FighterTab = "overview" | "exams" | "injuries" | "recovery" | "clearance" | "history";
/** What is open in the profile: a tab, or one of its "new" forms (shown under the tab it belongs to). */
export type FighterSection = FighterTab | "new-examination" | "new-clearance" | "new-injury" | "new-recovery";
/** A profile action: each opens one of the forms. */
export type FighterAction = "new-examination" | "new-clearance" | "new-injury" | "new-recovery";

/** The profile's tabs. Each stays inside the profile, so the doctor never loses the fighter they were looking at. */
export function fighterTabs(fighterId: string): { key: FighterTab; label: MessageKey; href: string }[] {
    return [
        { key: "overview", label: "doctorUi.tab.overview", href: routes.doctor.fighter(fighterId) },
        { key: "exams", label: "doctorUi.tab.exams", href: routes.doctor.fighterExaminations(fighterId) },
        { key: "injuries", label: "doctorUi.tab.injuries", href: routes.doctor.fighterInjuries(fighterId) },
        { key: "recovery", label: "doctorUi.tab.recovery", href: routes.doctor.fighterRecovery(fighterId) },
        { key: "clearance", label: "doctorUi.tab.clearance", href: routes.doctor.fighterClearance(fighterId) },
        { key: "history", label: "doctorUi.tab.history", href: routes.doctor.fighterHistory(fighterId) },
    ];
}

const TAB_BY_SEGMENT: Record<string, FighterTab> = {
    examinations: "exams",
    injuries: "injuries",
    recovery: "recovery",
    clearance: "clearance",
    history: "history",
};
const NEW_FORM: Record<string, FighterAction> = {
    examinations: "new-examination",
    clearance: "new-clearance",
    injuries: "new-injury",
    recovery: "new-recovery",
};

/** The open section, from the URL segments under `/doctor/fighters/[fighterId]` (e.g. `["examinations", "new"]`). */
export function sectionFromSegments(segments: readonly string[]): FighterSection {
    const [first, second] = segments;
    if (first && second === "new" && NEW_FORM[first]) return NEW_FORM[first];
    return (first && TAB_BY_SEGMENT[first]) || "overview";
}

/** The tab to underline for a section: a form sits under the tab it belongs to. */
export function tabOf(section: FighterSection): FighterTab {
    switch (section) {
        case "new-examination":
            return "exams";
        case "new-clearance":
            return "clearance";
        case "new-injury":
            return "injuries";
        case "new-recovery":
            return "recovery";
        default:
            return section;
    }
}

/**
 * The actions the header offers on each tab: the overview and history keep the two everyday ones, every other tab its
 * own. They live only in the header, so no page repeats them under the tabs.
 */
export const TAB_ACTIONS: Record<FighterTab, readonly FighterAction[]> = {
    overview: ["new-examination", "new-clearance"],
    exams: ["new-examination"],
    injuries: ["new-injury"],
    recovery: ["new-recovery"],
    clearance: ["new-clearance"],
    history: ["new-examination", "new-clearance"],
};
