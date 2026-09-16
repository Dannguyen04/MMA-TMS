import { z } from 'zod';
import {
  credentialPasswordSchema,
  dateOnlySchema,
  normalizedEmailSchema,
  nullableTrimmedTextSchema,
  optionalNullablePositiveNumberSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { userRoles } from '../shared/models/auth-context.model.js';

export { userRoles } from '../shared/models/auth-context.model.js';

export const USER_PERMISSIONS = {
  CREATE: 'users.create',
  READ: 'users.read',
  UPDATE: 'users.update',
  DELETE: 'users.delete',
} as const;

export const weightClasses = [
  'STRAWWEIGHT',
  'FLYWEIGHT',
  'BANTAMWEIGHT',
  'FEATHERWEIGHT',
  'LIGHTWEIGHT',
  'WELTERWEIGHT',
  'MIDDLEWEIGHT',
  'LIGHT_HEAVYWEIGHT',
  'HEAVYWEIGHT',
] as const;
export const fighterStances = ['ORTHODOX', 'SOUTHPAW', 'SWITCH'] as const;

const requiredName = trimmedTextSchema(100);

export const fighterProfileSchema = z.strictObject({
  firstName: requiredName,
  lastName: requiredName,
  dateOfBirth: dateOnlySchema,
  nationality: nullableTrimmedTextSchema(100).optional(),
  weightClass: z.enum(weightClasses),
  heightCm: optionalNullablePositiveNumberSchema(300),
  reachCm: optionalNullablePositiveNumberSchema(300),
  dominantStance: z.enum(fighterStances).nullable().optional(),
  leftArmCm: optionalNullablePositiveNumberSchema(150),
  rightArmCm: optionalNullablePositiveNumberSchema(150),
  leftLegCm: optionalNullablePositiveNumberSchema(150),
  rightLegCm: optionalNullablePositiveNumberSchema(150),
  gym: nullableTrimmedTextSchema(200).optional(),
  bio: nullableTrimmedTextSchema(2_000).optional(),
  profileImageUrl: z.url().max(2_048).nullable().optional(),
});

export const coachProfileSchema = z.strictObject({
  firstName: requiredName,
  lastName: requiredName,
  isHeadCoach: z.boolean().optional(),
  specialization: nullableTrimmedTextSchema(200).optional(),
  profileImageUrl: z.url().max(2_048).nullable().optional(),
});

export const doctorProfileSchema = z.strictObject({
  firstName: requiredName,
  lastName: requiredName,
  licenseNumber: z.string().trim().min(1).max(100),
  specialization: nullableTrimmedTextSchema(200).optional(),
  profileImageUrl: z.url().max(2_048).nullable().optional(),
});

const credentialsSchema = {
  email: normalizedEmailSchema,
  password: credentialPasswordSchema,
};

export const createUserSchema = z.discriminatedUnion('role', [
  z.strictObject({
    ...credentialsSchema,
    role: z.literal('FIGHTER'),
    profile: fighterProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal('COACH'),
    profile: coachProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal('DOCTOR'),
    profile: doctorProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal('ADMIN'),
  }),
]);

export const createUserBodySchema = z.strictObject({
  user: createUserSchema,
});

const nonEmptyPartial = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required',
  });

export const updateUserSchema = z.discriminatedUnion('role', [
  z.strictObject({
    role: z.literal('FIGHTER'),
    profile: nonEmptyPartial(fighterProfileSchema),
  }),
  z.strictObject({
    role: z.literal('COACH'),
    profile: nonEmptyPartial(coachProfileSchema),
  }),
  z.strictObject({
    role: z.literal('DOCTOR'),
    profile: nonEmptyPartial(doctorProfileSchema),
  }),
]);

export const updateUserBodySchema = z.strictObject({
  user: updateUserSchema,
});

export const userIdParamsSchema = z.strictObject({ id: z.uuid() });

const publicProfileSchema = z.union([
  fighterProfileSchema.extend({ id: z.uuid() }),
  coachProfileSchema.required({ isHeadCoach: true }).extend({ id: z.uuid() }),
  doctorProfileSchema.extend({ id: z.uuid() }),
]);

export const publicUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(userRoles),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  profile: publicProfileSchema.nullable(),
});

export type FighterProfileInput = z.infer<typeof fighterProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
