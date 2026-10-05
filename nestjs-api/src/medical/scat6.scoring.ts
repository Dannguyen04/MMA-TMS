import { SCAT6 } from './medical.constants.js';
import type { AdministeredScat6, Scat6Scores } from './scat6.model.js';

/**
 * SCAT6 scoring, version `SCAT6.SCORING_VERSION`, from the raw answers only.
 * Deterministic and side-effect free. A section that was not performed, or a
 * total that depends on one, is `null`: missing answers are never read as 0.
 * No result here is a diagnosis or a clearance decision.
 */

type Stances = Extract<AdministeredScat6['mbess'], { performed: true }>['firm'];
type GaitTrial = { completed: true; timeSeconds: number } | { completed: false };

const count = (values: readonly boolean[]) => values.filter(Boolean).length;
const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

/** A stance not held for 5 s at the start is assigned the maximum, 10. */
function stancesTotal(stances: Stances): number {
  return sum(
    [stances.doubleLeg, stances.singleLeg, stances.tandem].map((stance) =>
      stance.unableToHoldFiveSeconds ? SCAT6.MBESS_MAX_ERRORS : stance.errors,
    ),
  );
}

function completedTimes(trials: readonly GaitTrial[]): number[] {
  return trials.flatMap((trial) => (trial.completed ? [trial.timeSeconds] : []));
}

function fastest(trials: readonly GaitTrial[]): number | null {
  const times = completedTimes(trials);
  return times.length > 0 ? Math.min(...times) : null;
}

/** The form's average of 3 trials exists only when all 3 were completed. */
function averageOfAll(trials: readonly GaitTrial[]): number | null {
  const times = completedTimes(trials);
  return times.length === trials.length ? round2(sum(times) / times.length) : null;
}

const plus = (...parts: (number | null)[]): number | null =>
  parts.some((part) => part === null) ? null : sum(parts as number[]);

export function scoreScat6(record: AdministeredScat6): Scat6Scores {
  const ia = record.immediateAssessment;
  const symptoms = record.symptoms.performed ? record.symptoms.ratings : null;
  const memoryTrials = record.immediateMemory.performed
    ? record.immediateMemory.trials.map(count)
    : null;
  // One point per string length with a correct trial.
  const digitsBackward = record.digitsBackward.performed
    ? record.digitsBackward.strings.filter(
        (entry) => entry.trial1Correct || entry.trial2Correct === true,
      ).length
    : null;
  // 1 point only for the whole sequence correct, no errors, under 30 s.
  const months = record.monthsReverse;
  const monthsReverse = months.performed
    ? months.correctResponses.every(Boolean) &&
      months.errors === 0 &&
      months.timeSeconds < SCAT6.MONTHS_TIME_LIMIT_SECONDS
      ? 1
      : 0
    : null;

  const orientation = record.orientation.performed
    ? count(record.orientation.answers)
    : null;
  const immediateMemory = memoryTrials ? sum(memoryTrials) : null;
  const concentration = plus(digitsBackward, monthsReverse);
  const delayedRecall = record.delayedRecall.performed
    ? count(record.delayedRecall.words)
    : null;
  const cognitiveTotal = plus(
    orientation,
    immediateMemory,
    concentration,
    delayedRecall,
  );
  const symptomCount = symptoms
    ? symptoms.filter((rating) => rating > 0).length
    : null;
  const symptomSeverity = symptoms ? sum(symptoms) : null;
  const mbessFirmTotal = record.mbess.performed
    ? stancesTotal(record.mbess.firm)
    : null;

  return {
    maddocks: ia.performed ? count(ia.maddocks) : null,
    glasgowComaScale: ia.performed
      ? ia.glasgowComaScale.map((gcs) => gcs.eye + gcs.verbal + gcs.motor)
      : null,
    symptomCount,
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
    mbessFoamTotal:
      record.mbess.performed && record.mbess.foam.performed
        ? stancesTotal(record.mbess.foam.stances)
        : null,
    tandemGaitFastestSeconds: record.tandemGait.performed
      ? fastest(record.tandemGait.trials)
      : null,
    tandemGaitAverageSeconds: record.tandemGait.performed
      ? averageOfAll(record.tandemGait.trials)
      : null,
    dualTaskGaitFastestSeconds: record.dualTaskGait.performed
      ? fastest(
          record.dualTaskGait.sequence.kind === 'PRINTED'
            ? record.dualTaskGait.sequence.trials
            : [record.dualTaskGait.sequence.trial],
        )
      : null,
    complete:
      cognitiveTotal !== null &&
      symptomSeverity !== null &&
      mbessFirmTotal !== null,
  };
}
