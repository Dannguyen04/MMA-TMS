import type { GlossaryEntry } from "./types";

/** Fight-camp terms on the bout screens (T-004 to T-007). */
export const BOUT_TERMS = {
    fightWeek: {
        term: "Fight week",
        definition: "The last days before the official weigh-in. The medical checklist locks and the app watches weight every day.",
    },
    acuteWeightLoss: {
        term: "Acute weight loss",
        definition: "Weight lost in the final days before weigh-in, as a share of body weight. Above the ruleset's limit the doctor is told.",
    },
    suspension: {
        term: "Suspension",
        definition: "Days a fighter may not spar or compete after a knockout or a hard loss. It ends on its date, or when a doctor clears the fighter.",
    },
} satisfies Record<string, GlossaryEntry>;
