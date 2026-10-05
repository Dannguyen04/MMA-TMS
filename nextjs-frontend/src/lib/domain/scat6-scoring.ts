import { SCAT6, type AdministeredScat6, type Scat6Scores } from "./scat6";

/**
 * SCAT6 scoring from the raw answers, the same way the medical service scores them (its scoring version 2). Demo mode
 * uses it to stand in for the service; in API mode the service returns the scores. A section that wasn't performed,
 * or a total that depends on one, is null: missing answers are never read as 0. No score is a diagnosis or a decision.
 */

export const SCAT6_SCORING_VERSION = 2;

type Stances = Extract<AdministeredScat6["mbess"], { performed: true }>["firm"];
type GaitTrial = { completed: true; timeSeconds: number } | { completed: false };

const count = (values: readonly boolean[]) => values.filter(Boolean).length;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const round2 = (value: number) => Math.round(value * 100) / 100;
const plus = (...parts: (number | null)[]): number | null => (parts.some((part) => part === null) ? null : sum(parts as number[]));

/** A stance not held for 5 seconds at the start scores the maximum. */
const stancesTotal = (stances: Stances) =>
    sum([stances.doubleLeg, stances.singleLeg, stances.tandem].map((stance) => (stance.unableToHoldFiveSeconds ? SCAT6.MBESS_MAX_ERRORS : stance.errors)));

const completedTimes = (trials: readonly GaitTrial[]) => trials.flatMap((trial) => (trial.completed ? [trial.timeSeconds] : []));

function fastest(trials: readonly GaitTrial[]): number | null {
    const times = completedTimes(trials);
    return times.length > 0 ? Math.min(...times) : null;
}

/** The form's average exists only when every trial was completed. */
function averageOfAll(trials: readonly GaitTrial[]): number | null {
    const times = completedTimes(trials);
    return times.length === trials.length ? round2(sum(times) / times.length) : null;
}

export function scoreScat6(record: AdministeredScat6): Scat6Scores {
    const immediate = record.immediateAssessment;
    const symptoms = record.symptoms.performed ? record.symptoms.ratings : null;
    const memoryTrials = record.immediateMemory.performed ? record.immediateMemory.trials.map(count) : null;
    // One point per string length with a correct trial.
    const digitsBackward = record.digitsBackward.performed ? record.digitsBackward.strings.filter((entry) => entry.trial1Correct || entry.trial2Correct === true).length : null;
    // One point only for every month correct, no errors and under 30 seconds.
    const months = record.monthsReverse;
    const monthsReverse = months.performed ? (months.correctResponses.every(Boolean) && months.errors === 0 && months.timeSeconds < SCAT6.MONTHS_TIME_LIMIT_SECONDS ? 1 : 0) : null;
    const orientation = record.orientation.performed ? count(record.orientation.answers) : null;
    const immediateMemory = memoryTrials ? sum(memoryTrials) : null;
    const concentration = plus(digitsBackward, monthsReverse);
    const delayedRecall = record.delayedRecall.performed ? count(record.delayedRecall.words) : null;
    const cognitiveTotal = plus(orientation, immediateMemory, concentration, delayedRecall);
    const symptomSeverity = symptoms ? sum(symptoms) : null;
    const mbessFirmTotal = record.mbess.performed ? stancesTotal(record.mbess.firm) : null;
    const dual = record.dualTaskGait;

    return {
        maddocks: immediate.performed ? count(immediate.maddocks) : null,
        glasgowComaScale: immediate.performed ? immediate.glasgowComaScale.map((gcs) => gcs.eye + gcs.verbal + gcs.motor) : null,
        symptomCount: symptoms ? symptoms.filter((rating) => rating > 0).length : null,
        symptomSeverity,
        orientation,
        immediateMemoryTrials: memoryTrials,
        immediateMemory,
        digitsBackward,
        monthsReverse,
        concentration,
        delayedRecall,
        cognitiveTotal,
        mbessFirmTotal,
        mbessFoamTotal: record.mbess.performed && record.mbess.foam.performed ? stancesTotal(record.mbess.foam.stances) : null,
        tandemGaitFastestSeconds: record.tandemGait.performed ? fastest(record.tandemGait.trials) : null,
        tandemGaitAverageSeconds: record.tandemGait.performed ? averageOfAll(record.tandemGait.trials) : null,
        dualTaskGaitFastestSeconds: dual.performed ? fastest(dual.sequence.kind === "PRINTED" ? dual.sequence.trials : [dual.sequence.trial]) : null,
        complete: cognitiveTotal !== null && symptomSeverity !== null && mbessFirmTotal !== null,
    };
}
