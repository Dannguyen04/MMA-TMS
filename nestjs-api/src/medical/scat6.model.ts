import { z } from 'zod';
import {
  nullableTrimmedTextSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { SCAT6, SCAT6_LISTS } from './medical.constants.js';

/**
 * SCAT6 baseline record (official English form, adolescents 13+ and adults).
 *
 * Items are recorded by their position on the official form: arrays follow
 * the form's order exactly (e.g. `symptoms.ratings[0]` is the first symptom
 * row). Every off-field section is either performed with its raw answers or
 * recorded as not performed with a reason: nothing is assumed 0 or normal.
 * Scores are never accepted from the client; see `scoreScat6`.
 */

const pastDateTime = z
  .string()
  .datetime()
  .refine(
    (value) => new Date(value).getTime() <= Date.now(),
    'Must not be in the future',
  );

const items = (length: number) => z.array(z.boolean()).length(length);
const seconds = z.number().finite().positive().max(3_600);
const errorCount = (max: number) => z.number().int().min(0).max(max);
const scat6List = z.enum(SCAT6_LISTS);

const notPerformedSchema = z.strictObject({
  performed: z.literal(false),
  reason: trimmedTextSchema(1_000),
});

/** A section performed with its answers, or explicitly not performed. */
function section<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.discriminatedUnion('performed', [
    notPerformedSchema,
    z.strictObject({ performed: z.literal(true), ...shape }),
  ]);
}

// --- Immediate assessment / neuro screen (optional at baseline) ---

const immediateAssessmentSchema = section({
  observableSigns: z.strictObject({
    witnessed: z.boolean(),
    observedOnVideo: z.boolean(),
    /** Y/N per sign, in form order. */
    signs: items(SCAT6.OBSERVABLE_SIGNS),
  }),
  glasgowComaScale: z
    .array(
      z.strictObject({
        assessedAt: pastDateTime,
        eye: z.number().int().min(1).max(4),
        verbal: z.number().int().min(1).max(5),
        motor: z.number().int().min(1).max(6),
      }),
    )
    .min(1)
    .max(SCAT6.GCS_MAX_ASSESSMENTS),
  cervicalSpine: z
    .strictObject({
      neckPainAtRest: z.boolean(),
      tendernessToPalpation: z.boolean(),
      /** Asked only when there is NO neck pain and NO tenderness. */
      fullActiveRangeOfMotion: z.boolean().nullable(),
      limbStrengthAndSensationNormal: z.boolean(),
    })
    .refine(
      (data) =>
        (data.neckPainAtRest || data.tendernessToPalpation) ===
        (data.fullActiveRangeOfMotion === null),
      {
        message:
          'fullActiveRangeOfMotion is answered only when there is no neck pain and no tenderness',
        path: ['fullActiveRangeOfMotion'],
      },
    ),
  coordinationOcularMotor: z
    .strictObject({
      fingerToNoseNormal: z.boolean(),
      ocularMotorWithoutDoubleVision: z.boolean(),
      extraocularMovementsNormal: z.boolean(),
      extraocularDescription: nullableTrimmedTextSchema(1_000),
    })
    .refine(
      (data) =>
        data.extraocularMovementsNormal ||
        data.extraocularDescription !== null,
      {
        message: 'Describe abnormal extraocular movements',
        path: ['extraocularDescription'],
      },
    ),
  /** 1 point per correct answer, in form order. */
  maddocks: items(SCAT6.MADDOCKS_QUESTIONS),
});

// --- Off-field assessment ---

const symptomsSchema = section({
  /** Athlete-rated 0-6, in form order. At baseline every item applies. */
  ratings: z
    .array(z.number().int().min(0).max(SCAT6.SYMPTOM_MAX_RATING))
    .length(SCAT6.SYMPTOMS),
  worseWithPhysicalActivity: z.boolean(),
  worseWithMentalActivity: z.boolean(),
  percentOfNormal: z.number().int().min(0).max(100),
  notNormalReason: nullableTrimmedTextSchema(1_000),
});

const orientationSchema = section({
  answers: items(SCAT6.ORIENTATION_QUESTIONS),
});

const immediateMemorySchema = section({
  wordList: scat6List,
  /** All 3 trials are always administered; one Y/N per word, in list order. */
  trials: z.array(items(SCAT6.WORDS_PER_LIST)).length(SCAT6.MEMORY_TRIALS),
  lastTrialCompletedAt: pastDateTime,
});

