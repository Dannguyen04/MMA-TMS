import { describe, expect, it } from 'vitest';
import { SCAT6 } from './medical.constants.js';
import {
  scat6InputSchema,
  scat6ScoresSchema,
  storedScat6ResponsesSchema,
  scat6RecordSchema,
} from './scat6.model.js';
import { createExaminationSchema } from './medical.model.js';

describe('SCAT6 and Examination Model Schemas', () => {
  const validAdministeredScat6 = {
    status: 'ADMINISTERED' as const,
    formVersion: SCAT6.FORM_VERSION,
    administeredAt: '2026-10-01T10:00:00.000Z',
    examinerAttestation: true as const,
    athlete: {
      dominantHand: 'RIGHT' as const,
      sportTeamSchool: 'MMA Academy',
      currentSchoolYear: null,
      yearsOfEducation: 16,
      firstLanguage: 'English',
      preferredLanguage: 'English',
    },
    concussionHistory: {
      priorDiagnosedConcussions: 1,
      mostRecentConcussion: '2024-05-12',
      primarySymptoms: 'Headache',
      mostRecentRecoveryDays: 14,
    },
    immediateAssessment: {
      performed: false as const,
      reason: 'Routine baseline',
    },
    background: {
      hospitalisedForHeadInjury: false,
      headacheDisorderOrMigraine: false,
      learningDisabilityOrDyslexia: false,
      adhd: false,
      depressionAnxietyOrOtherPsychological: false,
      notes: null,
      currentMedications: null,
    },
    symptoms: {
      performed: true as const,
      ratings: Array(22).fill(0),
      worseWithPhysicalActivity: false,
      worseWithMentalActivity: false,
      percentOfNormal: 100,
      notNormalReason: null,
    },
    orientation: {
      performed: true as const,
      answers: [true, true, true, true, true],
    },
    immediateMemory: {
      performed: true as const,
      wordList: 'A' as const,
      trials: [
        Array(10).fill(true),
        Array(10).fill(true),
        Array(10).fill(true),
      ],
      lastTrialCompletedAt: '2026-10-01T10:05:00.000Z',
    },
    digitsBackward: {
      performed: true as const,
      digitList: 'A' as const,
      strings: [
        { trial1Correct: true, trial2Correct: null },
        { trial1Correct: true, trial2Correct: null },
        { trial1Correct: true, trial2Correct: null },
        { trial1Correct: true, trial2Correct: null },
      ],
    },
    monthsReverse: {
      performed: true as const,
      correctResponses: Array(12).fill(true),
      timeSeconds: 15.0,
      errors: 0,
    },
    mbess: {
      performed: true as const,
      footTested: 'RIGHT' as const,
      testingSurface: 'Hard floor',
      footwear: 'Barefoot',
      firm: {
        doubleLeg: { unableToHoldFiveSeconds: false as const, errors: 0 },
        singleLeg: { unableToHoldFiveSeconds: false as const, errors: 1 },
        tandem: { unableToHoldFiveSeconds: false as const, errors: 0 },
      },
      foam: { performed: false as const },
    },
    tandemGait: {
      performed: true as const,
      trials: [
        { completed: true as const, timeSeconds: 12.0 },
        { completed: true as const, timeSeconds: 11.5 },
        { completed: true as const, timeSeconds: 12.2 },
      ],
    },
    dualTaskGait: {
      performed: false as const,
      reason: 'Not required at baseline',
    },
    gaitIncompleteReason: null,
    delayedRecall: {
      performed: true as const,
      startedAt: '2026-10-01T10:15:00.000Z',
      words: Array(10).fill(true),
    },
    differentFromUsualSelf: 'NO' as const,
    concussionDiagnosed: 'NO' as const,
    clinicalNotes: null,
  };

  const validBaselineExaminationInput = {
    scope: 'TRAINING' as const,
    decision: 'ELIGIBLE' as const,
    examinedAt: '2026-10-01T10:00:00.000Z',
    reason: 'Annual pre-season baseline examination',
    examinationType: 'BASELINE' as const,
    vitals: {
      weightKg: 77.5,
      restingHeartRate: 58,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      temperatureC: 36.6,
      spo2Pct: 99,
      hydration: 'GOOD' as const,
    },
    assessments: [
      {
        area: 'Cardiovascular',
        result: 'NORMAL' as const,
        note: null,
      },
    ],
    scat6: validAdministeredScat6,
  };

  describe('scat6InputSchema validation', () => {
    it('accepts a valid fully-formed ADMINISTERED SCAT6 record', () => {
      const parsed = scat6InputSchema.safeParse(validAdministeredScat6);
      expect(parsed.success).toBe(true);
    });

    it('accepts a valid NOT_ADMINISTERED SCAT6 record', () => {
      const notAdministered = {
        status: 'NOT_ADMINISTERED' as const,
        formVersion: SCAT6.FORM_VERSION,
        reason: 'Athlete under age 13; pediatric baseline protocol used.',
      };
      const parsed = scat6InputSchema.safeParse(notAdministered);
      expect(parsed.success).toBe(true);
    });

    it('rejects unknown fields via strictObject', () => {
      const invalid = {
        ...validAdministeredScat6,
        extraInjectedField: 'hack',
      };
      const parsed = scat6InputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('rejects future administeredAt timestamps', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const invalid = {
        ...validAdministeredScat6,
        administeredAt: futureDate,
      };
      const parsed = scat6InputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes('future'))).toBe(true);
      }
    });

    it('rejects examinerAttestation false or missing', () => {
      const invalid = {
        ...validAdministeredScat6,
        examinerAttestation: false,
      };
      const parsed = scat6InputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    describe('Months in reverse consistency rules (Expectation A)', () => {
      it('rejects when correctResponses has at least one false and errors is 0 (path: monthsReverse.errors)', () => {
        const falseResponses = Array(12).fill(true);
        falseResponses[3] = false; // uncircled month
        const invalidMonths = {
          ...validAdministeredScat6,
          monthsReverse: {
            performed: true as const,
            correctResponses: falseResponses,
            timeSeconds: 20.0,
            errors: 0, // inconsistent with uncircled month!
          },
        };
        const parsed = scat6InputSchema.safeParse(invalidMonths);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          const issue = parsed.error.issues.find(
            (i) =>
              i.path.includes('monthsReverse') && i.path.includes('errors'),
          );
          expect(issue).toBeDefined();
          expect(issue?.message).toContain('counted as an error');
        }
      });

      it('accepts when correctResponses has false and errors is >= 1', () => {
        const falseResponses = Array(12).fill(true);
        falseResponses[3] = false;
        const validMonths = {
          ...validAdministeredScat6,
          monthsReverse: {
            performed: true as const,
            correctResponses: falseResponses,
            timeSeconds: 20.0,
            errors: 1,
          },
        };
        const parsed = scat6InputSchema.safeParse(validMonths);
        expect(parsed.success).toBe(true);
      });

      it('accepts when all correctResponses are true and errors is > 0 (self-corrected slips)', () => {
        const validMonths = {
          ...validAdministeredScat6,
          monthsReverse: {
            performed: true as const,
            correctResponses: Array(12).fill(true),
            timeSeconds: 25.0,
            errors: 2,
          },
        };
        const parsed = scat6InputSchema.safeParse(validMonths);
        expect(parsed.success).toBe(true);
      });
    });

    it('enforces Digits Backward trial 2 rule: trial 2 recorded iff trial 1 is incorrect', () => {
      // trial 1 true, but trial 2 provided -> invalid
      const invalidTrial2 = {
        ...validAdministeredScat6,
        digitsBackward: {
          performed: true as const,
          digitList: 'A' as const,
          strings: [
            { trial1Correct: true, trial2Correct: true }, // error!
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
          ],
        },
      };
      const parsed1 = scat6InputSchema.safeParse(invalidTrial2);
      expect(parsed1.success).toBe(false);

      // trial 1 false, but trial 2 omitted (null) -> invalid
      const missingTrial2 = {
        ...validAdministeredScat6,
        digitsBackward: {
          performed: true as const,
          digitList: 'A' as const,
          strings: [
            { trial1Correct: false, trial2Correct: null }, // error!
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
          ],
        },
      };
      const parsed2 = scat6InputSchema.safeParse(missingTrial2);
      expect(parsed2.success).toBe(false);
    });

    it('enforces Digits Backward stopping rule: test ends when both trials of a length are incorrect', () => {
      // length 2 failed both trials, but continued to length 3
      const continuedAfterFail = {
        ...validAdministeredScat6,
        digitsBackward: {
          performed: true as const,
          digitList: 'A' as const,
          strings: [
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: false, trial2Correct: false }, // stopped here!
            { trial1Correct: true, trial2Correct: null }, // illegal continuation
          ],
        },
      };
      const parsed = scat6InputSchema.safeParse(continuedAfterFail);
      expect(parsed.success).toBe(false);
    });

    it('enforces Tandem Gait to Dual Task Gait dependency', () => {
      // dualTaskGait performed, but tandemGait was not performed
      const tandemNotPerformed = {
        ...validAdministeredScat6,
        tandemGait: {
          performed: false as const,
          reason: 'Skipped tandem',
        },
        dualTaskGait: {
          performed: true as const,
          subtractionStep: 7,
          practice: {
            correctResponses: Array(8).fill(true),
            errors: 0,
            timeSeconds: 10,
          },
          sequence: {
            kind: 'PRINTED' as const,
            trials: Array(3).fill({
              completed: true as const,
              correctResponses: Array(13).fill(true),
              errors: 0,
              timeSeconds: 15.0,
            }),
          },
        },
      };
      const parsed1 = scat6InputSchema.safeParse(tandemNotPerformed);
      expect(parsed1.success).toBe(false);

      // dualTaskGait performed, but tandemGait had an incomplete trial
      const tandemIncomplete = {
        ...validAdministeredScat6,
        tandemGait: {
          performed: true as const,
          trials: [
            { completed: true as const, timeSeconds: 12.0 },
            { completed: false as const },
            { completed: true as const, timeSeconds: 12.2 },
          ],
        },
        gaitIncompleteReason: 'Trial 2 missed foot placement',
        dualTaskGait: {
          performed: true as const,
          subtractionStep: 7,
          practice: {
            correctResponses: Array(8).fill(true),
            errors: 0,
            timeSeconds: 10,
          },
          sequence: {
            kind: 'PRINTED' as const,
            trials: Array(3).fill({
              completed: true as const,
              correctResponses: Array(13).fill(true),
              errors: 0,
              timeSeconds: 15.0,
            }),
          },
        },
      };
      const parsed2 = scat6InputSchema.safeParse(tandemIncomplete);
      expect(parsed2.success).toBe(false);
    });

    it('enforces gaitIncompleteReason required if and only if any gait trial was incomplete', () => {
      // incomplete trial without reason -> invalid
      const missingReason = {
        ...validAdministeredScat6,
        tandemGait: {
          performed: true as const,
          trials: [
            { completed: true as const, timeSeconds: 12.0 },
            { completed: false as const },
            { completed: true as const, timeSeconds: 12.2 },
          ],
        },
        gaitIncompleteReason: null,
      };
      const parsed1 = scat6InputSchema.safeParse(missingReason);
      expect(parsed1.success).toBe(false);

      // all trials completed but gaitIncompleteReason provided -> invalid
      const unnecessaryReason = {
        ...validAdministeredScat6,
        gaitIncompleteReason: 'All completed why this note',
      };
      const parsed2 = scat6InputSchema.safeParse(unnecessaryReason);
      expect(parsed2.success).toBe(false);
    });

    it('enforces Delayed Recall timing rule (minimum 5 minutes after last Immediate Memory trial)', () => {
      // lastTrial completed at 10:05, delayed recall started at 10:08 (3 minutes, < 5 min)
      const prematureDelayedRecall = {
        ...validAdministeredScat6,
        delayedRecall: {
          performed: true as const,
          startedAt: '2026-10-01T10:08:00.000Z',
          words: Array(10).fill(true),
        },
      };
      const parsed = scat6InputSchema.safeParse(prematureDelayedRecall);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('at least 5 minutes'),
          ),
        ).toBe(true);
      }
    });

    it('requires Immediate Memory performed if Delayed Recall is performed', () => {
      const immediateMemoryNotPerformed = {
        ...validAdministeredScat6,
        immediateMemory: {
          performed: false as const,
          reason: 'Skipped memory test',
        },
        delayedRecall: {
          performed: true as const,
          startedAt: '2026-10-01T10:15:00.000Z',
          words: Array(10).fill(true),
        },
      };
      const parsed = scat6InputSchema.safeParse(immediateMemoryNotPerformed);
      expect(parsed.success).toBe(false);
    });
  });

  describe('createExaminationSchema with BASELINE and Details rules', () => {
    it('accepts valid BASELINE examination with vitals, assessments, and scat6', () => {
      const parsed = createExaminationSchema.safeParse(validBaselineExaminationInput);
      expect(parsed.success).toBe(true);
    });

    it('rejects details if examinationType is omitted', () => {
      const missingType = {
        ...validBaselineExaminationInput,
        examinationType: undefined,
      };
      const parsed = createExaminationSchema.safeParse(missingType);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('examinationType is required'),
          ),
        ).toBe(true);
      }
    });

    it('rejects BASELINE examination if scat6 is missing', () => {
      const missingScat6 = {
        ...validBaselineExaminationInput,
        scat6: undefined,
      };
      const parsed = createExaminationSchema.safeParse(missingScat6);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('BASELINE examination requires its SCAT6 record'),
          ),
        ).toBe(true);
      }
    });

    it('rejects BASELINE examination if vitals are missing', () => {
      const missingVitals = {
        ...validBaselineExaminationInput,
        vitals: undefined,
      };
      const parsed = createExaminationSchema.safeParse(missingVitals);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('BASELINE examination requires vitals'),
          ),
        ).toBe(true);
      }
    });

    it('rejects BASELINE examination if assessments array is empty or missing', () => {
      const missingAssessments = {
        ...validBaselineExaminationInput,
        assessments: [],
      };
      const parsed = createExaminationSchema.safeParse(missingAssessments);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('at least one assessed area'),
          ),
        ).toBe(true);
      }
    });

    it('rejects scat6 on non-BASELINE examinations (e.g. ROUTINE)', () => {
      const routineWithScat6 = {
        ...validBaselineExaminationInput,
        examinationType: 'ROUTINE' as const,
      };
      const parsed = createExaminationSchema.safeParse(routineWithScat6);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some((i) =>
            i.message.includes('only recorded with a BASELINE examination'),
          ),
        ).toBe(true);
      }
    });

    it('allows non-BASELINE examinations (ROUTINE, RETURN_TO_PLAY) with vitals and assessments but no scat6', () => {
      const validRoutine = {
        ...validBaselineExaminationInput,
        examinationType: 'ROUTINE' as const,
        scat6: undefined,
      };
      const parsed = createExaminationSchema.safeParse(validRoutine);
      expect(parsed.success).toBe(true);
    });
  });

  describe('storedScat6ResponsesSchema & scat6RecordSchema', () => {
    it('storedScat6ResponsesSchema loosely accepts arbitrary stored answers provided status and formVersion exist', () => {
      const stored = {
        status: 'ADMINISTERED',
        formVersion: 'SCAT6-2023-EN',
        arbitraryLegacyAnswer: 123,
      };
      const parsed = storedScat6ResponsesSchema.safeParse(stored);
      expect(parsed.success).toBe(true);
    });

    it('scat6RecordSchema validates full record bundle', () => {
      const fullRecord = {
        formVersion: SCAT6.FORM_VERSION,
        responses: {
          status: 'ADMINISTERED',
          formVersion: SCAT6.FORM_VERSION,
        },
        scoringVersion: SCAT6.SCORING_VERSION,
        scores: {
          maddocks: null,
          glasgowComaScale: null,
          symptomCount: 0,
          symptomSeverity: 0,
          orientation: 5,
          immediateMemoryTrials: [10, 10, 10],
          immediateMemory: 30,
          digitsBackward: 4,
          monthsReverse: 1,
          concentration: 5,
          delayedRecall: 10,
          cognitiveTotal: 50,
          mbessFirmTotal: 1,
          mbessFoamTotal: null,
          tandemGaitFastestSeconds: 11.5,
          tandemGaitAverageSeconds: 11.9,
          dualTaskGaitFastestSeconds: null,
          complete: true,
        },
      };
      const parsed = scat6RecordSchema.safeParse(fullRecord);
      expect(parsed.success).toBe(true);
    });
  });
});
