import { z } from 'zod';
import {
  bodyJointEnum,
  clearanceStatusEnum,
  clearanceTypeEnum,
  injurySeverityEnum,
  injuryStatusEnum,
  medicalExaminationDecisionEnum,
  medicalExaminationScopeEnum,
  medicalExaminationTypeEnum,
  medicalReviewRequestStatusEnum,
  medicalRevisionSourceEnum,
  recoveryPlanStatusEnum,
  sessionTypeEnum,
  techniqueTypeEnum,
} from '../database/schema.js';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  nullableTrimmedTextSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import { userRoles } from '../shared/types/user.role.js';
import { scat6InputSchema, scat6RecordSchema } from './scat6.model.js';
import {
  CLINICAL_TEXT_MAX_LENGTH,
  MEDICAL_ELIGIBILITY_REASON,
  MEDICAL_HISTORY_RECORD_TYPE,
  RECOVERY_MILESTONES_MAX_INPUT,
  RECOVERY_PLAN_TITLE_MAX_LENGTH,
} from './medical.constants.js';

// --- Enum value sets (mirrors of the SQL enums) ---

export const examinationScopes = medicalExaminationScopeEnum.enumValues;
export const examinationDecisions = medicalExaminationDecisionEnum.enumValues;
export const examinationTypes = medicalExaminationTypeEnum.enumValues;
export const assessmentResults = ['NORMAL', 'ABNORMAL', 'INCONCLUSIVE'] as const;
export const hydrationLevels = ['GOOD', 'FAIR', 'POOR'] as const;
export const reviewRequestStatuses = medicalReviewRequestStatusEnum.enumValues;
export const revisionSources = medicalRevisionSourceEnum.enumValues;
export const injuryStatuses = injuryStatusEnum.enumValues;
export const injurySeverities = injurySeverityEnum.enumValues;
export const recoveryPlanStatuses = recoveryPlanStatusEnum.enumValues;
export const clearanceTypes = clearanceTypeEnum.enumValues;
export const clearanceStatuses = clearanceStatusEnum.enumValues;
export const bodyJoints = bodyJointEnum.enumValues;
export const sessionTypeValues = sessionTypeEnum.enumValues;
export const techniqueTypes = techniqueTypeEnum.enumValues;

export type ExaminationScope = (typeof examinationScopes)[number];
export type ExaminationDecision = (typeof examinationDecisions)[number];
export type ExaminationType = (typeof examinationTypes)[number];
export type InjuryStatus = (typeof injuryStatuses)[number];
export type RecoveryPlanStatus = (typeof recoveryPlanStatuses)[number];
export type ClearanceType = (typeof clearanceTypes)[number];
export type SessionTypeValue = (typeof sessionTypeValues)[number];

const pastOrPresentDateTime = z
  .string()
  .datetime()
  .refine(
    (value) => new Date(value).getTime() <= Date.now(),
    'Must not be in the future',
  );

const paginationShape = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};

// --- Params ---

export const medicalRecordIdParamsSchema = z.strictObject({ id: z.uuid() });
export const doctorIdParamsSchema = z.strictObject({ id: z.uuid() });

// --- Queries ---

export const listDoctorAssignmentsQuerySchema = z.strictObject({
  ...paginationShape,
});

export const listReviewRequestsQuerySchema = z.strictObject({
  ...paginationShape,
  status: z.enum(reviewRequestStatuses).optional(),
});

export const listExaminationsQuerySchema = z.strictObject({
  ...paginationShape,
  scope: z.enum(examinationScopes).optional(),
});

export const listMedicalHistoryQuerySchema = z.strictObject({
  ...paginationShape,
  recordType: z.enum(MEDICAL_HISTORY_RECORD_TYPE).optional(),
});

// --- Bodies ---

export const assignDoctorSchema = z.strictObject({
  doctorId: z.uuid(),
});

export const endDoctorAssignmentSchema = z.strictObject({
  endReason: trimmedTextSchema(500),
});

export const createReviewRequestSchema = z.strictObject({
  reason: trimmedTextSchema(2_000),
});

export const createInjurySchema = z.strictObject({
  affectedJoint: z.enum(bodyJoints),
  injuryType: trimmedTextSchema(200),
  severity: z.enum(injurySeverities),
  occurredAt: pastOrPresentDateTime,
  description: nullableTrimmedTextSchema(4_000).optional(),
});

