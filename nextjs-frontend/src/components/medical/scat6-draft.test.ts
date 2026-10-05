import { describe, expect, it } from "vitest";

import { scat6InputSchema } from "@/lib/domain/scat6";
import { anyGaitTrialIncomplete, digitTestContinues, emptyScat6Draft, scat6FromDraft, type Scat6Draft } from "./scat6-draft";

const START = "2026-09-01T09:00";

/** A blank form with every answer the record needs filled in. */
function filledDraft(): Scat6Draft {
    const draft = emptyScat6Draft(START);
    draft.examinerAttestation = true;
    draft.athlete.dominantHand = "RIGHT";
    draft.immediateMemory.wordList = "A";
    draft.immediateMemory.lastTrialCompletedAt = "2026-09-01T09:06";
    draft.digitsBackward.digitList = "C";
    draft.digitsBackward.strings = [
        { trial1: true, trial2: null },
        { trial1: false, trial2: false },
    ];
    draft.monthsReverse.correct = draft.monthsReverse.correct.map(() => true);
    draft.monthsReverse.timeSeconds = "21";
    draft.monthsReverse.errors = "0";
    draft.mbess.footTested = "LEFT";
    draft.mbess.testingSurface = "Mat";
    draft.mbess.footwear = "Barefoot";
    for (const stance of [draft.mbess.firm.doubleLeg, draft.mbess.firm.singleLeg, draft.mbess.firm.tandem]) stance.errors = "1";
    draft.tandemGait.trials.forEach((trial, index) => (trial.timeSeconds = String(10 + index)));
    draft.delayedRecall.startedAt = "2026-09-01T09:15";
    draft.differentFromUsualSelf = "NO";
    return draft;
}

const paths = (draft: Scat6Draft) => {
    const result = scat6InputSchema.safeParse(scat6FromDraft(draft));
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("scat6FromDraft", () => {
    it("turns a completed form into a record the medical service accepts, with times as academy instants", () => {
        const record = scat6FromDraft(filledDraft());
        expect(scat6InputSchema.safeParse(record).success).toBe(true);
        expect(record).toMatchObject({ administeredAt: "2026-09-01T02:00:00.000Z", immediateAssessment: { performed: false, reason: "Baseline assessment, no injury." } });
    });

    it("leaves blank answers for the schema to name instead of guessing them", () => {
        expect(paths(emptyScat6Draft(START))).toEqual(
            expect.arrayContaining([
                "examinerAttestation",
                "athlete.dominantHand",
                "immediateMemory.wordList",
                "digitsBackward.digitList",
                "monthsReverse.timeSeconds",
                "mbess.footTested",
                "tandemGait.trials.0.timeSeconds",
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
