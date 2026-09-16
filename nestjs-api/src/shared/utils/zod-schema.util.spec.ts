import {
  credentialPasswordSchema,
  dateOnlySchema,
  isoDateTimeSchema,
  normalizedEmailSchema,
  nullableTrimmedTextSchema,
  optionalNullablePositiveNumberSchema,
  trimmedTextSchema,
} from './zod-schema.util.js';

describe('shared Zod schema utilities', () => {
  it('normalizes a valid email address', () => {
    expect(normalizedEmailSchema.parse('Fighter@Example.com')).toBe(
      'fighter@example.com',
    );
  });

  it('applies shared credential password bounds', () => {
    expect(credentialPasswordSchema.safeParse('short').success).toBe(false);
    expect(credentialPasswordSchema.safeParse('strong-password').success).toBe(
      true,
    );
  });

  it('trims required and nullable text consistently', () => {
    expect(trimmedTextSchema(20).parse('  MMA  ')).toBe('MMA');
    expect(nullableTrimmedTextSchema(20).parse(null)).toBeNull();
    expect(nullableTrimmedTextSchema(20).safeParse('   ').success).toBe(false);
  });

  it('validates real calendar dates without coercion', () => {
    expect(dateOnlySchema.safeParse('2000-02-29').success).toBe(true);
    expect(dateOnlySchema.safeParse('2001-02-29').success).toBe(false);
    expect(dateOnlySchema.safeParse(new Date()).success).toBe(false);
  });

  it('bounds optional nullable positive numbers', () => {
    const schema = optionalNullablePositiveNumberSchema(300);

    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(299.9).success).toBe(true);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(300).success).toBe(false);
    expect(schema.safeParse(Number.NaN).success).toBe(false);
  });

  it('normalizes Date inputs to an ISO date-time string', () => {
    const date = new Date('2026-02-01T12:34:56.000Z');

    expect(isoDateTimeSchema.parse(date)).toBe('2026-02-01T12:34:56.000Z');
    expect(isoDateTimeSchema.parse(date.toISOString())).toBe(
      '2026-02-01T12:34:56.000Z',
    );
    expect(isoDateTimeSchema.safeParse('not-a-date').success).toBe(false);
  });
});