export const updateInjurySchema = z
  .strictObject({
    severity: z.enum(injurySeverities).optional(),
    description: nullableTrimmedTextSchema(4_000).optional(),
    status: z.enum(injuryStatuses).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createTreatmentSchema = z
  .strictObject({
    treatmentType: trimmedTextSchema(200),
    treatmentDate: pastOrPresentDateTime,
    description: nullableTrimmedTextSchema(4_000).optional(),
    outcomeNotes: nullableTrimmedTextSchema(4_000).optional(),
    nextReviewAt: z.string().datetime().optional(),
  })
  .refine(
    (data) =>
      !data.nextReviewAt ||
      new Date(data.nextReviewAt).getTime() >=
        new Date(data.treatmentDate).getTime(),
    {
      message: 'nextReviewAt must not be before treatmentDate',
      path: ['nextReviewAt'],
    },
  );

// --- Recovery milestones ---
//
// Input: `completedAt` is always server-owned; `id` is server-generated for
// new milestones and, on update, only identifies an existing milestone of the
// same plan. Array order is the display order. Omitting `isCompleted` means
// "not completed" for a new milestone and "unchanged" for an existing one.
const milestoneContentShape = {
  title: trimmedTextSchema(RECOVERY_PLAN_TITLE_MAX_LENGTH),
  criteria: trimmedTextSchema(CLINICAL_TEXT_MAX_LENGTH),
  targetDate: dateOnlySchema.nullable().optional(),
  isCompleted: z.boolean().optional(),
  notes: nullableTrimmedTextSchema(CLINICAL_TEXT_MAX_LENGTH).optional(),
};

export const createRecoveryMilestoneInputSchema = z.strictObject(
  milestoneContentShape,
);

export const updateRecoveryMilestoneInputSchema = z.strictObject({
  id: z.uuid().optional(),
  ...milestoneContentShape,
});

const createMilestonesInputSchema = z
  .array(createRecoveryMilestoneInputSchema)
  .max(RECOVERY_MILESTONES_MAX_INPUT);

const updateMilestonesInputSchema = z
  .array(updateRecoveryMilestoneInputSchema)
  .max(RECOVERY_MILESTONES_MAX_INPUT)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (item.id === undefined) return;
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: 'Duplicate milestone id',
        });
      }
      seen.add(item.id);
    });
  });

// Persisted (standard) milestone written by this API. A stored array counts as
// standard only when EVERY element matches; anything else is legacy JSON.
export const recoveryMilestoneSchema = z
  .strictObject({
    id: z.uuid(),
    title: z.string().min(1),
    criteria: z.string().min(1),
    targetDate: dateOnlySchema.nullable(),
    isCompleted: z.boolean(),
    completedAt: z.string().datetime().nullable(),
    notes: z.string().nullable(),
  })
  .refine((milestone) => milestone.isCompleted === (milestone.completedAt !== null), {
    message: 'completedAt must be set exactly when isCompleted is true',
    path: ['completedAt'],
  });

export const standardRecoveryMilestonesSchema = z.array(recoveryMilestoneSchema);

// Response: either the standard array, or a legacy JSON array returned exactly
// as stored (any JSON values, order preserved, never filtered or rewritten).
const recoveryMilestonesResponseSchema = z
  .union([standardRecoveryMilestonesSchema, z.array(z.unknown())])
  .describe(
    'Standard milestones, or a legacy JSON array returned unchanged when any element does not match the standard milestone schema.',
  );

export const createRecoveryPlanSchema = z
  .strictObject({
    injuryId: z.uuid(),
    title: trimmedTextSchema(RECOVERY_PLAN_TITLE_MAX_LENGTH),
    description: nullableTrimmedTextSchema(CLINICAL_TEXT_MAX_LENGTH).optional(),
    startDate: dateOnlySchema,
    estimatedEndDate: dateOnlySchema.optional(),
    milestones: createMilestonesInputSchema.default([]),
  })
  .refine(
    (data) => !data.estimatedEndDate || data.estimatedEndDate >= data.startDate,
    {
      message: 'estimatedEndDate must not be before startDate',
      path: ['estimatedEndDate'],
    },
  );

