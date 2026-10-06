import { describe, expect, it } from "vitest";

import { SCAT6, scat6InputSchema } from "./scat6";
import { scoreScat6 } from "./scat6-scoring";

const flags = (length: number, value = true) => Array.from({ length }, () => value);
const held = (errors: number) => ({ unableToHoldFiveSeconds: false, errors });

/** A complete, valid baseline SCAT6 as the medical service takes it. */
function administeredScat6(overrides: Record<string, unknown> = {}) {
    return {
        status: "ADMINISTERED",
        formVersion: SCAT6.FORM_VERSION,
        administeredAt: "2026-09-01T02:00:00.000Z",
        examinerAttestation: true,
        athlete: { dominantHand: "RIGHT", sportTeamSchool: null, currentSchoolYear: null, yearsOfEducation: 12, firstLanguage: "Vietnamese", preferredLanguage: null },
        concussionHistory: { priorDiagnosedConcussions: 0, mostRecentConcussion: null, primarySymptoms: null, mostRecentRecoveryDays: null },
        immediateAssessment: { performed: false, reason: "Baseline, no injury." },
        background: {
            hospitalisedForHeadInjury: false,
            headacheDisorderOrMigraine: false,
            learningDisabilityOrDyslexia: false,
            adhd: false,
            depressionAnxietyOrOtherPsychological: false,
            notes: null,
            currentMedications: null,
        },
        symptoms: { performed: true, ratings: [1, 2, ...Array.from({ length: SCAT6.SYMPTOMS - 2 }, () => 0)], worseWithPhysicalActivity: false, worseWithMentalActivity: false, percentOfNormal: 100, notNormalReason: null },
        orientation: { performed: true, answers: flags(5) },
        immediateMemory: { performed: true, wordList: "A", trials: [flags(10).map((v, i) => i < 7), flags(10).map((v, i) => i < 8), flags(10).map((v, i) => i < 9)], lastTrialCompletedAt: "2026-09-01T02:05:00.000Z" },
        digitsBackward: {
            performed: true,
            digitList: "B",
            strings: [
                { trial1Correct: true, trial2Correct: null },
                { trial1Correct: false, trial2Correct: true },
                { trial1Correct: false, trial2Correct: false },
            ],
        },
        monthsReverse: { performed: true, correctResponses: flags(12), timeSeconds: 24.5, errors: 0 },
        mbess: { performed: true, footTested: "LEFT", testingSurface: "Gym floor", footwear: "Barefoot", firm: { doubleLeg: held(0), singleLeg: held(3), tandem: { unableToHoldFiveSeconds: true } }, foam: { performed: false } },
        tandemGait: { performed: true, trials: [{ completed: true, timeSeconds: 11.2 }, { completed: true, timeSeconds: 10.4 }, { completed: true, timeSeconds: 10.9 }] },
        dualTaskGait: { performed: false, reason: "Not at this baseline." },
        gaitIncompleteReason: null,
        delayedRecall: { performed: true, startedAt: "2026-09-01T02:12:00.000Z", words: flags(10).map((v, i) => i < 6) },
        differentFromUsualSelf: "NOT_APPLICABLE",
        concussionDiagnosed: null,
        clinicalNotes: null,
        ...overrides,
    };
}

