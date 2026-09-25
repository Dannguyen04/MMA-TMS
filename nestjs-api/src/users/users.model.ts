import { z } from 'zod';
import {
  credentialPasswordSchema,
  dateOnlySchema,
  isoDateTimeSchema,
  normalizedEmailSchema,
  nullableTrimmedTextSchema,
  optionalNullablePositiveNumberSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { USER, userRoles } from '../shared/types/user.role.js';

export { USER, userRoles } from '../shared/types/user.role.js';

export const USER_PERMISSIONS = {
  CREATE: 'users.create',
  READ: 'users.read',
  PROFILE_READ: 'users.profile.read',
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

/**
 * Administrative creation. A fighter account can arrive two ways, and both are
 * intentional:
 *   - self-service admission (GUEST -> application -> coach PASS -> admin
 *     APPROVED -> password recovery -> activation), which produces the
 *     assessment and approval history;
 *   - direct recruitment, where an admin onboards an already-signed fighter
 *     here. This path has no admission record by design, so the fighter's
 *     provenance lives in the audit log for this creation instead.
 * GUEST accounts are never created here; they come from self-registration.
 */
export const createUserSchema = z.discriminatedUnion('role', [
  z.strictObject({
    ...credentialsSchema,
    role: z.literal(USER.FIGHTER),
    profile: fighterProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal(USER.COACH),
    profile: coachProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal(USER.DOCTOR),
    profile: doctorProfileSchema,
  }),
  z.strictObject({
    ...credentialsSchema,
    role: z.literal(USER.ADMIN),
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
    role: z.literal(USER.FIGHTER),
    profile: nonEmptyPartial(fighterProfileSchema),
  }),
  z.strictObject({
    role: z.literal(USER.COACH),
    profile: nonEmptyPartial(coachProfileSchema),
  }),
  z.strictObject({
    role: z.literal(USER.DOCTOR),
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
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  profile: publicProfileSchema.nullable(),
});

export type FighterProfileInput = z.infer<typeof fighterProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type PublicUser = z.input<typeof publicUserSchema>;
