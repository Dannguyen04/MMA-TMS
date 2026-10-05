import { describe, expect, it } from 'vitest';
import { SCAT6 } from './medical.constants.js';
import type { AdministeredScat6 } from './scat6.model.js';
import { scoreScat6 } from './scat6.scoring.js';

describe('scoreScat6', () => {
  const baseAdministeredRecord: AdministeredScat6 = {
    status: 'ADMINISTERED',
    formVersion: SCAT6.FORM_VERSION,
    administeredAt: '2026-10-01T10:00:00.000Z',
    examinerAttestation: true,
    athlete: {
      dominantHand: 'RIGHT',
      sportTeamSchool: null,
      currentSchoolYear: null,
      yearsOfEducation: 16,
      firstLanguage: 'English',
      preferredLanguage: 'English',
    },
    concussionHistory: {
      priorDiagnosedConcussions: 0,
      mostRecentConcussion: null,
      primarySymptoms: null,
      mostRecentRecoveryDays: null,
    },
    immediateAssessment: {
      performed: false,
      reason: 'Standard baseline examination in clinic',
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
      performed: true,
      ratings: [
        0, 1, 2, 0, 3, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0,
      ],
      worseWithPhysicalActivity: false,
      worseWithMentalActivity: false,
      percentOfNormal: 100,
      notNormalReason: null,
    },
    orientation: {
      performed: true,
      answers: [true, true, true, false, true],
    },
    immediateMemory: {
      performed: true,
      wordList: 'A',
      trials: [
        [true, true, true, false, false, false, false, false, false, false], // 3
        [true, true, true, true, false, false, false, false, false, false], // 4
        [true, true, true, true, true, false, false, false, false, false], // 5
      ],
      lastTrialCompletedAt: '2026-10-01T10:05:00.000Z',
    },
    digitsBackward: {
      performed: true,
      digitList: 'A',
      strings: [
        { trial1Correct: true, trial2Correct: null }, // length 3: 1 pt
        { trial1Correct: false, trial2Correct: true }, // length 4: 1 pt
        { trial1Correct: true, trial2Correct: null }, // length 5: 1 pt
        { trial1Correct: false, trial2Correct: false }, // length 6: 0 pt & stops
      ],
    },
    monthsReverse: {
      performed: true,
      correctResponses: Array(12).fill(true),
      timeSeconds: 15.5,
      errors: 0,
    },
    mbess: {
      performed: true,
      footTested: 'RIGHT',
      testingSurface: 'Hard floor',
      footwear: 'Barefoot',
      firm: {
        doubleLeg: { unableToHoldFiveSeconds: false, errors: 1 },
        singleLeg: { unableToHoldFiveSeconds: false, errors: 3 },
        tandem: { unableToHoldFiveSeconds: false, errors: 2 },
      },
      foam: { performed: false },
    },
    tandemGait: {
      performed: true,
      trials: [
        { completed: true, timeSeconds: 12.4 },
        { completed: true, timeSeconds: 11.2 },
        { completed: true, timeSeconds: 13.0 },
      ],
    },
    dualTaskGait: {
      performed: false,
      reason: 'Not tested at baseline',
    },
    gaitIncompleteReason: null,
    delayedRecall: {
      performed: true,
      startedAt: '2026-10-01T10:15:00.000Z',
      words: [true, true, false, false, true, false, false, false, false, false], // 3
    },
    differentFromUsualSelf: 'NO',
    concussionDiagnosed: 'NO',
    clinicalNotes: null,
  };

  it('correctly scores all standard baseline sections when fully performed', () => {
    const scores = scoreScat6(baseAdministeredRecord);

    // Immediate Assessment not performed
    expect(scores.maddocks).toBeNull();
    expect(scores.glasgowComaScale).toBeNull();

    // Symptoms: 3 positive ratings (1, 2, 3), count = 3, severity = 6
    expect(scores.symptomCount).toBe(3);
    expect(scores.symptomSeverity).toBe(6);

    // Orientation: 4 trues out of 5
    expect(scores.orientation).toBe(4);

    // Immediate Memory: trials [3, 4, 5], total = 12
    expect(scores.immediateMemoryTrials).toEqual([3, 4, 5]);
    expect(scores.immediateMemory).toBe(12);

    // Digits Backward: 3 string lengths correct
    expect(scores.digitsBackward).toBe(3);

    // Months reverse: 0 errors and 15.5s (< 30s) => 1 point
    expect(scores.monthsReverse).toBe(1);

    // Concentration: 3 + 1 = 4
    expect(scores.concentration).toBe(4);

    // Delayed Recall: 3
    expect(scores.delayedRecall).toBe(3);

    // Cognitive total: orientation (4) + immediateMemory (12) + concentration (4) + delayedRecall (3) = 23
    expect(scores.cognitiveTotal).toBe(23);

    // mBESS firm: 1 + 3 + 2 = 6
    expect(scores.mbessFirmTotal).toBe(6);
    expect(scores.mbessFoamTotal).toBeNull();

    // Tandem gait: times [12.4, 11.2, 13.0]
    expect(scores.tandemGaitFastestSeconds).toBe(11.2);
    expect(scores.tandemGaitAverageSeconds).toBe(12.2);

    // Dual task not performed
    expect(scores.dualTaskGaitFastestSeconds).toBeNull();

    // Complete flag: cognitiveTotal (23) !== null && symptomSeverity (6) !== null && mbessFirmTotal (6) !== null
    expect(scores.complete).toBe(true);
  });

  describe('Immediate Assessment (Maddocks & Glasgow Coma Scale)', () => {
    it('computes Maddocks and GCS totals when immediate assessment is performed', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        immediateAssessment: {
          performed: true,
          observableSigns: {
            witnessed: true,
            observedOnVideo: false,
            signs: Array(8).fill(false),
          },
          glasgowComaScale: [
            {
              assessedAt: '2026-10-01T10:00:00.000Z',
              eye: 4,
              verbal: 5,
              motor: 6,
            },
            {
              assessedAt: '2026-10-01T10:05:00.000Z',
              eye: 3,
              verbal: 4,
              motor: 5,
            },
          ],
          cervicalSpine: {
            neckPainAtRest: false,
            tendernessToPalpation: false,
            fullActiveRangeOfMotion: true,
            limbStrengthAndSensationNormal: true,
          },
          coordinationOcularMotor: {
            fingerToNoseNormal: true,
            ocularMotorWithoutDoubleVision: true,
            extraocularMovementsNormal: true,
            extraocularDescription: null,
          },
          maddocks: [true, true, true, false, true],
        },
      };

      const scores = scoreScat6(record);
      expect(scores.maddocks).toBe(4);
      expect(scores.glasgowComaScale).toEqual([15, 12]);
    });
  });

  describe('Months in reverse scoring rule (Expectation A)', () => {
    it('scores 1 when all 12 are true, errors: 0, and timeSeconds is 29.9s', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        monthsReverse: {
          performed: true,
          correctResponses: Array(12).fill(true),
          timeSeconds: 29.9,
          errors: 0,
        },
      };
      const scores = scoreScat6(record);
      expect(scores.monthsReverse).toBe(1);
      // digitsBackward is 3, concentration = 3 + 1 = 4
      expect(scores.concentration).toBe(4);
    });

    it('scores 0 when timeSeconds is exactly 30.0s (boundary check)', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        monthsReverse: {
          performed: true,
          correctResponses: Array(12).fill(true),
          timeSeconds: 30.0,
          errors: 0,
        },
      };
      const scores = scoreScat6(record);
      expect(scores.monthsReverse).toBe(0);
      expect(scores.concentration).toBe(3);
    });

    it('scores 0 when errors is 1 even if timeSeconds < 30', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        monthsReverse: {
          performed: true,
          correctResponses: Array(12).fill(true),
          timeSeconds: 20.0,
          errors: 1,
        },
      };
      const scores = scoreScat6(record);
      expect(scores.monthsReverse).toBe(0);
    });

    it('scores 0 if any correctResponse is false even if errors: 0 and timeSeconds < 30 (scorer self-protection)', () => {
      const responses = Array(12).fill(true);
      responses[5] = false;
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        monthsReverse: {
          performed: true,
          correctResponses: responses,
          timeSeconds: 25.0,
          errors: 0,
        },
      };
      const scores = scoreScat6(record);
      expect(scores.monthsReverse).toBe(0);
    });

    it('returns null for monthsReverse, concentration, and cognitiveTotal when monthsReverse is not performed', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        monthsReverse: {
          performed: false,
          reason: 'Language barrier on calendar months',
        },
      };
      const scores = scoreScat6(record);
      expect(scores.monthsReverse).toBeNull();
      expect(scores.concentration).toBeNull();
      expect(scores.cognitiveTotal).toBeNull();
      expect(scores.complete).toBe(false);
    });

    it('digitsBackward (4) + monthsReverse (1) = concentration (5)', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        digitsBackward: {
          performed: true,
          digitList: 'A',
          strings: [
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
            { trial1Correct: true, trial2Correct: null },
          ],
        },
        monthsReverse: {
          performed: true,
          correctResponses: Array(12).fill(true),
          timeSeconds: 20.0,
          errors: 0,
        },
      };
      const scores = scoreScat6(record);
      expect(scores.digitsBackward).toBe(4);
      expect(scores.monthsReverse).toBe(1);
      expect(scores.concentration).toBe(5);
    });
  });

  describe('mBESS unableToHoldFiveSeconds scoring rule', () => {
    it('assigns maximum 10 errors when unable to hold stance for 5 seconds', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        mbess: {
          performed: true,
          footTested: 'LEFT',
          testingSurface: 'Mat',
          footwear: 'Barefoot',
          firm: {
            doubleLeg: { unableToHoldFiveSeconds: false, errors: 2 },
            singleLeg: { unableToHoldFiveSeconds: true },
            tandem: { unableToHoldFiveSeconds: false, errors: 4 },
          },
          foam: {
            performed: true,
            stances: {
              doubleLeg: { unableToHoldFiveSeconds: true },
              singleLeg: { unableToHoldFiveSeconds: true },
              tandem: { unableToHoldFiveSeconds: false, errors: 8 },
            },
          },
        },
      };

      const scores = scoreScat6(record);
      expect(scores.mbessFirmTotal).toBe(2 + 10 + 4); // 16
      expect(scores.mbessFoamTotal).toBe(10 + 10 + 8); // 28
    });
  });

  describe('Tandem Gait averaging and incomplete trials', () => {
    it('returns null for average if any trial was not completed', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        tandemGait: {
          performed: true,
          trials: [
            { completed: true, timeSeconds: 12.0 },
            { completed: false },
            { completed: true, timeSeconds: 14.0 },
          ],
        },
        gaitIncompleteReason: 'Loss of balance on trial 2',
      };

      const scores = scoreScat6(record);
      expect(scores.tandemGaitFastestSeconds).toBe(12.0);
      expect(scores.tandemGaitAverageSeconds).toBeNull();
    });

    it('returns null for both fastest and average if all trials were not completed', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        tandemGait: {
          performed: true,
          trials: [
            { completed: false },
            { completed: false },
            { completed: false },
          ],
        },
        gaitIncompleteReason: 'Unable to perform tandem gait test safely',
      };

      const scores = scoreScat6(record);
      expect(scores.tandemGaitFastestSeconds).toBeNull();
      expect(scores.tandemGaitAverageSeconds).toBeNull();
    });
  });

  describe('Dual Task Gait scoring', () => {
    it('calculates fastest time for PRINTED sequences', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        dualTaskGait: {
          performed: true,
          subtractionStep: 7,
          practice: {
            correctResponses: Array(8).fill(true),
            errors: 0,
            timeSeconds: 10,
          },
          sequence: {
            kind: 'PRINTED',
            trials: [
              {
                completed: true,
                correctResponses: Array(13).fill(true),
                errors: 0,
                timeSeconds: 15.2,
              },
              {
                completed: true,
                correctResponses: Array(13).fill(true),
                errors: 1,
                timeSeconds: 13.8,
              },
              {
                completed: false,
                correctResponses: null,
              },
            ],
          },
        },
        gaitIncompleteReason: 'Stopped dual-task trial 3 early',
      };

      const scores = scoreScat6(record);
      expect(scores.dualTaskGaitFastestSeconds).toBe(13.8);
    });

    it('calculates fastest time for ALTERNATE sequence', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        dualTaskGait: {
          performed: true,
          subtractionStep: 3,
          practice: {
            correctResponses: Array(8).fill(true),
            errors: 0,
            timeSeconds: 10,
          },
          sequence: {
            kind: 'ALTERNATE',
            startingInteger: 100,
            responses: [97, 94, 91, 88],
            trial: {
              completed: true,
              errors: 0,
              timeSeconds: 14.5,
            },
          },
        },
      };

      const scores = scoreScat6(record);
      expect(scores.dualTaskGaitFastestSeconds).toBe(14.5);
    });
  });

  describe('Null propagation and incomplete records', () => {
    it('sets cognitiveTotal to null and complete to false if delayed recall is not performed', () => {
      const record: AdministeredScat6 = {
        ...baseAdministeredRecord,
        delayedRecall: {
          performed: false,
          reason: 'Patient departed before 5 minute delay',
        },
      };

      const scores = scoreScat6(record);
      expect(scores.delayedRecall).toBeNull();
      expect(scores.cognitiveTotal).toBeNull();
      expect(scores.complete).toBe(false);
    });

    it('sets complete to false if symptoms or mBESS is not performed', () => {
      const recordNoSymptoms: AdministeredScat6 = {
        ...baseAdministeredRecord,
        symptoms: {
          performed: false,
          reason: 'Unable to communicate symptoms',
        },
      };

      const scoresNoSymptoms = scoreScat6(recordNoSymptoms);
      expect(scoresNoSymptoms.symptomCount).toBeNull();
      expect(scoresNoSymptoms.symptomSeverity).toBeNull();
      expect(scoresNoSymptoms.complete).toBe(false);

      const recordNoMbess: AdministeredScat6 = {
        ...baseAdministeredRecord,
        mbess: {
          performed: false,
          reason: 'Lower extremity injury prevents standing',
        },
      };

      const scoresNoMbess = scoreScat6(recordNoMbess);
      expect(scoresNoMbess.mbessFirmTotal).toBeNull();
      expect(scoresNoMbess.complete).toBe(false);
    });
  });
});