export const updateRecoveryPlanSchema = z
  .strictObject({
    description: nullableTrimmedTextSchema(CLINICAL_TEXT_MAX_LENGTH).optional(),
    estimatedEndDate: dateOnlySchema.nullable().optional(),
    // Present = intentional replacement of the whole list (validated, IDs
    // matched, versioned). Absent = stored milestones, legacy included, untouched.
    milestones: updateMilestonesInputSchema.optional(),
    status: z.enum(recoveryPlanStatuses).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

const restrictionListsShape = {
  allowedSessionTypes: z.array(z.enum(sessionTypeValues)).min(1).max(20).optional(),
  allowedTechniqueTypes: z.array(z.enum(techniqueTypes)).min(1).max(50).optional(),
  excludedJoints: z.array(z.enum(bodyJoints)).min(1).max(50).optional(),
};

export const examinationRestrictionsInputSchema = z
  .strictObject({
    ...restrictionListsShape,
    notes: trimmedTextSchema(2_000).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one restriction must be provided',
  });

/**
 * Vitals are recorded together. Bounds are input sanity only (finite,
 * positive, storable precision); they are not health thresholds.
 */
export const examinationVitalsSchema = z.strictObject({
  weightKg: z
    .number()
    .finite()
    .positive()
    .max(999)
    .transform((value) => Number(value.toFixed(2))),
  restingHeartRate: z.number().int().positive().max(400),
  bloodPressureSystolic: z.number().int().positive().max(400),
  bloodPressureDiastolic: z.number().int().positive().max(400),
  temperatureC: z
    .number()
    .finite()
    .positive()
    .max(99)
    .transform((value) => Number(value.toFixed(1))),
  spo2Pct: z.number().int().min(0).max(100),
  hydration: z.enum(hydrationLevels),
});

export const examinationAssessmentSchema = z.strictObject({
  area: trimmedTextSchema(150),
  result: z.enum(assessmentResults),
  note: nullableTrimmedTextSchema(1_000),
});

export const createExaminationSchema = z
  .strictObject({
    scope: z.enum(examinationScopes),
    decision: z.enum(examinationDecisions),
    examinedAt: pastOrPresentDateTime,
    reason: trimmedTextSchema(4_000),
    restrictions: examinationRestrictionsInputSchema.optional(),
    validUntil: z.string().datetime().optional(),
    supersedesId: z.uuid().optional(),
    reviewRequestIds: z.array(z.uuid()).min(1).max(50).optional(),
    // Details (016). All optional for existing clients; a BASELINE carries
    // vitals, at least one assessed area and its SCAT6 record.
    examinationType: z.enum(examinationTypes).optional(),
    vitals: examinationVitalsSchema.optional(),
    assessments: z.array(examinationAssessmentSchema).max(30).optional(),
    recommendations: nullableTrimmedTextSchema(CLINICAL_TEXT_MAX_LENGTH).optional(),
    followUpDate: dateOnlySchema.optional(),
    scat6: scat6InputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasDetails =
      data.vitals !== undefined ||
      data.assessments !== undefined ||
      data.recommendations !== undefined ||
      data.followUpDate !== undefined ||
      data.scat6 !== undefined;
    if (hasDetails && data.examinationType === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['examinationType'],
        message: 'examinationType is required when examination details are sent',
      });
    }
    const baseline = data.examinationType === 'BASELINE';
    if (baseline !== (data.scat6 !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['scat6'],
        message: baseline
          ? 'A BASELINE examination requires its SCAT6 record'
          : 'scat6 is only recorded with a BASELINE examination',
      });
    }
    if (baseline && data.vitals === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['vitals'],
        message: 'A BASELINE examination requires vitals',
      });
    }
    if (baseline && (data.assessments?.length ?? 0) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['assessments'],
        message: 'A BASELINE examination requires at least one assessed area',
      });
    }
    if (
      data.followUpDate !== undefined &&
      data.followUpDate < data.examinedAt.slice(0, 10)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['followUpDate'],
        message: 'followUpDate must not be before examinedAt',
      });
    }
    const restricted = data.decision === 'ELIGIBLE_WITH_RESTRICTIONS';
    if (restricted !== (data.restrictions !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['restrictions'],
        message: restricted
          ? 'restrictions are required for ELIGIBLE_WITH_RESTRICTIONS'
          : 'restrictions are only allowed for ELIGIBLE_WITH_RESTRICTIONS',
      });
    }
    if (data.validUntil && data.decision === 'NOT_ELIGIBLE') {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'A NOT_ELIGIBLE decision has no validity period',
      });
    }
    if (
      data.validUntil &&
      new Date(data.validUntil).getTime() <= new Date(data.examinedAt).getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'validUntil must be after examinedAt',
      });
    }
    if (data.reviewRequestIds && data.scope !== 'TRAINING') {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewRequestIds'],
        message: 'Review requests can only be resolved by a TRAINING examination',
      });
    }
    if (
      data.reviewRequestIds &&
      new Set(data.reviewRequestIds).size !== data.reviewRequestIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['reviewRequestIds'],
        message: 'reviewRequestIds must be unique',
      });
    }
  });

