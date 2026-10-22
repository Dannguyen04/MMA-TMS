import type { GlossaryEntry } from "./types";

/** Training-plan and session terms on the coach's and fighter's screens. */
export const TRAINING_TERMS = {
    rpe: {
        term: "RPE",
        definition: "Rate of Perceived Exertion: how hard the work should feel, from 1 (very easy) to 10 (all-out).",
    },
    sets: {
        term: "Sets",
        definition: "How many rounds of the exercise to do, with rest in between.",
    },
    reps: {
        term: "Reps",
        definition: "How many repetitions to do in each set.",
    },
    trainingPhase: {
        term: "Phase",
        definition: "Where the plan sits in the training cycle. It sets the focus and how hard the weeks are.",
    },
    phaseBase: {
        term: "Base",
        definition: "Builds general fitness and technique at moderate intensity, well before any fight.",
    },
    phaseBuild: {
        term: "Build",
        definition: "Raises intensity and volume to develop fight-specific strength and conditioning.",
    },
    phaseFightCamp: {
        term: "Fight camp",
        definition: "The weeks leading up to a bout: sparring, the game plan and peak conditioning.",
    },
    phaseTaper: {
        term: "Taper",
        definition: "The last week or two before a fight: less volume so the body is fresh on fight night.",
    },
    phaseRehab: {
        term: "Rehab",
        definition: "Reduced, controlled work while recovering from an injury, within the doctor's restrictions.",
    },
    phaseMaintenance: {
        term: "Maintenance",
        definition: "Keeps fitness and skills ticking over between camps without building fatigue.",
    },
    planObjective: {
        term: "Objective",
        definition: "What the plan should achieve, in one sentence the fighter will read, for example: sharpen the jab and stay under 70 kg.",
    },
    template: {
        term: "Template",
        definition: "A ready-made starting point. Everything it fills in can still be changed before you save.",
    },
    planDraft: {
        term: "Draft",
        definition: "A plan only coaches can see. The fighter sees it, and is notified, once you activate it.",
    },
    exerciseLibrary: {
        term: "Exercise library",
        definition: "The academy's shared list of drills that plans are built from. Administrators add to it; coaches pick from it.",
    },
    exerciseMinutes: {
        term: "Minutes",
        definition: "Total working time for the exercise across all its sets or rounds.",
    },
} as const satisfies Record<string, GlossaryEntry>;