/**
 * One entry per string length administered, shortest first. Trial 2 is given
 * only when trial 1 is wrong; the test ends after both trials of a length are
 * wrong, otherwise all lengths are administered.
 */
const digitsBackwardSchema = section({
  digitList: scat6List,
  strings: z
    .array(
      z.strictObject({
        trial1Correct: z.boolean(),
        trial2Correct: z.boolean().nullable(),
      }),
    )
    .min(1)
    .max(SCAT6.DIGIT_STRING_LENGTHS)
    .superRefine((strings, ctx) => {
      strings.forEach((entry, index) => {
        if (entry.trial1Correct !== (entry.trial2Correct === null)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'trial2Correct'],
            message: 'Trial 2 is recorded exactly when trial 1 is incorrect',
          });
        }
        const failed =
          !entry.trial1Correct && entry.trial2Correct === false;
        if (failed && index !== strings.length - 1) {
          ctx.addIssue({
            code: 'custom',
            path: [index + 1],
            message: 'The test ends after both trials of a length are incorrect',
          });
        }
      });
      const last = strings.at(-1);
      const stopped =
        last !== undefined &&
        !last.trial1Correct &&
        last.trial2Correct === false;
      if (!stopped && strings.length !== SCAT6.DIGIT_STRING_LENGTHS) {
        ctx.addIssue({
          code: 'custom',
          path: [],
          message: 'Every string length is administered until the test ends',
        });
      }
    }),
});

const monthsReverseSchema = section({
  /** Circled correct responses, in the form's order (last month first). */
  correctResponses: items(SCAT6.MONTHS),
  timeSeconds: seconds,
  errors: errorCount(SCAT6.MONTHS),
});

/** A stance not held for 5 s at the start scores the maximum (10). */
const stanceSchema = z.discriminatedUnion('unableToHoldFiveSeconds', [
  z.strictObject({ unableToHoldFiveSeconds: z.literal(true) }),
  z.strictObject({
    unableToHoldFiveSeconds: z.literal(false),
    errors: errorCount(SCAT6.MBESS_MAX_ERRORS),
  }),
]);

const stancesSchema = z.strictObject({
  doubleLeg: stanceSchema,
  singleLeg: stanceSchema,
  tandem: stanceSchema,
});

const mbessSchema = section({
  footTested: z.enum(['LEFT', 'RIGHT']),
  testingSurface: trimmedTextSchema(200),
  footwear: trimmedTextSchema(200),
  firm: stancesSchema,
  /** Optional foam condition: same stances and scoring. */
  foam: z.discriminatedUnion('performed', [
    z.strictObject({ performed: z.literal(false) }),
    z.strictObject({ performed: z.literal(true), stances: stancesSchema }),
  ]),
});

const gaitTrialSchema = z.discriminatedUnion('completed', [
  z.strictObject({ completed: z.literal(true), timeSeconds: seconds }),
  z.strictObject({ completed: z.literal(false) }),
]);

const tandemGaitSchema = section({
  trials: z.array(gaitTrialSchema).length(SCAT6.GAIT_TRIALS),
});

const subtractionErrors = z.number().int().min(0).max(100);

/**
 * One printed dual-task trial: the circled correct responses for each printed
 * value, in form order. An incomplete trial keeps the marks recorded before it
 * stopped (null when none were recorded); it has no time or error total.
 */
const dualTaskTrialSchema = z.discriminatedUnion('completed', [
  z.strictObject({
    completed: z.literal(true),
    correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES),
    errors: subtractionErrors,
    timeSeconds: seconds,
  }),
  z.strictObject({
    completed: z.literal(false),
    correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES).nullable(),
  }),
]);

/**
 * The trials used: the three printed serial-7 sequences, or the form's
 * alternate row (a different starting integer and/or subtraction step) with
 * the numbers the athlete said, in order.
 */
const dualTaskSequenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('PRINTED'),
    trials: z.array(dualTaskTrialSchema).length(SCAT6.GAIT_TRIALS),
  }),
  z.strictObject({
    kind: z.literal('ALTERNATE'),
    startingInteger: z.number().int().min(1).max(1_000),
    responses: z
      .array(z.number().int().min(-1_000).max(1_000))
      .max(SCAT6.DUAL_TASK_ALTERNATE_MAX_RESPONSES),
    trial: z.discriminatedUnion('completed', [
      z.strictObject({
        completed: z.literal(true),
        errors: subtractionErrors,
        timeSeconds: seconds,
      }),
      z.strictObject({ completed: z.literal(false) }),
    ]),
  }),
]);

