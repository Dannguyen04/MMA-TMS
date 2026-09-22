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

export const accountStatuses = ['ACTIVE', 'INVITED', 'SUSPENDED'] as const;

export const USER_PERMISSIONS = {
  CREATE: 'users.create',
  READ: 'users.read',
  PROFILE_READ: 'users.profile.read',
  UPDATE: 'users.update',
  DELETE: 'users.delete',
} as const;

export const uiCapabilities = [
  'fighters:read',
  'fighters:write',
  'training:read',
  'training:write',
  'videos:upload',
  'videos:manage',
  'ai_analysis:read',
  'ai_findings:review',
  'ai_alerts:review',
  'goals:write',
  'medical:read_summary',
  'medical:read',
  'medical:write',
  'clearance:manage',
  'users:manage',
  'roles:manage',
  'ai_jobs:manage',
  'ai_models:manage',
  'audit_logs:read',
  'notifications:manage',
  'settings:manage',
] as const;

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

export const listUsersQuerySchema = z.strictObject({
  search: trimmedTextSchema(200).optional(),
  role: z.enum(userRoles).optional(),
  status: z.enum(accountStatuses).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateUserStatusBodySchema = z.strictObject({
  status: z.enum(accountStatuses),
});

export const updateOwnProfileBodySchema = z
  .strictObject({
    displayName: trimmedTextSchema(200).optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^\+?[0-9\s().-]+$/)
      .refine((value) => value.replace(/\D/g, '').length >= 7)
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required',
  });

export const inviteUserBodySchema = z.strictObject({
  name: trimmedTextSchema(200),
  email: normalizedEmailSchema,
  role: z.enum(userRoles),
  title: trimmedTextSchema(150),
});

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
  status: z.enum(accountStatuses),
  displayName: z.string().trim().max(200),
  phone: z.string().trim().min(3).max(30).nullable(),
  title: z.string().trim().max(150),
  lastActiveAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  profile: publicProfileSchema.nullable(),
});

export const userDirectoryPageSchema = z.strictObject({
  items: z.array(publicUserSchema),
  pageInfo: z.strictObject({
    hasNextPage: z.boolean(),
    endCursor: z.uuid().nullable(),
  }),
  total: z.number().int().nonnegative(),
});

export const assignmentScopeSchema = z.strictObject({
  fighterIds: z.array(z.uuid()),
});

export const currentUserSchema = publicUserSchema.extend({
  effectiveCapabilities: z.array(z.enum(uiCapabilities)),
  assignmentScope: assignmentScopeSchema,
});

export type FighterProfileInput = z.infer<typeof fighterProfileSchema>;
export type AccountStatus = (typeof accountStatuses)[number];
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type InviteUserInput = z.infer<typeof inviteUserBodySchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileBodySchema>;
export type UserDirectoryPage = z.input<typeof userDirectoryPageSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type PublicUser = z.input<typeof publicUserSchema>;
export type UiCapability = (typeof uiCapabilities)[number];
export type CurrentUser = z.input<typeof currentUserSchema>;