const issuePaths = (input: unknown) => {
    const result = scat6InputSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("scat6InputSchema", () => {
    it("accepts a complete baseline and a SCAT6 that wasn't administered", () => {
        expect(issuePaths(administeredScat6())).toEqual([]);
        expect(issuePaths({ status: "NOT_ADMINISTERED", formVersion: SCAT6.FORM_VERSION, reason: "Athlete is 12." })).toEqual([]);
        expect(issuePaths({ status: "NOT_ADMINISTERED", formVersion: SCAT6.FORM_VERSION, reason: " " })).toEqual(["reason"]);
    });

    it("needs the examiner's attestation and never takes scores from the client", () => {
        expect(issuePaths(administeredScat6({ examinerAttestation: false }))).toEqual(["examinerAttestation"]);
        expect(issuePaths(administeredScat6({ scores: { cognitiveTotal: 50 } }))).toContain("");
    });

    it("counts a month not marked correct as an error", () => {
        const months = { performed: true, correctResponses: [...flags(11), false], timeSeconds: 20, errors: 0 };
        expect(issuePaths(administeredScat6({ monthsReverse: months }))).toEqual(["monthsReverse.errors"]);
    });

    it("records trial 2 only after a wrong trial 1 and stops after two wrong trials", () => {
        const digits = (strings: unknown[]) => administeredScat6({ digitsBackward: { performed: true, digitList: "A", strings } });
        expect(issuePaths(digits([{ trial1Correct: true, trial2Correct: false }, ...flags(3).map(() => ({ trial1Correct: true, trial2Correct: null }))]))).toEqual([
            "digitsBackward.strings.0.trial2Correct",
        ]);
        expect(issuePaths(digits([{ trial1Correct: false, trial2Correct: false }, { trial1Correct: true, trial2Correct: null }]))).toContain("digitsBackward.strings.1");
        expect(issuePaths(digits([{ trial1Correct: true, trial2Correct: null }]))).toEqual(["digitsBackward.strings"]);
    });

    it("explains incomplete gait trials, and only then", () => {
        const incomplete = { performed: true, trials: [{ completed: false }, { completed: true, timeSeconds: 10 }, { completed: true, timeSeconds: 10 }] };
        expect(issuePaths(administeredScat6({ tandemGait: incomplete }))).toEqual(["gaitIncompleteReason"]);
        expect(issuePaths(administeredScat6({ tandemGait: incomplete, gaitIncompleteReason: "Lost balance, stopped." }))).toEqual([]);
        expect(issuePaths(administeredScat6({ gaitIncompleteReason: "Nothing stopped." }))).toEqual(["gaitIncompleteReason"]);
    });

    it("runs the dual task only after every tandem trial, counting down by 7 on the printed rows", () => {
        const dual = (subtractionStep: number) => ({
            performed: true,
            subtractionStep,
            practice: { correctResponses: flags(8), errors: 0, timeSeconds: null },
            sequence: { kind: "PRINTED", trials: [1, 2, 3].map(() => ({ completed: true, correctResponses: flags(13), errors: 0, timeSeconds: 14 })) },
        });
        expect(issuePaths(administeredScat6({ dualTaskGait: dual(7) }))).toEqual([]);
        expect(issuePaths(administeredScat6({ dualTaskGait: dual(3) }))).toEqual(["dualTaskGait.sequence"]);
        expect(issuePaths(administeredScat6({ dualTaskGait: dual(7), tandemGait: { performed: false, reason: "Ankle sprain." } }))).toEqual(["dualTaskGait"]);
    });

    it("starts delayed recall at least 5 minutes after the last memory trial", () => {
        expect(issuePaths(administeredScat6({ delayedRecall: { performed: true, startedAt: "2026-09-01T02:08:00.000Z", words: flags(10) } }))).toEqual(["delayedRecall.startedAt"]);
    });

    it("asks the range-of-motion question only without neck findings", () => {
        const assessment = (cervicalSpine: object) =>
            administeredScat6({
                immediateAssessment: {
                    performed: true,
                    observableSigns: { witnessed: false, observedOnVideo: false, signs: flags(8, false) },
                    glasgowComaScale: [{ assessedAt: "2026-09-01T02:00:00.000Z", eye: 4, verbal: 5, motor: 6 }],
                    cervicalSpine,
                    coordinationOcularMotor: { fingerToNoseNormal: true, ocularMotorWithoutDoubleVision: true, extraocularMovementsNormal: true, extraocularDescription: null },
                    maddocks: flags(5),
                },
            });
        expect(issuePaths(assessment({ neckPainAtRest: false, tendernessToPalpation: false, fullActiveRangeOfMotion: true, limbStrengthAndSensationNormal: true }))).toEqual([]);
        expect(issuePaths(assessment({ neckPainAtRest: true, tendernessToPalpation: false, fullActiveRangeOfMotion: true, limbStrengthAndSensationNormal: true }))).toEqual([
            "immediateAssessment.cervicalSpine.fullActiveRangeOfMotion",
        ]);
    });
});

describe("scoreScat6", () => {
    it("scores the record the way the medical service does", () => {
        const parsed = scat6InputSchema.parse(administeredScat6());
        if (parsed.status !== "ADMINISTERED") throw new Error("expected an administered record");
        expect(scoreScat6(parsed)).toEqual({
            maddocks: null,
            glasgowComaScale: null,
            symptomCount: 2,
            symptomSeverity: 3,
            orientation: 5,
            immediateMemoryTrials: [7, 8, 9],
            immediateMemory: 24,
            digitsBackward: 2,
            monthsReverse: 1,
            concentration: 3,
            delayedRecall: 6,
            cognitiveTotal: 38,
            mbessFirmTotal: 13,
            mbessFoamTotal: null,
            tandemGaitFastestSeconds: 10.4,
            tandemGaitAverageSeconds: 10.83,
            dualTaskGaitFastestSeconds: null,
            complete: true,
        });
    });
});