export const issueClearanceSchema = z
  .strictObject({
    examinationId: z.uuid(),
    clearanceType: z.enum(clearanceTypes),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    restrictions: z
      .strictObject(restrictionListsShape)
      .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        { message: 'At least one restriction must be provided' },
      )
      .optional(),
    notes: nullableTrimmedTextSchema(2_000).optional(),
  })
  .refine(
    (data) =>
      !data.validFrom ||
      !data.validUntil ||
      new Date(data.validUntil).getTime() > new Date(data.validFrom).getTime(),
    { message: 'validUntil must be after validFrom', path: ['validUntil'] },
  );

export const revokeClearanceSchema = z.strictObject({
  revokedReason: trimmedTextSchema(2_000),
});

// --- Responses ---

const restrictionListsResponseShape = {
  allowedSessionTypes: z.array(z.enum(sessionTypeValues)).nullable(),
  allowedTechniqueTypes: z.array(z.enum(techniqueTypes)).nullable(),
  excludedJoints: z.array(z.enum(bodyJoints)).nullable(),
};

export const doctorAssignmentSchema = z.strictObject({
  id: z.uuid(),
  doctorId: z.uuid(),
  fighterId: z.uuid(),
  assignedById: z.uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  endedById: z.uuid().nullable(),
  endReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  doctorName: z.string().optional(),
});

export const reviewRequestSchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  requestedById: z.uuid(),
  requesterRole: z.enum(userRoles),
  reason: z.string(),
  status: z.enum(reviewRequestStatuses),
  requestedAt: isoDateTimeSchema,
  resolvedByExaminationId: z.uuid().nullable(),
  resolvedAt: isoDateTimeSchema.nullable(),
  revision: z.number().int(),
});

