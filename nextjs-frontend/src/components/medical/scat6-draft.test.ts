import { describe, expect, it } from "vitest";

import { scat6InputSchema } from "@/lib/domain/scat6";
import {
    anyGaitTrialIncomplete,
    delayedRecallEarliest,
    digitTestContinues,
    emptyScat6Draft,
    fillNoBackground,
    fillNoSymptoms,
    fillToggleRow,
    scat6FromDraft,
    scat6Problems,
    skipPart,
    stampNow,
    toggleItem,
    toggleRows,
    type Scat6Draft,
} from "./scat6-draft";

const START = "2026-09-01T09:00";

/** Applies a quick fill that must apply. */
const must = (result: { draft: Scat6Draft } | null): Scat6Draft => {
    if (!result) throw new Error("Expected the quick fill to apply.");
    return result.draft;
};

/** A blank form with every answer the record needs given, the way a doctor would with the quick fills. */
function filledDraft(): Scat6Draft {
    let draft = emptyScat6Draft(START);
    draft.examinerAttestation = true;
    draft.athlete.dominantHand = "RIGHT";
    draft.concussionHistory.priorDiagnosedConcussions = "0";
    draft = must(skipPart(draft, "immediateAssessment"));
    draft = must(fillNoBackground(draft));
    draft = must(fillNoSymptoms(draft));
    draft.symptoms.percentOfNormal = "100";
    draft = must(fillToggleRow(draft, "orientation.answers", true));
    draft.immediateMemory.wordList = "A";
    for (const index of [0, 1, 2]) draft = must(fillToggleRow(draft, `immediateMemory.trials.${index}`, true));
    draft.immediateMemory.lastTrialCompletedAt = "2026-09-01T09:06";
    draft.digitsBackward.digitList = "C";
    draft.digitsBackward.strings = [
        { trial1: true, trial2: null },
        { trial1: false, trial2: false },
    ];
    draft = must(fillToggleRow(draft, "monthsReverse.correctResponses", true));
    draft.monthsReverse.timeSeconds = "21";
    draft.monthsReverse.errors = "0";
    draft.mbess.footTested = "LEFT";
    draft.mbess.testingSurface = "Mat";
    draft.mbess.footwear = "Barefoot";
    for (const stance of [draft.mbess.firm.doubleLeg, draft.mbess.firm.singleLeg, draft.mbess.firm.tandem]) stance.errors = "1";
    draft.tandemGait.trials.forEach((trial, index) => (trial.timeSeconds = String(10 + index)));
    draft = must(skipPart(draft, "dualTaskGait"));
    draft.delayedRecall.startedAt = "2026-09-01T09:15";
    draft = must(fillToggleRow(draft, "delayedRecall.words", true));
    draft.differentFromUsualSelf = "NO";
    return draft;
}

