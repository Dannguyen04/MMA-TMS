import { z } from 'zod';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  nullableTrimmedTextSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { weightClasses } from '../users/users.model.js';
import {
  ADMIN_DECISION,
  APPLICATION_PAGE_SIZE_DEFAULT,
  APPLICATION_PAGE_SIZE_MAX,
  APPLICATION_STATUS,
  ASSESSMENT_CONCLUSION,
  ACTIVATION_STATUS,
  CRITERIA_MAX_ITEMS,
  CRITERIA_MIN_ITEMS,
} from './fighter-admissions.constants.js';

export const applicationStatuses = [
  APPLICATION_STATUS.SUBMITTED,
  APPLICATION_STATUS.FAILED,
  APPLICATION_STATUS.PASSED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.APPROVED,
  APPLICATION_STATUS.ACTIVATED,
] as const;

export const activationStatuses = [
  ACTIVATION_STATUS.PENDING,
  ACTIVATION_STATUS.IN_PROGRESS,
  ACTIVATION_STATUS.PASSWORD_SET,
  ACTIVATION_STATUS.COMPLETED,
] as const;

export const assessmentConclusions = [
  ASSESSMENT_CONCLUSION.PASS,
  ASSESSMENT_CONCLUSION.FAIL,
] as const;

export const adminDecisions = [
  ADMIN_DECISION.APPROVED,
  ADMIN_DECISION.REJECTED,
] as const;

const applicationIdentitySchema = {
  firstName: trimmedTextSchema(100),
  lastName: trimmedTextSchema(100),
  dateOfBirth: dateOnlySchema,
  weightClass: z.enum(weightClasses),
};

// The applicant's email is taken from the verified session, never from the body.
export const submitApplicationBodySchema = z.strictObject({
  ...applicationIdentitySchema,
  nationality: nullableTrimmedTextSchema(100).optional(),
  contactPhone: nullableTrimmedTextSchema(32).optional(),
  trainingBackground: nullableTrimmedTextSchema(2_000).optional(),
  competitionBackground: nullableTrimmedTextSchema(2_000).optional(),
  motivation: nullableTrimmedTextSchema(2_000).optional(),
});

export const applicationIdParamsSchema = z.strictObject({ id: z.uuid() });

const paginationSchema = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(APPLICATION_PAGE_SIZE_MAX)
    .default(APPLICATION_PAGE_SIZE_DEFAULT),
};

export const listApplicationsQuerySchema = z.strictObject({
  ...paginationSchema,
  status: z.enum(applicationStatuses).optional(),
});

export const listOwnApplicationsQuerySchema = z.strictObject(paginationSchema);

export const assignCoachBodySchema = z.strictObject({
  coachId: z.uuid(),
  reassignmentReason: nullableTrimmedTextSchema(500).optional(),
});

// Criteria are the coach's own evidence. No universal threshold is inferred, and
// the recorded value keeps its explicit unit.
export const assessmentCriterionSchema = z.strictObject({
  criterionName: trimmedTextSchema(150),
  method: trimmedTextSchema(300),
  observation: trimmedTextSchema(1_000),
  value: z.number().finite().nullable().optional(),
  unit: nullableTrimmedTextSchema(30).optional(),
  note: nullableTrimmedTextSchema(1_000).optional(),
});

export const submitAssessmentBodySchema = z.strictObject({
  conclusion: z.enum(assessmentConclusions),
  summary: trimmedTextSchema(4_000),
  criteria: z
    .array(assessmentCriterionSchema)
    .min(CRITERIA_MIN_ITEMS)
    .max(CRITERIA_MAX_ITEMS),
});

export const submitDecisionBodySchema = z.strictObject({
  decision: z.enum(adminDecisions),
  reason: trimmedTextSchema(2_000),
});

const applicationSnapshotSchema = z.strictObject({
  /**
   * Snapshot of the account email at submission time, copied from the verified
   * session. It is immutable evidence of who applied, not a contact channel:
   * recovery mail always goes to the account's current Supabase Auth email.
   */
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  weightClass: z.enum(weightClasses),
  nationality: z.string().nullable(),
  contactPhone: z.string().nullable(),
  trainingBackground: z.string().nullable(),
  competitionBackground: z.string().nullable(),
  motivation: z.string().nullable(),
});

