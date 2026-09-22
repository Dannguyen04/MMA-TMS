import {
  createExerciseSchema,
  createPlanExerciseSchema,
  createSessionSchema,
  createTrainingPlanSchema,
  listPlansQuerySchema,
  milestoneSchema,
  updateSessionSchema,
  updateSessionStatusSchema,
  updatePlanStatusSchema,
  updateExerciseSchema,
  updatePlanExerciseSchema,
  updateTrainingPlanSchema,
} from './training.model.js';

const fighterId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const exerciseId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';

describe('training request schemas', () => {
  it('normalizes a minimal plan and supplies the milestones default', () => {
    expect(
      createTrainingPlanSchema.parse({
        fighterId,
        coachId,
        title: '  Fight camp  ',
        startDate: '2026-09-20',
      }),
    ).toEqual({
      fighterId,
      coachId,
      title: 'Fight camp',
      startDate: '2026-09-20',
      milestones: [],
    });
  });

  it('enforces milestone completion timestamps in both directions', () => {
    expect(
      milestoneSchema.safeParse({ title: 'Conditioning', isCompleted: true })
        .success,
    ).toBe(false);
    expect(
      milestoneSchema.safeParse({
        title: 'Conditioning',
        isCompleted: false,
        completedAt: '2026-09-17T10:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      milestoneSchema.parse({
        title: 'Conditioning',
        isCompleted: true,
        completedAt: '2026-09-17T10:00:00.000Z',
      }),
    ).toMatchObject({ isCompleted: true });
  });

  it('rejects malformed calendar dates and unknown plan properties', () => {
    expect(
      createTrainingPlanSchema.safeParse({
        fighterId,
        coachId,
        title: 'Fight camp',
        startDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(
      createTrainingPlanSchema.safeParse({
        fighterId,
        coachId,
        title: 'Fight camp',
        startDate: '2026-09-20',
        status: 'ACTIVE',
      }).success,
    ).toBe(false);
  });

  it('rejects empty plan updates and immutable ownership fields', () => {
    expect(updateTrainingPlanSchema.safeParse({}).success).toBe(false);
    expect(updateTrainingPlanSchema.safeParse({ fighterId }).success).toBe(
      false,
    );
    expect(updateTrainingPlanSchema.safeParse({ coachId }).success).toBe(false);
  });

  it('coerces pagination and parses both boolean query values exactly', () => {
    expect(
      listPlansQuerySchema.parse({ page: '2', limit: '10', isActive: 'false' }),
    ).toEqual({ page: 2, limit: 10, isActive: false });
    expect(listPlansQuerySchema.parse({ isActive: 'true' })).toEqual({
      page: 1,
      limit: 20,
      isActive: true,
    });
  });

  it.each([
    { page: '0' },
    { limit: '101' },
    { isActive: 'yes' },
    { unexpected: 'field' },
  ])('rejects an invalid list filter: %j', (query) => {
    expect(listPlansQuerySchema.safeParse(query).success).toBe(false);
  });

  it('defaults a minimal session and rejects immutable update fields', () => {
    const session = createSessionSchema.parse({
      fighterId,
      title: 'Pad work',
      scheduledAt: '2026-09-20T10:00:00.000Z',
      sessionType: 'PAD_WORK',
    });

    expect(session.roundCount).toBe(0);
    expect(updateSessionSchema.safeParse({ planId: null }).success).toBe(false);
    expect(updateSessionSchema.safeParse({ status: 'COMPLETED' }).success).toBe(
      false,
    );
    expect(updateSessionSchema.safeParse({}).success).toBe(false);
  });

  it('enforces positive durations and the RPE range', () => {
    expect(
      createSessionSchema.safeParse({
        fighterId,
        title: 'Pad work',
        scheduledAt: '2026-09-20T10:00:00.000Z',
        sessionType: 'PAD_WORK',
        plannedDurationSec: 0,
      }).success,
    ).toBe(false);
    expect(
      createPlanExerciseSchema.safeParse({
        exerciseId,
        orderIndex: 0,
        targetRpe: 11,
      }).success,
    ).toBe(false);
  });

  it('trims exercise input and supplies an empty muscle-group list', () => {
    expect(
      createExerciseSchema.parse({ name: '  Jab  ', category: 'STRIKING' }),
    ).toEqual({
      name: 'Jab',
      category: 'STRIKING',
      targetMuscleGroups: [],
    });
  });

  it('rejects empty exercise and plan-exercise updates', () => {
    expect(updateExerciseSchema.safeParse({}).success).toBe(false);
    expect(updatePlanExerciseSchema.safeParse({}).success).toBe(false);
  });

  describe('updateSessionSchema server-owned fields', () => {
    it('rejects actualDurationSec and cancellationReason in generic session update', () => {
      expect(
        updateSessionSchema.safeParse({
          title: 'New title',
          actualDurationSec: 3600,
        }).success,
      ).toBe(false);

      expect(
        updateSessionSchema.safeParse({
          title: 'New title',
          cancellationReason: 'Rain',
        }).success,
      ).toBe(false);
    });
  });

  describe('updateSessionStatusSchema', () => {
    it('requires a nonempty cancellationReason when status is CANCELLED', () => {
      const missingReason = updateSessionStatusSchema.safeParse({
        status: 'CANCELLED',
      });
      expect(missingReason.success).toBe(false);
      if (!missingReason.success) {
        expect(missingReason.error.issues[0].path).toEqual(['cancellationReason']);
      }

      const emptyReason = updateSessionStatusSchema.safeParse({
        status: 'CANCELLED',
        cancellationReason: '',
      });
      expect(emptyReason.success).toBe(false);

      const whitespaceReason = updateSessionStatusSchema.safeParse({
        status: 'CANCELLED',
        cancellationReason: '   ',
      });
      expect(whitespaceReason.success).toBe(false);

      const tooLongReason = updateSessionStatusSchema.safeParse({
        status: 'CANCELLED',
        cancellationReason: 'a'.repeat(501),
      });
      expect(tooLongReason.success).toBe(false);

      const validCancelled = updateSessionStatusSchema.safeParse({
        status: 'CANCELLED',
        cancellationReason: 'Fighter injured during warmup',
      });
      expect(validCancelled.success).toBe(true);
      if (validCancelled.success) {
        expect(validCancelled.data.cancellationReason).toBe(
          'Fighter injured during warmup',
        );
      }
    });

    it.each(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'ABANDONED'] as const)(
      'rejects cancellationReason when status is %s',
      (status) => {
        const result = updateSessionStatusSchema.safeParse({
          status,
          cancellationReason: 'Not allowed here',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toEqual(['cancellationReason']);
        }
      },
    );

    it.each(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'ABANDONED'] as const)(
      'accepts valid status %s without cancellationReason',
      (status) => {
        expect(updateSessionStatusSchema.safeParse({ status }).success).toBe(true);
      },
    );
  });

  describe('updatePlanStatusSchema', () => {
    it.each(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const)(
      'accepts valid plan status %s',
      (status) => {
        expect(updatePlanStatusSchema.safeParse({ status }).success).toBe(true);
      },
    );

    it('rejects unknown plan status', () => {
      expect(updatePlanStatusSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(
        false,
      );
    });
  });
});
