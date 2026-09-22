import { z } from 'zod';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  nullableTrimmedTextSchema,
  optionalNullablePositiveNumberSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { weightClasses, fighterStances } from '../users/users.model.js';

export { weightClasses, fighterStances };

export const medicalStatuses = [
  'HEALTHY',
  'MONITORING',
  'RECOVERY',
  'INJURED',
  'NOT_CLEARED',
] as const;

export const measurementContexts = [
  'TRAINING',
  'CHECKUP',
  'WEIGH_IN',
  'SELF_REPORTED',
] as const;

export const sessionStatuses = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'ABANDONED',
] as const;

export const sessionTypes = [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
  'PHYSICAL_THERAPY',
] as const;

export const FIGHTER_PERMISSIONS = {
  GET_ALL: 'fighter:get_all',
  READ: 'fighter:read',
  CREATE: 'fighter:create',
  UPDATE: 'fighter:update',
  DELETE: 'fighter:delete',
  MEASUREMENTS_READ: 'fighter.measurement:read',
  MEASUREMENTS_WRITE: 'fighter.measurement:write',
  COACHES_READ: 'fighter.coach:read',
  COACHES_ASSIGN: 'fighter.coach:assign',
  COACHES_END: 'fighter.coach:end',
  SESSIONS_READ: 'fighter.session:read',
  MEDICAL_READ: 'fighter.medical:read',
} as const;

// --- Params Schemas ---

export const fighterIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const assignmentIdParamsSchema = z.strictObject({
  id: z.uuid(),
  assignmentId: z.uuid(),
});

export const measurementIdParamsSchema = z.strictObject({
  id: z.uuid(),
  measurementId: z.uuid(),
});

// --- Query Schemas ---

export const listFightersQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  weightClass: z.enum(weightClasses).optional(),
  dominantStance: z.enum(fighterStances).optional(),
  gym: z.string().trim().max(200).optional(),
  medicalStatus: z.enum(medicalStatuses).optional(),
  search: z.string().trim().max(100).optional(),
});

export const listMeasurementsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  includeSuperseded: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
});

export const listFighterSessionsQuerySchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(sessionStatuses).optional(),
  sessionType: z.enum(sessionTypes).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// --- Body Schemas ---

export const updateFighterProfileSchema = z
  .strictObject({
    firstName: trimmedTextSchema(100).optional(),
    lastName: trimmedTextSchema(100).optional(),
    dateOfBirth: dateOnlySchema.optional(),
    nationality: nullableTrimmedTextSchema(100).optional(),
    weightClass: z.enum(weightClasses).optional(),
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
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createMeasurementSchema = z.strictObject({
  weightKg: z.coerce
    .number()
    .positive('Weight must be positive')
    .finite('Weight must be finite')
    .max(500, 'Weight must be under 500 kg')
    .transform((val) => Number(val.toFixed(2))),
  heightCm: z.coerce
    .number()
    .positive('Height must be positive')
    .finite('Height must be finite')
    .max(300, 'Height must be under 300 cm')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
  reachCm: z.coerce
    .number()
    .positive('Reach must be positive')
    .finite('Reach must be finite')
    .max(300, 'Reach must be under 300 cm')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
  measurementContext: z.enum(measurementContexts),
  measuredAt: z.string().datetime().optional(),
  notes: nullableTrimmedTextSchema(1_000).optional(),
});

export const assignCoachSchema = z.strictObject({
  coachId: z.uuid(),
  startsAt: z.string().datetime().optional(),
});

export const endCoachAssignmentSchema = z.strictObject({
  endReason: trimmedTextSchema(500, 1),
  endsAt: z.string().datetime().optional(),
});

// --- Output & Domain Types ---

export const publicFighterSchema = z.strictObject({
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  nationality: z.string().nullable(),
  weightClass: z.enum(weightClasses),
  heightCm: z.number().nullable(),
  reachCm: z.number().nullable(),
  dominantStance: z.enum(fighterStances).nullable(),
  leftArmCm: z.number().nullable(),
  rightArmCm: z.number().nullable(),
  leftLegCm: z.number().nullable(),
  rightLegCm: z.number().nullable(),
  gym: z.string().nullable(),
  currentMedicalStatus: z.enum(medicalStatuses),
  bio: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const fighterMeasurementSchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  recordedById: z.uuid(),
  measuredAt: isoDateTimeSchema,
  measurementContext: z.enum(measurementContexts),
  weightKg: z.number(),
  heightCm: z.number().nullable(),
  reachCm: z.number().nullable(),
  notes: z.string().nullable(),
  supersedesId: z.uuid().nullable(),
  isSuperseded: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const coachAssignmentSchema = z.strictObject({
  id: z.uuid(),
  coachId: z.uuid(),
  fighterId: z.uuid(),
  assignedById: z.uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  endedById: z.uuid().nullable(),
  endReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  coachName: z.string().optional(),
  coachGym: z.string().nullable().optional(),
});

export const trainingSessionSummarySchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  coachId: z.uuid().nullable(),
  planId: z.uuid().nullable(),
  title: z.string(),
  scheduledAt: isoDateTimeSchema,
  plannedDurationSec: z.number().nullable(),
  actualDurationSec: z.number().nullable(),
  roundCount: z.number(),
  location: z.string().nullable(),
  sessionType: z.enum(sessionTypes),
  status: z.enum(sessionStatuses),
  coachNotes: z.string().nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const fighterMedicalSummarySchema = z.strictObject({
  fighterId: z.uuid(),
  currentMedicalStatus: z.enum(medicalStatuses),
  activeClearance: z
    .strictObject({
      id: z.uuid(),
      clearanceType: z.string(),
      status: z.string(),
      validFrom: isoDateTimeSchema,
      validUntil: isoDateTimeSchema.nullable(),
      notes: z.string().nullable(),
    })
    .nullable(),
  activeInjuries: z.array(
    z.strictObject({
      id: z.uuid(),
      affectedJoint: z.string(),
      injuryType: z.string(),
      severity: z.string(),
      status: z.string(),
      occurredAt: isoDateTimeSchema,
      description: z.string().nullable(),
    }),
  ),
  jointStates: z.array(
    z.strictObject({
      id: z.uuid(),
      joint: z.string(),
      currentState: z.string(),
      stateUpdatedAt: isoDateTimeSchema,
      notes: z.string().nullable(),
    }),
  ),
  disclaimer: z.string(),
});

// --- Type Inferences ---

export type ListFightersQuery = z.infer<typeof listFightersQuerySchema>;
export type ListMeasurementsQuery = z.infer<typeof listMeasurementsQuerySchema>;
export type ListFighterSessionsQuery = z.infer<
  typeof listFighterSessionsQuerySchema
>;
export type UpdateFighterProfileInput = z.infer<
  typeof updateFighterProfileSchema
>;
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
export type AssignCoachInput = z.infer<typeof assignCoachSchema>;
export type EndCoachAssignmentInput = z.infer<typeof endCoachAssignmentSchema>;
export type PublicFighter = z.input<typeof publicFighterSchema>;
export type FighterMeasurement = z.input<typeof fighterMeasurementSchema>;
export type CoachAssignment = z.input<typeof coachAssignmentSchema>;
export type TrainingSessionSummary = z.input<
  typeof trainingSessionSummarySchema
>;
export type FighterMedicalSummary = z.input<typeof fighterMedicalSummarySchema>;
