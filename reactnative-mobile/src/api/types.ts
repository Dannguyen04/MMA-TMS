import type { FighterRegisterBody } from "@/auth/fighter-register-body";
import type { WeightClass } from "@/constants/weight-classes";

export const USER_ROLES = ["GUEST", "FIGHTER", "COACH", "DOCTOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type LoginBody = {
  email: string;
  password: string;
};

export type RegisterBody = FighterRegisterBody;

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  expiresIn: number;
  tokenType: string;
};

export type AuthUser = {
  id: string;
  authSubject: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  user: AuthUser;
  session: AuthSession;
};

export type FighterPublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
  nationality?: string | null;
  heightCm?: number | null;
  reachCm?: number | null;
  dominantStance?: FighterStance | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftLegCm?: number | null;
  rightLegCm?: number | null;
  gym?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
};

/** Hồ sơ HLV / bác sĩ (coachProfileSchema / doctorProfileSchema + id trong users.model.ts). */
export type NamedPublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  isHeadCoach?: boolean;
  specialization?: string | null;
  licenseNumber?: string;
  profileImageUrl?: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  profile: FighterPublicProfile | NamedPublicProfile | null;
};

export type AdmissionEmailCodeResponse = {
  requested: true;
};

export type AdmissionEmailVerifyBody = {
  email: string;
  token: string;
};

export type RegisterResponse = {
  user: PublicUser;
  session: AuthSession | null;
  confirmationRequired: boolean;
};

export type LogoutResponse = {
  loggedOut: true;
};

export type RefreshBody = {
  refreshToken: string;
};

export type ForgotPasswordBody = {
  email: string;
};

export type ForgotPasswordResponse = {
  requested: true;
};

export type ResetPasswordBody = {
  tokenHash: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  passwordUpdated: true;
  admissionActivationReady: boolean;
};

export type HealthStatus = {
  status: string;
  service: string;
  uptime: number;
  timestamp: string;
};

export const FIGHTER_STANCES = ["ORTHODOX", "SOUTHPAW", "SWITCH"] as const;
export type FighterStance = (typeof FIGHTER_STANCES)[number];

export const MEDICAL_STATUSES = [
  "HEALTHY",
  "MONITORING",
  "RECOVERY",
  "INJURED",
  "NOT_CLEARED",
] as const;
export type MedicalStatus = (typeof MEDICAL_STATUSES)[number];

export const MEASUREMENT_CONTEXTS = [
  "TRAINING",
  "CHECKUP",
  "WEIGH_IN",
  "SELF_REPORTED",
] as const;
export type MeasurementContext = (typeof MEASUREMENT_CONTEXTS)[number];

export const SESSION_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "ABANDONED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_TYPES = [
  "SHADOW_BOXING",
  "PAD_WORK",
  "HEAVY_BAG",
  "SPARRING",
  "GRAPPLING",
  "STRENGTH_CONDITIONING",
  "RECOVERY",
  "PHYSICAL_THERAPY",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const TRAINING_PLAN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;
export type TrainingPlanStatus = (typeof TRAINING_PLAN_STATUSES)[number];

/** Lowercase values required by `POST /training-plans`. Uppercase is rejected. */
export const TRAINING_PLAN_PHASES = [
  "base",
  "build",
  "fight_camp",
  "taper",
  "rehab",
  "maintenance",
] as const;
export type TrainingPlanPhase = (typeof TRAINING_PLAN_PHASES)[number];

export const EXERCISE_CATEGORIES = [
  "STRIKING",
  "GRAPPLING",
  "STRENGTH_CONDITIONING",
  "RECOVERY",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export type PageQuery = {
  page?: number;
  limit?: number;
};

/** Nest paginated envelope is `{ success, data: { data, total, hasNextPage } }`. */
export type Paginated<T> = {
  data: T[];
  total: number;
  hasNextPage: boolean;
};

export type PublicFighter = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string | null;
  weightClass: WeightClass;
  heightCm: number | null;
  reachCm: number | null;
  dominantStance: FighterStance | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  leftLegCm: number | null;
  rightLegCm: number | null;
  gym: string | null;
  currentMedicalStatus: MedicalStatus;
  bio: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListFightersQuery = PageQuery & {
  weightClass?: WeightClass;
  dominantStance?: FighterStance;
  gym?: string;
  medicalStatus?: MedicalStatus;
  search?: string;
};

export type UpdateFighterProfileBody = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string | null;
  weightClass?: WeightClass;
  heightCm?: number | null;
  reachCm?: number | null;
  dominantStance?: FighterStance | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftLegCm?: number | null;
  rightLegCm?: number | null;
  gym?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
};