const paths = (draft: Scat6Draft) => {
    const result = scat6InputSchema.safeParse(scat6FromDraft(draft));
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("emptyScat6Draft", () => {
    it("assumes nothing: no rating, no finding, no history, no time and no skipped part is filled in", () => {
        const draft = emptyScat6Draft(START);
        expect(draft.administeredAt).toBe(START);
        expect(draft.concussionHistory.priorDiagnosedConcussions).toBe("");
        expect(draft.immediateAssessment.performed).toBeNull();
        expect(draft.immediateAssessment.reason).toBe("");
        expect(draft.immediateAssessment.fullActiveRangeOfMotion).toBeNull();
        expect(Object.values(draft.background).filter((value) => typeof value !== "string")).toEqual([null, null, null, null, null]);
        expect(new Set(draft.symptoms.ratings)).toEqual(new Set([""]));
        expect(draft.symptoms.percentOfNormal).toBe("");
        expect(draft.symptoms.worseWithPhysicalActivity).toBeNull();
        expect(draft.immediateMemory.lastTrialCompletedAt).toBe("");
        expect(draft.delayedRecall.startedAt).toBe("");
        expect(draft.dualTaskGait.performed).toBeNull();
        expect(draft.marked).toEqual({});
    });
});

describe("scat6FromDraft", () => {
    it("turns a completed form into a record the medical service accepts, with times as academy instants", () => {
        const record = scat6FromDraft(filledDraft());
        expect(scat6InputSchema.safeParse(record).success).toBe(true);
        expect(record).toMatchObject({
            administeredAt: "2026-09-01T02:00:00.000Z",
            immediateAssessment: { performed: false, reason: "Baseline assessment, no injury." },
            dualTaskGait: { performed: false, reason: "Not done at this baseline." },
            background: { adhd: false, notes: null },
            symptoms: { performed: true, percentOfNormal: 100, worseWithPhysicalActivity: false },
        });
    });

    it("leaves unanswered items for the schema to name instead of guessing them", () => {
        expect(paths(emptyScat6Draft(START))).toEqual(
            expect.arrayContaining([
                "examinerAttestation",
                "athlete.dominantHand",
                "concussionHistory.priorDiagnosedConcussions",
                "immediateAssessment.performed",
                "background.hospitalisedForHeadInjury",
                "background.adhd",
                "symptoms.ratings.0",
                "symptoms.ratings.21",
                "symptoms.worseWithPhysicalActivity",
                "symptoms.percentOfNormal",
                "immediateMemory.wordList",
                "immediateMemory.lastTrialCompletedAt",
                "digitsBackward.digitList",
                "monthsReverse.timeSeconds",
                "mbess.footTested",
                "tandemGait.trials.0.timeSeconds",
                "dualTaskGait.performed",
                "delayedRecall.startedAt",
                "differentFromUsualSelf",
            ]),
        );
    });

    it("sends a SCAT6 that wasn't administered with its reason only", () => {
        const draft = filledDraft();
        draft.status = "NOT_ADMINISTERED";
        draft.notAdministeredReason = "  Athlete is 12.  ";
        expect(scat6FromDraft(draft)).toEqual({ status: "NOT_ADMINISTERED", formVersion: "SCAT6-2023-EN", reason: "Athlete is 12." });
    });

    it("keeps digit lengths up to the one that ended the test and drops a stale trial 2", () => {
        const draft = filledDraft();
        draft.digitsBackward.strings = [
            { trial1: true, trial2: false },
            { trial1: false, trial2: false },
            { trial1: true, trial2: null },
        ];
        expect(scat6FromDraft(draft)).toMatchObject({
            digitsBackward: {
                strings: [
                    { trial1Correct: true, trial2Correct: null },
                    { trial1Correct: false, trial2Correct: false },
                ],
            },
        });
    });

    it("asks for the gait reason only when a trial stopped early", () => {
        const draft = filledDraft();
        expect(anyGaitTrialIncomplete(draft)).toBe(false);
        draft.tandemGait.trials[1].completed = false;
        expect(anyGaitTrialIncomplete(draft)).toBe(true);
        expect(paths(draft)).toEqual(["gaitIncompleteReason"]);
        draft.gaitIncompleteReason = "Stepped off the line twice.";
        expect(paths(draft)).toEqual([]);

        // Completing the trial again hides the reason, so it isn't sent either.
        draft.tandemGait.trials[1].completed = true;
        expect(scat6FromDraft(draft)).toMatchObject({ gaitIncompleteReason: null });
        expect(paths(draft)).toEqual([]);
    });

    it("answers the range-of-motion question only after both neck findings are No", () => {
        const draft = filledDraft();
        draft.immediateAssessment.performed = true;
        draft.immediateAssessment.fullActiveRangeOfMotion = true;
        draft.immediateAssessment.neckPainAtRest = true;
        draft.immediateAssessment.tendernessToPalpation = false;
        expect(scat6FromDraft(draft)).toMatchObject({ immediateAssessment: { cervicalSpine: { fullActiveRangeOfMotion: null } } });
        draft.immediateAssessment.neckPainAtRest = false;
        expect(scat6FromDraft(draft)).toMatchObject({ immediateAssessment: { cervicalSpine: { fullActiveRangeOfMotion: true } } });
    });
});

describe("quick fills", () => {
    it("“No symptoms” fills only blank ratings and blank activity answers, and never when a symptom is rated", () => {
        const draft = emptyScat6Draft(START);
        draft.symptoms.ratings[3] = "0";
        draft.symptoms.worseWithMentalActivity = true;
        const result = fillNoSymptoms(draft);
        expect(result?.filled).toContain("21 ratings set to 0");
        expect(result?.draft.symptoms.ratings.every((rating) => rating === "0")).toBe(true);
        expect(result?.draft.symptoms).toMatchObject({ worseWithPhysicalActivity: false, worseWithMentalActivity: true, percentOfNormal: "" });
        // The doctor's draft itself is untouched.
        expect(draft.symptoms.ratings[0]).toBe("");

        draft.symptoms.ratings[5] = "2";
        expect(fillNoSymptoms(draft)).toBeNull();
    });

    it("“None apply” answers only unanswered background conditions, and never after a Yes", () => {
        const draft = emptyScat6Draft(START);
        draft.background.adhd = false;
        const result = fillNoBackground(draft);
        expect(result?.filled).toMatch(/^4 conditions set to No/);
        expect(result?.draft.background).toMatchObject({ adhd: false, hospitalisedForHeadInjury: false, depressionAnxietyOrOtherPsychological: false });

        draft.background.headacheDisorderOrMigraine = true;
        expect(fillNoBackground(draft)).toBeNull();
    });

    it("fills a tick row only while nobody has marked it, and an item tick marks the row", () => {
        const draft = emptyScat6Draft(START);
        const all = fillToggleRow(draft, "orientation.answers", true);
        expect(all?.draft.orientation.answers).toEqual([true, true, true, true, true]);
        expect(all?.filled).toBe("5 of 5 ticked.");
        expect(fillToggleRow(must(all), "orientation.answers", false)).toBeNull();

        const ticked = toggleItem(draft, "immediateMemory.trials.1", 4, true);
        expect(ticked.immediateMemory.trials[1][4]).toBe(true);
        expect(ticked.marked["immediateMemory.trials.1"]).toBe(true);
        expect(fillToggleRow(ticked, "immediateMemory.trials.1", true)).toBeNull();

        const none = fillToggleRow(draft, "delayedRecall.words", false);
        expect(none?.filled).toBe("None recalled: 0 of 10 ticked.");
        expect(none?.draft.marked["delayedRecall.words"]).toBe(true);
    });

    it("stamps a blank time with the academy clock and never replaces one already entered", () => {
        const draft = emptyScat6Draft(START);
        const stamped = stampNow(draft, "immediateMemory.lastTrialCompletedAt", "2026-09-01T02:07:30.000Z");
        expect(stamped?.draft.immediateMemory.lastTrialCompletedAt).toBe("2026-09-01T09:07");
        expect(stampNow(must(stamped), "immediateMemory.lastTrialCompletedAt", "2026-09-01T02:20:00.000Z")).toBeNull();
        expect(delayedRecallEarliest(must(stamped))).toBe("2026-09-01T09:12");
        expect(delayedRecallEarliest(draft)).toBeNull();
    });

    it("records a usually skipped part as not performed only while unanswered, keeping a reason the doctor wrote", () => {
        const draft = emptyScat6Draft(START);
        draft.dualTaskGait.reason = "Athlete declined.";
        expect(must(skipPart(draft, "dualTaskGait")).dualTaskGait).toMatchObject({ performed: false, reason: "Athlete declined." });
        draft.immediateAssessment.performed = true;
        expect(skipPart(draft, "immediateAssessment")).toBeNull();
    });
});

describe("scat6Problems", () => {
    it("has none for a completed form", () => {
        expect(scat6Problems(filledDraft())).toEqual([]);
    });

    it("puts each problem on its step, in plain words, including tick rows nobody marked", () => {
        const draft = emptyScat6Draft(START);
        const problems = scat6Problems(draft);
        const byPath = Object.fromEntries(problems.map((problem) => [problem.path, problem]));
        expect(byPath["background.adhd"]).toMatchObject({ step: "history", message: "Answer yes or no." });
        expect(byPath["immediateAssessment.performed"]).toMatchObject({ step: "history", message: "Say whether it was performed." });
        expect(byPath["orientation.answers"]).toMatchObject({ step: "memory", message: "Tick the orientation answers given correctly, or choose “None correct”." });
        expect(byPath["immediateMemory.trials.2"]).toMatchObject({ step: "memory" });
        expect(byPath["delayedRecall.words"]).toMatchObject({ step: "balance" });
        expect(byPath["dualTaskGait.performed"]).toMatchObject({ step: "balance" });
        // Rows of a part that isn't performed don't need marking.
        expect(byPath["immediateAssessment.maddocks"]).toBeUndefined();
    });

    it("holds delayed recall to 5 minutes after the last memory trial", () => {
        const draft = filledDraft();
        draft.delayedRecall.startedAt = "2026-09-01T09:09";
        expect(scat6Problems(draft)).toEqual([{ path: "delayedRecall.startedAt", step: "balance", message: "Start delayed recall at least 5 minutes after the last Immediate Memory trial." }]);
        draft.delayedRecall.startedAt = "2026-09-01T09:11";
        expect(scat6Problems(draft)).toEqual([]);
    });

    it("lists only the tick rows the record will include", () => {
        const draft = filledDraft();
        expect(toggleRows(draft).map((row) => row.path)).toEqual([
            "orientation.answers",
            "immediateMemory.trials.0",
            "immediateMemory.trials.1",
            "immediateMemory.trials.2",
            "monthsReverse.correctResponses",
            "delayedRecall.words",
        ]);
        draft.dualTaskGait.performed = true;
        draft.dualTaskGait.printed[2].completed = false;
        expect(toggleRows(draft).map((row) => row.path)).toEqual(
            expect.arrayContaining(["dualTaskGait.practice.correctResponses", "dualTaskGait.sequence.trials.0.correctResponses", "dualTaskGait.sequence.trials.1.correctResponses"]),
        );
        expect(toggleRows(draft).map((row) => row.path)).not.toContain("dualTaskGait.sequence.trials.2.correctResponses");
    });
});

describe("digitTestContinues", () => {
    it("offers the next length after a correct answer, and stops after two wrong trials or the last length", () => {
        expect(digitTestContinues([{ trial1: null, trial2: null }])).toBe(false);
        expect(digitTestContinues([{ trial1: true, trial2: null }])).toBe(true);
        expect(digitTestContinues([{ trial1: false, trial2: true }])).toBe(true);
        expect(digitTestContinues([{ trial1: false, trial2: false }])).toBe(false);
        expect(digitTestContinues([1, 2, 3, 4].map(() => ({ trial1: true, trial2: null })))).toBe(false);
    });
});