/** Optional; the timed tandem gait (all 3 trials) must be completed first. */
const dualTaskGaitSchema = section({
  /** 7 unless the athlete could not complete the practice with 7s (noted). */
  subtractionStep: z.number().int().min(1).max(20),
  /** The printed practice sequence (counting backwards only). */
  practice: z.strictObject({
    correctResponses: items(SCAT6.DUAL_TASK_PRACTICE_RESPONSES),
    errors: subtractionErrors,
    timeSeconds: seconds.nullable(),
  }),
  sequence: dualTaskSequenceSchema,
});

const delayedRecallSchema = section({
  startedAt: pastDateTime,
  /** Same list as Immediate Memory; one Y/N per word, in list order. */
  words: items(SCAT6.WORDS_PER_LIST),
});

const administeredScat6Schema = z
  .strictObject({
    status: z.literal('ADMINISTERED'),
    formVersion: z.literal(SCAT6.FORM_VERSION),
    administeredAt: pastDateTime,
    /** "I am an HCP and I have personally administered or supervised…" */
    examinerAttestation: z.literal(true),
    athlete: z.strictObject({
      dominantHand: z.enum(['LEFT', 'RIGHT', 'AMBIDEXTROUS']),
      sportTeamSchool: nullableTrimmedTextSchema(200),
      currentSchoolYear: nullableTrimmedTextSchema(50),
      yearsOfEducation: z.number().int().min(0).max(40).nullable(),
      firstLanguage: nullableTrimmedTextSchema(100),
      preferredLanguage: nullableTrimmedTextSchema(100),
    }),
    concussionHistory: z.strictObject({
      priorDiagnosedConcussions: z.number().int().min(0).max(100),
      mostRecentConcussion: nullableTrimmedTextSchema(200),
      primarySymptoms: nullableTrimmedTextSchema(1_000),
      mostRecentRecoveryDays: z.number().int().min(0).max(3_650).nullable(),
    }),
    immediateAssessment: immediateAssessmentSchema,
    background: z.strictObject({
      hospitalisedForHeadInjury: z.boolean(),
      headacheDisorderOrMigraine: z.boolean(),
      learningDisabilityOrDyslexia: z.boolean(),
      adhd: z.boolean(),
      depressionAnxietyOrOtherPsychological: z.boolean(),
      notes: nullableTrimmedTextSchema(2_000),
      currentMedications: nullableTrimmedTextSchema(2_000),
    }),
    symptoms: symptomsSchema,
    orientation: orientationSchema,
    immediateMemory: immediateMemorySchema,
    digitsBackward: digitsBackwardSchema,
    monthsReverse: monthsReverseSchema,
    mbess: mbessSchema,
    tandemGait: tandemGaitSchema,
    dualTaskGait: dualTaskGaitSchema,
    /** Required when any single- or dual-task gait trial was not completed. */
    gaitIncompleteReason: nullableTrimmedTextSchema(1_000),
    delayedRecall: delayedRecallSchema,
    differentFromUsualSelf: z.enum(['YES', 'NO', 'NOT_APPLICABLE']),
    concussionDiagnosed: z.enum(['YES', 'NO', 'DEFERRED']).nullable(),
    clinicalNotes: nullableTrimmedTextSchema(4_000),
  })
  .superRefine((data, ctx) => {
    // A month not circled as correct is an error: it cannot coexist with
    // `errors: 0`. Errors may exceed the uncircled cells (a self-corrected
    // slip still counts), so no equality is required.
    if (
      data.monthsReverse.performed &&
      data.monthsReverse.errors === 0 &&
      data.monthsReverse.correctResponses.includes(false)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['monthsReverse', 'errors'],
        message: 'A month not circled as correct must be counted as an error',
      });
    }
    const tandemCompleted =
      data.tandemGait.performed &&
      data.tandemGait.trials.every((trial) => trial.completed);
    if (data.dualTaskGait.performed && !tandemCompleted) {
      ctx.addIssue({
        code: 'custom',
        path: ['dualTaskGait'],
        message:
          'The timed tandem gait (all 3 trials) must be completed before the dual task',
      });
    }
    const dual = data.dualTaskGait.performed ? data.dualTaskGait : undefined;
    if (
      dual?.sequence.kind === 'PRINTED' &&
      dual.subtractionStep !== SCAT6.DUAL_TASK_STEP
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dualTaskGait', 'sequence'],
        message:
          'The printed sequences count down by 7; record another step on the alternate row',
      });
    }
    const gaitTrials = [
      ...(data.tandemGait.performed ? data.tandemGait.trials : []),
      ...(dual === undefined
        ? []
        : dual.sequence.kind === 'PRINTED'
          ? dual.sequence.trials
          : [dual.sequence.trial]),
    ];
    const anyIncomplete = gaitTrials.some((trial) => !trial.completed);
    if (anyIncomplete !== (data.gaitIncompleteReason !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['gaitIncompleteReason'],
        message: anyIncomplete
          ? 'Explain why a gait trial was not completed'
          : 'Only recorded when a gait trial was not completed',
      });
    }
    if (data.delayedRecall.performed) {
      if (!data.immediateMemory.performed) {
        ctx.addIssue({
          code: 'custom',
          path: ['delayedRecall'],
          message: 'Delayed recall uses the Immediate Memory word list',
        });
      } else {
        const elapsed =
          new Date(data.delayedRecall.startedAt).getTime() -
          new Date(data.immediateMemory.lastTrialCompletedAt).getTime();
        if (elapsed < SCAT6.DELAYED_RECALL_MIN_DELAY_MS) {
          ctx.addIssue({
            code: 'custom',
            path: ['delayedRecall', 'startedAt'],
            message:
              'Delayed recall starts at least 5 minutes after the last Immediate Memory trial',
          });
        }
      }
    }
    if (
      data.immediateMemory.performed &&
      new Date(data.immediateMemory.lastTrialCompletedAt).getTime() <
        new Date(data.administeredAt).getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['immediateMemory', 'lastTrialCompletedAt'],
        message: 'Must not be before administeredAt',
      });
    }
  });

