import {
  coachIdParamsSchema,
  listCoachFightersQuerySchema,
} from './coaches.model.js';

describe('coaches Zod contracts', () => {
  describe('listCoachFightersQuerySchema', () => {
    it('defaults pagination to page=1 and limit=20', () => {
      const parsed = listCoachFightersQuerySchema.parse({});
      expect(parsed).toEqual({
        page: 1,
        limit: 20,
      });
    });

    it('coerces and accepts valid query parameters', () => {
      const parsed = listCoachFightersQuerySchema.parse({
        page: '2',
        limit: '50',
        weightClass: 'LIGHTWEIGHT',
        dominantStance: 'SOUTHPAW',
        gym: 'American Top Team',
        search: 'Dustin',
      });
      expect(parsed).toEqual({
        page: 2,
        limit: 50,
        weightClass: 'LIGHTWEIGHT',
        dominantStance: 'SOUTHPAW',
        gym: 'American Top Team',
        search: 'Dustin',
      });
    });

    it('rejects medicalStatus filter to prevent medical inference', () => {
      const result = listCoachFightersQuerySchema.safeParse({
        medicalStatus: 'HEALTHY',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown query parameters (strict object)', () => {
      const result = listCoachFightersQuerySchema.safeParse({
        unknownField: 'value',
      });
      expect(result.success).toBe(false);
    });

    it.each([0, -1, -100])('rejects non-positive page %s', (page) => {
      const result = listCoachFightersQuerySchema.safeParse({ page });
      expect(result.success).toBe(false);
    });

    it.each([0, -1, 101, 200])('rejects out-of-range limit %s', (limit) => {
      const result = listCoachFightersQuerySchema.safeParse({ limit });
      expect(result.success).toBe(false);
    });

    it.each([1.5, 2.7])('rejects non-integer page %s', (page) => {
      const result = listCoachFightersQuerySchema.safeParse({ page });
      expect(result.success).toBe(false);
    });

    it.each([10.5, 20.2])('rejects non-integer limit %s', (limit) => {
      const result = listCoachFightersQuerySchema.safeParse({ limit });
      expect(result.success).toBe(false);
    });

    it('rejects invalid enum values for weightClass and dominantStance', () => {
      expect(
        listCoachFightersQuerySchema.safeParse({ weightClass: 'SUPER_HEAVY' })
          .success,
      ).toBe(false);
      expect(
        listCoachFightersQuerySchema.safeParse({ dominantStance: 'FLYING' })
          .success,
      ).toBe(false);
    });
  });

  describe('coachIdParamsSchema', () => {
    it('accepts valid UUID param', () => {
      const validUuid = '1317a43a-05af-4f2c-bc5b-781219643b68';
      const result = coachIdParamsSchema.safeParse({ id: validUuid });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validUuid);
      }
    });

    it('rejects non-UUID id', () => {
      const result = coachIdParamsSchema.safeParse({ id: 'invalid-uuid-string' });
      expect(result.success).toBe(false);
    });

    it('rejects extra unknown keys', () => {
      const result = coachIdParamsSchema.safeParse({
        id: '1317a43a-05af-4f2c-bc5b-781219643b68',
        extra: 'not-allowed',
      });
      expect(result.success).toBe(false);
    });
  });
});
