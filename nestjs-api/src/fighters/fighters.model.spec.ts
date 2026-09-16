import {
  assignCoachSchema,
  endCoachAssignmentSchema,
  fighterIdParamsSchema,
  listFightersQuerySchema,
  listMeasurementsQuerySchema,
  createMeasurementSchema,
  updateFighterProfileSchema,
} from './fighters.model.js';

describe('fighters Zod contracts', () => {
  it('coerces pagination and accepts supported fighter filters', () => {
    expect(
      listFightersQuerySchema.parse({
        page: '2',
        limit: '10',
        weightClass: 'LIGHTWEIGHT',
        dominantStance: 'ORTHODOX',
      }),
    ).toMatchObject({
      page: 2,
      limit: 10,
      weightClass: 'LIGHTWEIGHT',
      dominantStance: 'ORTHODOX',
    });
  });

  it('defaults measurement history to active records only', () => {
    expect(listMeasurementsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      includeSuperseded: false,
    });
    expect(
      listMeasurementsQuerySchema.parse({ includeSuperseded: 'true' }),
    ).toMatchObject({ includeSuperseded: true });
  });

  it('accepts and rounds a valid body measurement', () => {
    expect(
      createMeasurementSchema.parse({
        measurementContext: 'SELF_REPORTED',
        weightKg: 70.356,
      }),
    ).toMatchObject({
      measurementContext: 'SELF_REPORTED',
      weightKg: 70.36,
    });
  });

  it.each(['invalid', -5, 600, Number.POSITIVE_INFINITY])(
    'rejects invalid body weight %s',
    (weightKg) => {
      expect(
        createMeasurementSchema.safeParse({
          measurementContext: 'SELF_REPORTED',
          weightKg,
        }).success,
      ).toBe(false);
    },
  );

  it('rejects negative profile measurements, empty updates, and unknown fields', () => {
    expect(
      updateFighterProfileSchema.safeParse({ heightCm: -10 }).success,
    ).toBe(false);
    expect(updateFighterProfileSchema.safeParse({}).success).toBe(false);
    expect(
      updateFighterProfileSchema.safeParse({
        bio: 'Ready to compete',
        currentMedicalStatus: 'HEALTHY',
      }).success,
    ).toBe(false);
  });

  it('validates UUID params and temporal assignment inputs strictly', () => {
    expect(fighterIdParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(
      false,
    );
    expect(
      assignCoachSchema.safeParse({
        coachId: '516a01dc-f842-40e4-ae88-abca224921b7',
        startsAt: 'not-a-date',
      }).success,
    ).toBe(false);
    expect(
      endCoachAssignmentSchema.safeParse({ endReason: '   ' }).success,
    ).toBe(false);
  });
});