export const injurySchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  reportedById: z.uuid(),
  affectedJoint: z.enum(bodyJoints),
  injuryType: z.string(),
  severity: z.enum(injurySeverities),
  occurredAt: isoDateTimeSchema,
  description: z.string().nullable(),
  status: z.enum(injuryStatuses),
  resolvedAt: isoDateTimeSchema.nullable(),
  sourceAlertId: z.uuid().nullable(),
  triggerVideoId: z.uuid().nullable(),
  revision: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const treatmentSchema = z.strictObject({
  id: z.uuid(),
  injuryId: z.uuid(),
  doctorId: z.uuid(),
  treatmentDate: isoDateTimeSchema,
  treatmentType: z.string(),
  description: z.string().nullable(),
  outcomeNotes: z.string().nullable(),
  nextReviewAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const recoveryPlanSchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  injuryId: z.uuid(),
  doctorId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string(),
  estimatedEndDate: z.string().nullable(),
  actualEndDate: z.string().nullable(),
  status: z.enum(recoveryPlanStatuses),
  milestones: recoveryMilestonesResponseSchema,
  revision: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const examinationSchema = z.strictObject({
  id: z.uuid(),
  sequenceNo: z.number().int(),
  fighterId: z.uuid(),
  doctorId: z.uuid(),
  recordedById: z.uuid(),
  scope: z.enum(examinationScopes),
  decision: z.enum(examinationDecisions),
  examinedAt: isoDateTimeSchema,
  reason: z.string(),
  restrictions: z
    .strictObject({
      ...restrictionListsResponseShape,
      notes: z.string().nullable(),
    })
    .nullable(),
  validUntil: isoDateTimeSchema.nullable(),
  supersedesId: z.uuid().nullable(),
  createdAt: isoDateTimeSchema,
  /** null for examinations recorded without details (all before 016). */
  details: z
    .strictObject({
      examinationType: z.enum(examinationTypes),
      vitals: z
        .strictObject({
          weightKg: z.number(),
          restingHeartRate: z.number().int(),
          bloodPressureSystolic: z.number().int(),
          bloodPressureDiastolic: z.number().int(),
          temperatureC: z.number(),
          spo2Pct: z.number().int(),
          hydration: z.enum(hydrationLevels),
        })
        .nullable(),
      assessments: z.array(examinationAssessmentSchema),
      recommendations: z.string().nullable(),
      followUpDate: z.string().nullable(),
      scat6: scat6RecordSchema.nullable(),
    })
    .nullable(),
});

export const clearanceSchema = z.strictObject({
  id: z.uuid(),
  fighterId: z.uuid(),
  examinationId: z.uuid().nullable(),
  issuedById: z.uuid(),
  clearanceType: z.enum(clearanceTypes),
  status: z.enum(clearanceStatuses),
  validFrom: isoDateTimeSchema,
  validUntil: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  // `notes` is the source examination's restriction text: a clearance always
  // carries the examination's written conditions, whatever the issuer typed.
  restrictions: z.strictObject({
    ...restrictionListsResponseShape,
    notes: z.string().nullable(),
  }),
  revokedAt: isoDateTimeSchema.nullable(),
  revokedById: z.uuid().nullable(),
  revokedReason: z.string().nullable(),
  revision: z.number().int(),
  createdAt: isoDateTimeSchema,
  isCurrentlyValid: z.boolean(),
});

export const medicalEligibilitySchema = z.strictObject({
  scope: z.enum(examinationScopes),
  eligible: z.boolean(),
  reasons: z.array(z.enum(MEDICAL_ELIGIBILITY_REASON)),
  supervision: z.enum(['DOCTOR', 'NONE']),
});

export const medicalDossierSchema = z.strictObject({
  fighterId: z.uuid(),
  activeInjuries: z.array(injurySchema),
  activeRecoveryPlans: z.array(recoveryPlanSchema),
  currentExaminations: z.strictObject({
    training: examinationSchema.nullable(),
    competition: examinationSchema.nullable(),
  }),
  activeClearances: z.array(clearanceSchema),
  openReviewRequests: z.array(reviewRequestSchema),
  eligibility: z.strictObject({
    training: medicalEligibilitySchema,
    competition: medicalEligibilitySchema,
  }),
});

export const medicalHistoryEntrySchema = z.strictObject({
  recordType: z.enum(MEDICAL_HISTORY_RECORD_TYPE),
  recordId: z.uuid(),
  revision: z.number().int(),
  // null for append-only originals (treatments, examinations): the record
  // itself is the history, not a revision of a mutable record.
  source: z.enum(revisionSources).nullable(),
  recordedAt: isoDateTimeSchema,
  recordedByUserId: z.uuid().nullable(),
  snapshot: z.record(z.string(), z.unknown()),
});

// --- Types ---

export type ListDoctorAssignmentsQuery = z.infer<
  typeof listDoctorAssignmentsQuerySchema
>;
export type ListReviewRequestsQuery = z.infer<
  typeof listReviewRequestsQuerySchema
>;
export type ListExaminationsQuery = z.infer<typeof listExaminationsQuerySchema>;
export type ListMedicalHistoryQuery = z.infer<
  typeof listMedicalHistoryQuerySchema
>;
export type AssignDoctorInput = z.infer<typeof assignDoctorSchema>;
export type EndDoctorAssignmentInput = z.infer<typeof endDoctorAssignmentSchema>;
export type CreateReviewRequestInput = z.infer<typeof createReviewRequestSchema>;
export type CreateInjuryInput = z.infer<typeof createInjurySchema>;
export type UpdateInjuryInput = z.infer<typeof updateInjurySchema>;
export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;
export type CreateRecoveryPlanInput = z.infer<typeof createRecoveryPlanSchema>;
export type UpdateRecoveryPlanInput = z.infer<typeof updateRecoveryPlanSchema>;
export type CreateRecoveryMilestoneInput = z.infer<
  typeof createRecoveryMilestoneInputSchema
>;
export type UpdateRecoveryMilestoneInput = z.infer<
  typeof updateRecoveryMilestoneInputSchema
>;
export type RecoveryMilestone = z.infer<typeof recoveryMilestoneSchema>;
export type CreateExaminationInput = z.infer<typeof createExaminationSchema>;
export type IssueClearanceInput = z.infer<typeof issueClearanceSchema>;
export type RevokeClearanceInput = z.infer<typeof revokeClearanceSchema>;

export type DoctorAssignment = z.input<typeof doctorAssignmentSchema>;
export type ReviewRequest = z.input<typeof reviewRequestSchema>;
export type Injury = z.input<typeof injurySchema>;
export type Treatment = z.input<typeof treatmentSchema>;
export type RecoveryPlan = z.input<typeof recoveryPlanSchema>;
export type Examination = z.input<typeof examinationSchema>;
export type ExaminationDetails = NonNullable<Examination['details']>;
export type Clearance = z.input<typeof clearanceSchema>;
export type MedicalEligibility = z.infer<typeof medicalEligibilitySchema>;
export type MedicalDossier = z.input<typeof medicalDossierSchema>;
export type MedicalHistoryEntry = z.input<typeof medicalHistoryEntrySchema>;

export type Paginated<T> = { data: T[]; total: number; hasNextPage: boolean };
