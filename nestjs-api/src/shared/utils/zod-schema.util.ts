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