export type FighterMeasurement = {
  id: string;
  fighterId: string;
  recordedById: string;
  measuredAt: string;
  measurementContext: MeasurementContext;
  weightKg: number;
  heightCm: number | null;
  reachCm: number | null;
  notes: string | null;
  supersedesId: string | null;
  isSuperseded: boolean;
  createdAt: string;
};

export type ListMeasurementsQuery = PageQuery & {
  includeSuperseded?: boolean;
};

export type CreateMeasurementBody = {
  weightKg: number;
  heightCm?: number;
  reachCm?: number;
  measurementContext: MeasurementContext;
  measuredAt?: string;
  notes?: string | null;
};

export type CoachAssignment = {
  id: string;
  coachId: string;
  fighterId: string;
  assignedById: string;
  startsAt: string;
  endsAt: string | null;
  endedById: string | null;
  endReason: string | null;
  createdAt: string;
  coachName?: string;
  coachGym?: string | null;
};

export type AssignCoachBody = {
  coachId: string;
  startsAt?: string;
};

export type EndCoachAssignmentBody = {
  endReason: string;
  endsAt?: string;
};

export type ListFighterSessionsQuery = PageQuery & {
  status?: SessionStatus;
  sessionType?: SessionType;
  fromDate?: string;
  toDate?: string;
};

