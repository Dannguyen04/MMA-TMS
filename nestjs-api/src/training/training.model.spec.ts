import {
  createExerciseSchema,
  createPlanExerciseSchema,
  createSessionSchema,
  createTrainingPlanSchema,
  listPlansQuerySchema,
  milestoneSchema,
  updateSessionSchema,
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
});
