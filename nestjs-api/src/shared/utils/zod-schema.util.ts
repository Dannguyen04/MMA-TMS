import { z } from 'zod';

export const normalizedEmailSchema = z
  .email()
  .max(320)
  .transform((email) => email.toLowerCase());

export const credentialPasswordSchema = z.string().min(8).max(128);

export const trimmedTextSchema = (maximum: number, minimum = 1) =>
  z.string().trim().min(minimum).max(maximum);

export const nullableTrimmedTextSchema = (maximum: number, minimum = 1) =>
  trimmedTextSchema(maximum, minimum).nullable();

export const optionalNullablePositiveNumberSchema = (
  maximumExclusive: number,
) => z.number().finite().positive().lt(maximumExclusive).nullable().optional();

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value)
    );
  }, 'Expected a valid calendar date');

export const isoDateTimeSchema = z.preprocess(
  (val: unknown) => (val instanceof Date ? val.toISOString() : val),
  z.string().datetime(),
) as z.ZodType<string, Date | string>;

/**
 * Query values that may repeat (`?a=1&a=2`), be comma-separated (`?a=1,2`) or
 * both, as an array of trimmed non-empty strings. Absent or blank (`?a=`) is
 * `undefined`, i.e. no filter.
 */
export function splitQueryList(value: unknown): unknown {
  if (value === undefined) return undefined;
  const parts = Array.isArray(value) ? value : [value];
  const items = parts.flatMap((part) =>
    typeof part === 'string'
      ? part
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [part],
  );
  return items.length === 0 ? undefined : items;
}

/** A list of uuids from a query (repeated or comma-separated), 1..`max` entries. */
export const uuidListQuerySchema = (max: number) =>
  z.preprocess(splitQueryList, z.array(z.uuid()).min(1).max(max).optional());