export type TrainingSessionSummary = {
  id: string;
  fighterId: string;
  coachId: string | null;
  planId: string | null;
  title: string;
  scheduledAt: string;
  plannedDurationSec: number | null;
  actualDurationSec: number | null;
  roundCount: number;
  location: string | null;
  sessionType: SessionType;
  status: SessionStatus;
  coachNotes: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type MedicalClearanceSummary = {
  id: string;
  clearanceType: string;
  status: string;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
};

export type MedicalInjurySummary = {
  id: string;
  affectedJoint: string;
  injuryType: string;
  severity: string;
  status: string;
  occurredAt: string;
  description: string | null;
};

export type MedicalJointState = {
  id: string;
  joint: string;
  currentState: string;
  stateUpdatedAt: string;
  notes: string | null;
};

export type FighterMedicalSummary = {
  fighterId: string;
  currentMedicalStatus: MedicalStatus;
  activeClearance: MedicalClearanceSummary | null;
  activeInjuries: MedicalInjurySummary[];
  jointStates: MedicalJointState[];
  disclaimer: string;
};

/** Training-plan milestone: `completedAt` is required when completed and must be absent otherwise. */
export type PlanMilestone = {
  id?: string;
  title: string;
  isCompleted?: boolean;
  completedAt?: string;
  notes?: string | null;
};

export type ProgressMetrics = {
  totalSessions: number;
  completedSessions: number;
  completionPercentage: number;
};

export type TrainingPlan = {
  id: string;
  fighterId: string;
  coachId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  status: TrainingPlanStatus;
  phase: TrainingPlanPhase;
  goals: string | null;
  milestones: PlanMilestone[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  progress?: ProgressMetrics;
};

export type ListTrainingPlansQuery = PageQuery & {
  fighterId?: string;
  coachId?: string;
  status?: TrainingPlanStatus;
  isActive?: boolean;
};

export type CreateTrainingPlanBody = {
  fighterId: string;
  coachId: string;
  title: string;
  startDate: string;
  phase: TrainingPlanPhase;
  description?: string | null;
  endDate?: string | null;
  goals?: string | null;
  milestones?: PlanMilestone[];
};

export type UpdateTrainingPlanBody = {
  title?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string | null;
  phase?: TrainingPlanPhase;
  goals?: string | null;
  milestones?: PlanMilestone[];
  isActive?: boolean;
};

export type UpdateTrainingPlanStatusBody = {
  status: TrainingPlanStatus;
};

export type TrainingPlanExercise = {
  id: string;
  planId: string;
  exerciseId: string;
  orderIndex: number;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  targetRpe: number | null;
  coachNotes: string | null;
  createdAt: string;
};

export type CreatePlanExerciseBody = {
  exerciseId: string;
  orderIndex: number;
  sets?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  targetRpe?: number | null;
  coachNotes?: string | null;
};

export type UpdatePlanExerciseBody = {
  orderIndex?: number;
  sets?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  targetRpe?: number | null;
  coachNotes?: string | null;
};

export type RemovedPlanExercise = {
  id: string;
};

export type TrainingSession = {
  id: string;
  fighterId: string;
  coachId: string | null;
  planId: string | null;
  title: string;
  scheduledAt: string;
  plannedDurationSec: number | null;
  actualDurationSec: number | null;
  roundCount: number;
  location: string | null;
  sessionType: SessionType;
  status: SessionStatus;
  coachNotes: string | null;
  cancellationReason: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
  skippedAt: string | null;
  reportedRpe: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  cancelledAt: string | null;
};

export type ListTrainingSessionsQuery = PageQuery & {
  fighterId?: string;
  coachId?: string;
  planId?: string;
  status?: SessionStatus;
  sessionType?: SessionType;
  fromDate?: string;
  toDate?: string;
};

export type CreateTrainingSessionBody = {
  fighterId: string;
  title: string;
  scheduledAt: string;
  sessionType: SessionType;
  coachId?: string | null;
  planId?: string | null;
  plannedDurationSec?: number | null;
  roundCount?: number;
  location?: string | null;
  coachNotes?: string | null;
};

/** Strict `PATCH /training-sessions/:id`: `actualDurationSec` is server-owned and `cancellationReason` travels with the status route. */
export type UpdateTrainingSessionBody = {
  title?: string;
  scheduledAt?: string;
  plannedDurationSec?: number | null;
  roundCount?: number;
  location?: string | null;
  sessionType?: SessionType;
  coachNotes?: string | null;
  reportedRpe?: number | null;
};

/** `cancellationReason` is required exactly when `status` is CANCELLED and rejected otherwise. */
export type UpdateTrainingSessionStatusBody =
  | { status: Exclude<SessionStatus, "CANCELLED"> }
  | { status: "CANCELLED"; cancellationReason: string };

/** Mirror of backend `ALLOWED_SESSION_TRANSITIONS`; absent keys are terminal. */
export const ALLOWED_SESSION_TRANSITIONS: Partial<Record<SessionStatus, readonly SessionStatus[]>> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED", "SKIPPED"],
  IN_PROGRESS: ["COMPLETED", "ABANDONED", "CANCELLED"],
};

/** Mirror of backend `FORBIDDEN_PLAN_TRANSITIONS` (denylist). */
export const FORBIDDEN_PLAN_TRANSITIONS: Partial<
  Record<TrainingPlanStatus, readonly TrainingPlanStatus[]>
> = {
  COMPLETED: ["DRAFT"],
  CANCELLED: ["DRAFT"],
};

export type Exercise = {
  id: string;
  name: string;
  description: string | null;
  category: ExerciseCategory;
  targetMuscleGroups: string[];
  videoUrl: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ListExercisesQuery = PageQuery & {
  category?: ExerciseCategory;
  targetMuscle?: string;
  search?: string;
};

export type CreateExerciseBody = {
  name: string;
  category: ExerciseCategory;
  description?: string | null;
  targetMuscleGroups?: string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

export type UpdateExerciseBody = {
  name?: string;
  description?: string | null;
  category?: ExerciseCategory;
  targetMuscleGroups?: string[];
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

// --- Medical (§11): mirrors nestjs-api/src/medical/medical.model.ts response schemas ---

export const BODY_JOINTS = [
  "LEFT_SHOULDER",
  "RIGHT_SHOULDER",
  "LEFT_ELBOW",
  "RIGHT_ELBOW",
  "LEFT_WRIST",
  "RIGHT_WRIST",
  "LEFT_HIP",
  "RIGHT_HIP",
  "LEFT_KNEE",
  "RIGHT_KNEE",
  "LEFT_ANKLE",
  "RIGHT_ANKLE",
  "SPINE_CORE",
] as const;
export type BodyJoint = (typeof BODY_JOINTS)[number];

export const TECHNIQUE_TYPES = [
  "JAB",
  "CROSS",
  "LEAD_HOOK",
  "REAR_HOOK",
  "LEAD_UPPERCUT",
  "REAR_UPPERCUT",
  "LEAD_LOW_KICK",
  "REAR_LOW_KICK",
  "LEAD_MIDDLE_KICK",
  "REAR_MIDDLE_KICK",
  "LEAD_HIGH_KICK",
  "REAR_HIGH_KICK",
  "FRONT_TEEP",
  "SPINNING_BACK_FIST",
] as const;
export type TechniqueType = (typeof TECHNIQUE_TYPES)[number];

export const EXAMINATION_SCOPES = ["TRAINING", "COMPETITION"] as const;
export type ExaminationScope = (typeof EXAMINATION_SCOPES)[number];

export const EXAMINATION_DECISIONS = [
  "ELIGIBLE",
  "ELIGIBLE_WITH_RESTRICTIONS",
  "NOT_ELIGIBLE",
] as const;
export type ExaminationDecision = (typeof EXAMINATION_DECISIONS)[number];

export const REVIEW_REQUEST_STATUSES = ["OPEN", "RESOLVED"] as const;
export type ReviewRequestStatus = (typeof REVIEW_REQUEST_STATUSES)[number];

export const MEDICAL_REVISION_SOURCES = ["APPLICATION", "MIGRATION_BASELINE"] as const;
export type MedicalRevisionSource = (typeof MEDICAL_REVISION_SOURCES)[number];

export const INJURY_STATUSES = ["ACTIVE", "RECOVERING", "RESOLVED"] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const INJURY_SEVERITIES = ["MINOR", "MODERATE", "SEVERE", "CRITICAL"] as const;
export type InjurySeverity = (typeof INJURY_SEVERITIES)[number];

export const RECOVERY_PLAN_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type RecoveryPlanStatus = (typeof RECOVERY_PLAN_STATUSES)[number];

export const CLEARANCE_TYPES = ["TRAINING", "COMPETITION", "RETURN_FROM_INJURY"] as const;
export type ClearanceType = (typeof CLEARANCE_TYPES)[number];

export const CLEARANCE_STATUSES = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number];

export const MEDICAL_HISTORY_RECORD_TYPES = [
  "INJURY",
  "TREATMENT",
  "RECOVERY_PLAN",
  "MEDICAL_EXAMINATION",
  "MEDICAL_CLEARANCE",
  "MEDICAL_REVIEW_REQUEST",
] as const;
export type MedicalHistoryRecordType = (typeof MEDICAL_HISTORY_RECORD_TYPES)[number];

export type MedicalRestrictionLists = {
  allowedSessionTypes: SessionType[] | null;
  allowedTechniqueTypes: TechniqueType[] | null;
  excludedJoints: BodyJoint[] | null;
};

export type MedicalRestrictions = MedicalRestrictionLists & {
  notes: string | null;
};

export type DoctorAssignment = {
  id: string;
  doctorId: string;
  fighterId: string;
  assignedById: string;
  startsAt: string;
  endsAt: string | null;
  endedById: string | null;
  endReason: string | null;
  createdAt: string;
  doctorName?: string;
};

export type MedicalReviewRequest = {
  id: string;
  fighterId: string;
  requestedById: string;
  requesterRole: UserRole;
  reason: string;
  status: ReviewRequestStatus;
  requestedAt: string;
  resolvedByExaminationId: string | null;
  resolvedAt: string | null;
  revision: number;
};

export type MedicalInjury = {
  id: string;
  fighterId: string;
  reportedById: string;
  affectedJoint: BodyJoint;
  injuryType: string;
  severity: InjurySeverity;
  occurredAt: string;
  description: string | null;
  status: InjuryStatus;
  resolvedAt: string | null;
  sourceAlertId: string | null;
  triggerVideoId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

/** Standard recovery milestone; `completedAt` is server-owned. */
export type RecoveryMilestone = {
  id: string;
  title: string;
  criteria: string;
  targetDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
};

export type RecoveryPlan = {
  id: string;
  fighterId: string;
  injuryId: string;
  doctorId: string;
  title: string;
  description: string | null;
  startDate: string;
  estimatedEndDate: string | null;
  actualEndDate: string | null;
  status: RecoveryPlanStatus;
  /** Standard milestones, or a legacy JSON array returned unchanged. */
  milestones: RecoveryMilestone[] | unknown[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export const EXAMINATION_TYPES = [
  "BASELINE",
  "ROUTINE",
  "PRE_FIGHT",
  "POST_INJURY",
  "CONCUSSION_SCREEN",
  "RETURN_TO_PLAY",
] as const;
export type ExaminationType = (typeof EXAMINATION_TYPES)[number];

export const ASSESSMENT_RESULTS = ["NORMAL", "ABNORMAL", "INCONCLUSIVE"] as const;
export type AssessmentResult = (typeof ASSESSMENT_RESULTS)[number];

export const HYDRATION_LEVELS = ["GOOD", "FAIR", "POOR"] as const;
export type HydrationLevel = (typeof HYDRATION_LEVELS)[number];

export type ExaminationVitals = {
  weightKg: number;
  restingHeartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperatureC: number;
  spo2Pct: number;
  hydration: HydrationLevel;
};

export type ExaminationAssessment = {
  area: string;
  result: AssessmentResult;
  note: string | null;
};

/** Server scores only. Clients must not send or edit totals. */
export type Scat6Record = {
  formVersion: string;
  responses: { status: string; formVersion: string };
  scoringVersion: number | null;
  scores: Record<string, number | number[] | boolean | null> | null;
};

export type ExaminationDetails = {
  examinationType: ExaminationType;
  vitals: ExaminationVitals | null;
  assessments: ExaminationAssessment[];
  recommendations: string | null;
  followUpDate: string | null;
  scat6: Scat6Record | null;
};

export type MedicalExamination = {
  id: string;
  sequenceNo: number;
  fighterId: string;
  doctorId: string;
  recordedById: string;
  scope: ExaminationScope;
  decision: ExaminationDecision;
  examinedAt: string;
  reason: string;
  restrictions: MedicalRestrictions | null;
  validUntil: string | null;
  supersedesId: string | null;
  createdAt: string;
  /** Null on examinations stored before details existed. Not the same as "not examined". */
  details: ExaminationDetails | null;
};

export type MedicalClearance = {
  id: string;
  fighterId: string;
  examinationId: string | null;
  issuedById: string;
  clearanceType: ClearanceType;
  status: ClearanceStatus;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
  restrictions: MedicalRestrictions;
  revokedAt: string | null;
  revokedById: string | null;
  revokedReason: string | null;
  revision: number;
  createdAt: string;
  isCurrentlyValid: boolean;
};

export type MedicalEligibility = {
  scope: ExaminationScope;
  eligible: boolean;
  reasons: string[];
};

export type MedicalDossier = {
  fighterId: string;
  activeInjuries: MedicalInjury[];
  activeRecoveryPlans: RecoveryPlan[];
  currentExaminations: {
    training: MedicalExamination | null;
    competition: MedicalExamination | null;
  };
  activeClearances: MedicalClearance[];
  openReviewRequests: MedicalReviewRequest[];
  eligibility: {
    training: MedicalEligibility;
    competition: MedicalEligibility;
  };
};

/** `snapshot` keys are snake_case column names; adapt per `recordType`. */
export type MedicalHistoryEntry = {
  recordType: MedicalHistoryRecordType;
  recordId: string;
  revision: number;
  source: MedicalRevisionSource | null;
  recordedAt: string;
  recordedByUserId: string | null;
  snapshot: Record<string, unknown>;
};

export type ListMedicalHistoryQuery = PageQuery & {
  recordType?: MedicalHistoryRecordType;
};

export type ListMedicalExaminationsQuery = PageQuery & {
  scope?: ExaminationScope;
};

export type ListReviewRequestsQuery = PageQuery & {
  status?: ReviewRequestStatus;
};

export type ListDoctorAssignmentsQuery = PageQuery;

export type CreateReviewRequestBody = {
  reason: string;
};

export type CreateExaminationBody = {
  scope: ExaminationScope;
  decision: ExaminationDecision;
  examinedAt: string;
  reason: string;
  restrictions?: {
    allowedSessionTypes?: SessionType[];
    allowedTechniqueTypes?: TechniqueType[];
    excludedJoints?: BodyJoint[];
    notes?: string;
  };
  validUntil?: string;
  examinationType: "BASELINE";
  vitals: ExaminationVitals;
  assessments: ExaminationAssessment[];
  recommendations?: string;
  followUpDate?: string;
  scat6: {
    status: "NOT_ADMINISTERED";
    formVersion: "SCAT6-2023-EN";
    reason: string;
  };
};

export type CreateClearanceBody = {
  examinationId: string;
  clearanceType: ClearanceType;
  notes?: string;
};

export type CreateInjuryBody = {
  affectedJoint: BodyJoint;
  injuryType: string;
  severity: InjurySeverity;
  occurredAt: string;
  description?: string;
};

export type CreateRecoveryPlanBody = {
  injuryId: string;
  title: string;
  description?: string;
  startDate: string;
  estimatedEndDate?: string;
  milestones: {
    title: string;
    criteria: string;
    targetDate?: string | null;
  }[];
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type UserListPage = {
  items: PublicUser[];
  total: number;
  page: number;
  limit: number;
};

export function isFighterProfile(
  profile: PublicUser["profile"],
): profile is FighterPublicProfile {
  return (
    !!profile &&
    "weightClass" in profile &&
    typeof profile.weightClass === "string" &&
    "dateOfBirth" in profile
  );
}