/** Applicant view: outcomes only, never staff notes or other applicants. */
export const applicantApplicationSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(applicationStatuses),
  submittedAt: isoDateTimeSchema,
  applicant: applicationSnapshotSchema,
  assessment: z
    .strictObject({
      conclusion: z.enum(assessmentConclusions),
      assessedAt: isoDateTimeSchema,
    })
    .nullable(),
  decision: z
    .strictObject({
      decision: z.enum(adminDecisions),
      decidedAt: isoDateTimeSchema,
    })
    .nullable(),
  activation: z
    .strictObject({ status: z.enum(activationStatuses) })
    .nullable(),
});

const assignmentSchema = z.strictObject({
  id: z.uuid(),
  coachId: z.uuid(),
  assignedById: z.uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  endedById: z.uuid().nullable(),
  endReason: z.string().nullable(),
});

/** Staff view: full evidence for the actors authorised to act on the attempt. */
export const staffApplicationSchema = z.strictObject({
  id: z.uuid(),
  guestUserId: z.uuid(),
  status: z.enum(applicationStatuses),
  submittedAt: isoDateTimeSchema,
  applicant: applicationSnapshotSchema,
  /**
   * The account's current email. It differs from `applicant.email` when the
   * account email changed after submission; recovery mail follows this value.
   */
  accountEmail: z.email().nullable(),
  currentAssignment: assignmentSchema.nullable(),
  assignmentHistory: z.array(assignmentSchema),
  assessment: z
    .strictObject({
      id: z.uuid(),
      coachId: z.uuid(),
      conclusion: z.enum(assessmentConclusions),
      summary: z.string(),
      criteria: z.array(assessmentCriterionSchema),
      assessedAt: isoDateTimeSchema,
    })
    .nullable(),
  decision: z
    .strictObject({
      id: z.uuid(),
      adminId: z.uuid(),
      decision: z.enum(adminDecisions),
      reason: z.string(),
      decidedAt: isoDateTimeSchema,
    })
    .nullable(),
  activation: z
    .strictObject({
      status: z.enum(activationStatuses),
      recoveryAttempts: z.number().int(),
      attemptedAt: isoDateTimeSchema.nullable(),
      acceptedAt: isoDateTimeSchema.nullable(),
      completedAt: isoDateTimeSchema.nullable(),
    })
    .nullable(),
});

const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.strictObject({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  });

export const applicantApplicationListSchema = paginatedSchema(
  applicantApplicationSchema,
);
export const staffApplicationListSchema = paginatedSchema(
  staffApplicationSchema,
);

export const activationResponseSchema = z.strictObject({
  applicationId: z.uuid(),
  status: z.enum(activationStatuses),
  role: z.literal('FIGHTER'),
  alreadyActive: z.boolean(),
});

/**
 * `accepted` reports only that the provider took the send request; it is not a
 * delivery confirmation.
 */
export const recoveryEmailStatusSchema = z.strictObject({
  applicationId: z.uuid(),
  accepted: z.boolean(),
  recoveryAttempts: z.number().int(),
  attemptedAt: isoDateTimeSchema,
});

export type SubmitApplicationInput = z.infer<
  typeof submitApplicationBodySchema
>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
export type ListOwnApplicationsQuery = z.infer<
  typeof listOwnApplicationsQuerySchema
>;
export type AssignCoachInput = z.infer<typeof assignCoachBodySchema>;
export type SubmitAssessmentInput = z.infer<typeof submitAssessmentBodySchema>;
export type AssessmentCriterion = z.infer<typeof assessmentCriterionSchema>;
export type SubmitDecisionInput = z.infer<typeof submitDecisionBodySchema>;
export type ApplicantApplication = z.input<typeof applicantApplicationSchema>;
export type StaffApplication = z.input<typeof staffApplicationSchema>;
export type ActivationResponse = z.infer<typeof activationResponseSchema>;
export type RecoveryEmailStatus = z.input<typeof recoveryEmailStatusSchema>;