/** Baseline without a SCAT6 (e.g. under 13, or clinically not appropriate). */
const notAdministeredScat6Schema = z.strictObject({
  status: z.literal('NOT_ADMINISTERED'),
  formVersion: z.literal(SCAT6.FORM_VERSION),
  reason: trimmedTextSchema(2_000),
});

export const scat6InputSchema = z.discriminatedUnion('status', [
  administeredScat6Schema,
  notAdministeredScat6Schema,
]);

const nullableScore = z.number().nullable();

/**
 * Backend-computed SCAT6 scores. `null` means "not computable": the section
 * was not performed or a component it depends on is missing. Symptom maxima
 * at baseline are 22 / 132 (the sleep-item exception applies only
 * immediately post injury).
 */
export const scat6ScoresSchema = z.strictObject({
  maddocks: nullableScore,
  glasgowComaScale: z.array(z.number()).nullable(),
  symptomCount: nullableScore,
  symptomSeverity: nullableScore,
  orientation: nullableScore,
  immediateMemoryTrials: z.array(z.number()).nullable(),
  immediateMemory: nullableScore,
  digitsBackward: nullableScore,
  monthsReverse: nullableScore,
  concentration: nullableScore,
  delayedRecall: nullableScore,
  cognitiveTotal: nullableScore,
  mbessFirmTotal: nullableScore,
  mbessFoamTotal: nullableScore,
  tandemGaitFastestSeconds: nullableScore,
  tandemGaitAverageSeconds: nullableScore,
  dualTaskGaitFastestSeconds: nullableScore,
  /** True when every component of the cognitive total, symptoms and mBESS was computed. */
  complete: z.boolean(),
});

/**
 * Stored answers as written. They were validated against their own form
 * version when recorded; reads must not re-validate them against a newer
 * contract, so only the identifying fields are checked here.
 */
export const storedScat6ResponsesSchema = z.looseObject({
  status: z.enum(['ADMINISTERED', 'NOT_ADMINISTERED']),
  formVersion: z.string(),
});

export const scat6RecordSchema = z.strictObject({
  formVersion: z.string(),
  responses: storedScat6ResponsesSchema,
  scoringVersion: z.number().int().nullable(),
  scores: scat6ScoresSchema.nullable(),
});

export type Scat6Input = z.infer<typeof scat6InputSchema>;
export type AdministeredScat6 = z.infer<typeof administeredScat6Schema>;
export type Scat6Scores = z.infer<typeof scat6ScoresSchema>;
export type Scat6Record = z.infer<typeof scat6RecordSchema>;
