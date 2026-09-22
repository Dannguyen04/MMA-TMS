/**
 * Domain model for MMA-TMS.
 *
 * These types are the contract between the data layer (mock today, NestJS API later)
 * and the UI. Dates are ISO-8601 strings so every entity is serializable across the
 * Server → Client Component boundary.
 */

export type ISODate = string;

/* ────────────────────────────────────────────────────────────────────────────
 * Identity & access
 * ──────────────────────────────────────────────────────────────────────────── */

export type Role = "fighter" | "coach" | "doctor" | "admin";

export type UserStatus = "active" | "invited" | "suspended";

export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    /** Job title shown under the name, e.g. "Head Striking Coach". */
    title: string;
    phone: string | null;
    status: UserStatus;
    createdAt: ISODate;
    lastActiveAt: ISODate | null;
    /** Profile id in the role-specific table (fighter/coach/doctor). Null for admins. */
    profileId: string | null;
    /** Năng lực hiệu lực do backend trả về; thiếu trường này đồng nghĩa không có quyền UI. */
    effectiveCapabilities?: Permission[];
    /** Phạm vi võ sĩ do backend xác lập; thiếu phạm vi thì từ chối truy cập bản ghi. */
    assignmentScope?: {
        fighterIds: string[];
    };
}

export type Permission =
    | "fighters:read"
    | "fighters:write"
    | "training:read"
    | "training:write"
    | "videos:upload"
    | "videos:manage"
    | "ai_analysis:read"
    | "ai_findings:review"
    | "ai_alerts:review"
    | "goals:write"
    | "medical:read_summary"
    | "medical:read"
    | "medical:write"
    | "clearance:manage"
    | "users:manage"
    | "roles:manage"
    | "ai_jobs:manage"
    | "ai_models:manage"
    | "audit_logs:read"
    | "notifications:manage"
    | "settings:manage";

export interface RoleDefinition {
    role: Role;
    label: string;
    description: string;
    permissions: Permission[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * People
 * ──────────────────────────────────────────────────────────────────────────── */

export type Sex = "male" | "female";

export type WeightClass =
    | "strawweight"
    | "flyweight"
    | "bantamweight"
    | "featherweight"
    | "lightweight"
    | "welterweight"
    | "middleweight"
    | "light_heavyweight"
    | "heavyweight";

export type Stance = "orthodox" | "southpaw" | "switch";

export type TrainingLevel = "amateur" | "semi_pro" | "professional" | "elite";

export type HealthStatus = "healthy" | "monitoring" | "injured" | "recovery" | "not_cleared";

export interface FightRecord {
    wins: number;
    losses: number;
    draws: number;
}

export interface UpcomingBout {
    date: ISODate;
    event: string;
    opponent: string;
    weightClass: WeightClass;
}

export interface Fighter {
    id: string;
    userId: string;
    name: string;
    nickname: string | null;
    sex: Sex;
    dateOfBirth: ISODate;
    nationality: string;
    heightCm: number;
    reachCm: number;
    weightKg: number;
    /** Fight-night limit for the weight class, in kg. */
    targetWeightKg: number;
    bodyFatPct: number;
    restingHeartRate: number;
    weightClass: WeightClass;
    stance: Stance;
    level: TrainingLevel;
    primaryDiscipline: string;
    record: FightRecord;
    coachIds: string[];
    /** Primary coach responsible for planning. Always included in coachIds. */
    primaryCoachId: string;
    doctorIds: string[];
    healthStatus: HealthStatus;
    joinedAt: ISODate;
    upcomingBout: UpcomingBout | null;
}

export interface Coach {
    id: string;
    userId: string;
    name: string;
    specialty: string;
    certifications: string[];
    yearsExperience: number;
    fighterIds: string[];
}

export interface Doctor {
    id: string;
    userId: string;
    name: string;
    specialty: string;
    licenseNumber: string;
    fighterIds: string[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Training
 * ──────────────────────────────────────────────────────────────────────────── */

export type TrainingType =
    | "shadow_boxing"
    | "pad_work"
    | "heavy_bag"
    | "sparring"
    | "technical_drilling"
    | "grappling"
    | "strength_conditioning"
    | "recovery_mobility";

/** Training types that can be uploaded for AI video analysis. */
export type VideoTrainingType = Extract<TrainingType, "shadow_boxing" | "pad_work" | "heavy_bag" | "sparring">;

/** Performance dimensions tracked across the product. */
export type Technique =
    | "jab"
    | "cross"
    | "hook"
    | "kick"
    | "combination"
    | "footwork"
    | "guard"
    | "head_movement";

/** Single strikes the action-recognition model classifies. */
export type StrikeType = Extract<Technique, "jab" | "cross" | "hook" | "kick">;

export type ExerciseCategory = "striking" | "defense" | "footwork" | "grappling" | "conditioning" | "strength" | "mobility";

export type Intensity = "low" | "moderate" | "high";

export interface Exercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    description: string;
    techniques: Technique[];
    intensity: Intensity;
    equipment: string[];
    defaultRounds: number | null;
    defaultRoundSec: number | null;
    defaultSets: number | null;
    defaultReps: number | null;
    /** Body regions that should not be loaded by this exercise when injured. */
    loadsRegions: BodyRegion[];
}

export type TrainingPhase = "base" | "build" | "fight_camp" | "taper" | "rehab" | "maintenance";

export type PlanStatus = "draft" | "active" | "completed" | "archived";

export interface TrainingPlan {
    id: string;
    title: string;
    fighterId: string;
    coachId: string;
    objective: string;
    phase: TrainingPhase;
    focusAreas: Technique[];
    startDate: ISODate;
    endDate: ISODate;
    weeklySessionTarget: number;
    status: PlanStatus;
    notes: string;
    createdAt: ISODate;
    updatedAt: ISODate;
}

export type SessionStatus = "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";

export interface SessionExercise {
    exerciseId: string;
    rounds: number | null;
    roundSec: number | null;
    sets: number | null;
    reps: number | null;
    notes: string | null;
    completed: boolean;
}

export interface SessionResult {
    completedAt: ISODate;
    actualDurationMin: number;
    /** Session RPE reported by the fighter, 1–10. */
    rpe: number;
    roundsCompleted: number;
    /** Coach rating of the session quality, 1–5. */
    coachRating: number;
    summary: string;
}

export interface TrainingSession {
    id: string;
    planId: string | null;
    fighterId: string;
    coachId: string;
    title: string;
    type: TrainingType;
    scheduledAt: ISODate;
    durationMin: number;
    location: string;
    /** Planned intensity on the RPE scale, 1–10. */
    targetRpe: number;
    status: SessionStatus;
    exercises: SessionExercise[];
    result: SessionResult | null;
    videoIds: string[];
    cancellationReason: string | null;
    notes: string | null;
}

export type FeedbackKind = "praise" | "correction" | "note";

export interface CoachFeedback {
    id: string;
    fighterId: string;
    coachId: string;
    sessionId: string | null;
    videoId: string | null;
    kind: FeedbackKind;
    body: string;
    techniques: Technique[];
    createdAt: ISODate;
}

export type GoalStatus = "on_track" | "at_risk" | "achieved" | "missed";

export interface GoalCheckpoint {
    date: ISODate;
    value: number;
}

export interface Goal {
    id: string;
    fighterId: string;
    coachId: string;
    title: string;
    technique: Technique | null;
    metricLabel: string;
    unit: string;
    /** When true a lower value is better (e.g. guard recovery time). */
    lowerIsBetter: boolean;
    baseline: number;
    target: number;
    current: number;
    startDate: ISODate;
    dueDate: ISODate;
    status: GoalStatus;
    history: GoalCheckpoint[];
    createdAt: ISODate;
}

/** Weekly performance snapshot aggregated from sessions and AI analyses. */
export interface PerformanceMetric {
    id: string;
    fighterId: string;
    weekStart: ISODate;
    /** Quality score per dimension, 0–100. */
    scores: Record<Technique, number>;
    /** Strikes detected across analysed footage that week. */
    strikeCounts: Record<StrikeType, number>;
    combinations: number;
    sessionsCompleted: number;
    trainingMinutes: number;
    /** Average session RPE, 1–10. */
    avgRpe: number;
    /** Estimated average hand speed in m/s. */
    avgPunchSpeed: number;
    /** Estimated average foot speed in m/s. */
    avgKickSpeed: number;
    /** Share of active time with a correct guard, 0–100. */
    guardUptimePct: number;
    headMovementsPerMin: number;
}

/** Plan adherence for a week, derived from sessions. */
export interface TrainingProgress {
    fighterId: string;
    planId: string | null;
    weekStart: ISODate;
    plannedSessions: number;
    completedSessions: number;
    missedSessions: number;
    adherencePct: number;
    trainingMinutes: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Video & AI analysis
 * ──────────────────────────────────────────────────────────────────────────── */

export type CameraAngle = "front" | "side" | "diagonal";

export type VideoStatus = "uploading" | "queued" | "processing" | "completed" | "failed";

export interface Video {
    id: string;
    fighterId: string;
    uploadedById: string;
    sessionId: string | null;
    title: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    fileName: string;
    fileSizeMb: number;
    durationSec: number;
    resolution: string;
    fps: number;
    uploadedAt: ISODate;
    status: VideoStatus;
    jobId: string | null;
    analysisId: string | null;
    /** Playable URL when footage is stored (API mode). Null for mock footage. */
    sourceUrl: string | null;
    notes: string | null;
}

export type AIJobStatus = "queued" | "processing" | "completed" | "failed";

export type PipelineStage =
    | "queued"
    | "decoding"
    | "fighter_detection"
    | "tracking"
    | "pose_estimation"
    | "action_recognition"
    | "metrics"
    | "findings"
    | "done";

export interface AIJob {
    id: string;
    videoId: string;
    fighterId: string;
    status: AIJobStatus;
    stage: PipelineStage;
    progressPct: number;
    modelIds: string[];
    workerId: string | null;
    attempts: number;
    queuedAt: ISODate;
    startedAt: ISODate | null;
    finishedAt: ISODate | null;
    durationSec: number | null;
    /** Mean detection confidence, 0–1. Null until actions are recognised. */
    avgConfidence: number | null;
    lowConfidence: boolean;
    errorCode: string | null;
    errorMessage: string | null;
}

export type Limb = "left_arm" | "right_arm" | "left_leg" | "right_leg";

/** Human review of a single AI output (detection or finding). Doubles as AI feedback for model improvement. */
export type ReviewDecision = "confirmed" | "corrected" | "rejected";

export interface AIFeedback {
    decision: ReviewDecision;
    reviewerId: string;
    reviewerName: string;
    reviewedAt: ISODate;
    note: string | null;
    /** For corrections: the label the reviewer replaced the AI label with. */
    correctedLabel: string | null;
}

export interface Detection {
    id: string;
    type: StrikeType;
    limb: Limb;
    startMs: number;
    peakMs: number;
    endMs: number;
    /** Model confidence, 0–1. */
    confidence: number;
    /** Estimated peak speed of the striking hand/foot in m/s. */
    peakSpeed: number;
    /** Relative acceleration proxy derived from keypoint velocity deltas, 0–10. */
    accelerationProxy: number;
    /** Elbow extension (punches) or knee extension (kicks) at peak, degrees. */
    jointAngleDeg: number;
    /** Hip rotation at peak relative to stance, degrees. */
    hipRotationDeg: number;
    guardMaintained: boolean;
    combinationId: string | null;
    review: AIFeedback | null;
}

export interface Combination {
    id: string;
    label: string;
    detectionIds: string[];
    startMs: number;
    endMs: number;
    confidence: number;
}

export type MovementEventType =
    | "guard_drop"
    | "slip"
    | "roll"
    | "pivot"
    | "step_in"
    | "step_out"
    | "lateral_step"
    | "tracking_lost";

export interface MovementEvent {
    id: string;
    type: MovementEventType;
    startMs: number;
    endMs: number;
    confidence: number;
    detail: string;
}

export interface BodyActivity {
    hands: number;
    legs: number;
    head: number;
    shoulders: number;
    hips: number;
}

export interface AnalysisMetrics {
    strikeCounts: Record<StrikeType, number>;
    combinations: number;
    strikesPerMin: number;
    avgPeakSpeed: Record<StrikeType, number>;
    /** Mean elbow extension on straight punches, degrees. */
    avgPunchExtensionDeg: number;
    /** Mean knee chamber angle on kicks, degrees. */
    avgKickChamberDeg: number;
    avgHipRotationDeg: number;
    guard: {
        uptimePct: number;
        drops: number;
        avgRecoveryMs: number;
    };
    headMovement: {
        movesPerMin: number;
        slips: number;
        rolls: number;
        centerlineExposurePct: number;
    };
    footwork: {
        distanceM: number;
        pivots: number;
        stanceWidthRatio: number;
        balanceScore: number;
    };
    /** Average distance to target/partner in body-lengths (pads, bag, sparring). Null for shadow boxing. */
    relativeDistance: number | null;
    /** Share of movement energy by body region, 0–100. */
    bodyActivity: BodyActivity;
}

export type FindingCategory = Technique | "movement_quality";

export type FindingImpact = "strength" | "improvement" | "concern";

export interface FindingMetricRef {
    label: string;
    value: number;
    unit: string;
    reference: string | null;
}

export interface AIFinding {
    id: string;
    category: FindingCategory;
    impact: FindingImpact;
    title: string;
    description: string;
    confidence: number;
    timestampsMs: number[];
    detectionIds: string[];
    metric: FindingMetricRef | null;
    recommendation: string;
    review: AIFeedback | null;
}

export type AlertStatus = "new" | "acknowledged" | "follow_up" | "dismissed";

export type DoctorDecision = "acknowledged" | "follow_up" | "dismissed";

export interface DoctorReview {
    decision: DoctorDecision;
    reviewerId: string;
    reviewerName: string;
    reviewedAt: ISODate;
    note: string;
}

/**
 * AI observation of potentially abnormal movement. Supporting information for a
 * clinician — never a diagnosis.
 */
export interface AbnormalMovementAlert {
    id: string;
    analysisId: string;
    videoId: string;
    fighterId: string;
    detectedAt: ISODate;
    bodyRegion: BodyRegion;
    pattern: string;
    description: string;
    confidence: number;
    metric: {
        label: string;
        observed: number;
        baseline: number;
        unit: string;
    };
    timestampsMs: number[];
    status: AlertStatus;
    doctorReview: DoctorReview | null;
    linkedInjuryId: string | null;
}

/** Normalised (0–1) COCO-17 keypoint from pose estimation. */
export interface PoseKeypoint {
    x: number;
    y: number;
    conf: number;
}

/** One sampled frame of the tracked fighter's pose. */
export interface PoseFrame {
    timeMs: number;
    keypoints: PoseKeypoint[];
}

export interface CoachReview {
    reviewerId: string;
    reviewerName: string;
    reviewedAt: ISODate;
    /** Overall rating of the footage, 1–5. */
    rating: number;
    summary: string;
}

export interface ModelVersions {
    detection: string;
    pose: string;
    action: string;
    anomaly: string;
}

export interface AIAnalysis {
    id: string;
    videoId: string;
    jobId: string;
    fighterId: string;
    processedAt: ISODate;
    durationMs: number;
    fps: number;
    models: ModelVersions;
    overallConfidence: number;
    /** Share of frames where the fighter was tracked, 0–1. */
    trackingQuality: number;
    summary: string;
    detections: Detection[];
    combinations: Combination[];
    movementEvents: MovementEvent[];
    metrics: AnalysisMetrics;
    findings: AIFinding[];
    alertIds: string[];
    coachReview: CoachReview | null;
    /** Raw worker output (pose frames) when produced by the real pipeline; absent for mock analyses. */
    resultUrl?: string;
}

export type AIModelTask = "fighter_detection" | "pose_estimation" | "action_recognition" | "anomaly_detection";

export type AIModelStatus = "active" | "staging" | "deprecated";

export interface AIModel {
    id: string;
    name: string;
    task: AIModelTask;
    version: string;
    framework: string;
    status: AIModelStatus;
    description: string;
    deployedAt: ISODate;
    confidenceThreshold: number;
    lowConfidenceThreshold: number;
    avgLatencyMs: number;
    precision: number;
    recall: number;
    /** Share of human reviews that confirmed the model output, 0–100. */
    humanAgreementPct: number;
    reviewsCount: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sports medicine
 * ──────────────────────────────────────────────────────────────────────────── */

export type BodyRegion =
    | "head"
    | "neck"
    | "left_shoulder"
    | "right_shoulder"
    | "left_elbow"
    | "right_elbow"
    | "left_hand"
    | "right_hand"
    | "chest"
    | "ribs"
    | "lower_back"
    | "left_hip"
    | "right_hip"
    | "left_hamstring"
    | "right_hamstring"
    | "left_knee"
    | "right_knee"
    | "left_shin"
    | "right_shin"
    | "left_ankle"
    | "right_ankle";

export interface MedicalDocument {
    id: string;
    title: string;
    kind: "imaging" | "lab" | "report" | "referral";
    date: ISODate;
    authorName: string;
    summary: string;
}

export interface MedicalRecord {
    id: string;
    fighterId: string;
    primaryDoctorId: string;
    bloodType: string;
    allergies: string[];
    chronicConditions: string[];
    medications: string[];
    surgicalHistory: { year: number; procedure: string }[];
    emergencyContact: { name: string; relation: string; phone: string };
    lastPhysicalAt: ISODate;
    notes: string;
    documents: MedicalDocument[];
    updatedAt: ISODate;
}

export type ExaminationType = "baseline" | "routine" | "pre_fight" | "post_injury" | "concussion_screen" | "return_to_play";

export type ExaminationOutcome = "fit" | "fit_with_restrictions" | "unfit";

export type AssessmentResult = "normal" | "abnormal" | "inconclusive";

export interface Vitals {
    weightKg: number;
    restingHeartRate: number;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    temperatureC: number;
    spo2Pct: number;
    hydration: "good" | "fair" | "poor";
}

export interface ExaminationAssessment {
    area: string;
    result: AssessmentResult;
    note: string;
}

export interface MedicalExamination {
    id: string;
    fighterId: string;
    doctorId: string;
    date: ISODate;
    type: ExaminationType;
    vitals: Vitals;
    assessments: ExaminationAssessment[];
    outcome: ExaminationOutcome;
    summary: string;
    recommendations: string;
    followUpDate: ISODate | null;
}

export type InjuryType =
    | "concussion"
    | "strain"
    | "sprain"
    | "contusion"
    | "laceration"
    | "fracture"
    | "tendinopathy"
    | "impingement";

export type InjurySeverity = "minor" | "moderate" | "severe";

export type InjuryStatus = "active" | "recovering" | "resolved";

export type InjuryMechanism = "sparring" | "pad_work" | "heavy_bag" | "grappling" | "strength_conditioning" | "competition" | "outside_training";

export interface Injury {
    id: string;
    fighterId: string;
    recordedById: string;
    type: InjuryType;
    bodyRegion: BodyRegion;
    severity: InjurySeverity;
    status: InjuryStatus;
    mechanism: InjuryMechanism;
    occurredAt: ISODate;
    diagnosedAt: ISODate;
    description: string;
    expectedReturnAt: ISODate | null;
    resolvedAt: ISODate | null;
    linkedAlertId: string | null;
}

export type TreatmentType =
    | "rest"
    | "ice_compression"
    | "physiotherapy"
    | "manual_therapy"
    | "medication"
    | "imaging"
    | "strength_rehab"
    | "specialist_referral"
    | "immobilisation";

export type TreatmentStatus = "planned" | "ongoing" | "completed";

export interface Treatment {
    id: string;
    injuryId: string;
    fighterId: string;
    providerName: string;
    type: TreatmentType;
    description: string;
    frequency: string;
    startDate: ISODate;
    endDate: ISODate | null;
    status: TreatmentStatus;
    notes: string | null;
}

export type RecoveryPhaseStatus = "completed" | "current" | "upcoming";

export interface RecoveryPhase {
    id: string;
    name: string;
    goal: string;
    startDate: ISODate;
    endDate: ISODate;
    status: RecoveryPhaseStatus;
    milestones: { label: string; done: boolean }[];
}

export interface RecoveryCheckIn {
    date: ISODate;
    /** Reported pain, 0–10. */
    painLevel: number;
    /** Range of motion vs. healthy side, 0–100. */
    mobilityPct: number;
    /** Strength vs. healthy side, 0–100. */
    strengthPct: number;
    note: string;
}

export type RecoveryPlanStatus = "active" | "paused" | "completed";

export interface RecoveryPlan {
    id: string;
    injuryId: string;
    fighterId: string;
    doctorId: string;
    title: string;
    startDate: ISODate;
    targetReturnDate: ISODate;
    status: RecoveryPlanStatus;
    phases: RecoveryPhase[];
    checkIns: RecoveryCheckIn[];
}

export type ClearanceLevel = "full" | "restricted" | "not_cleared";

export type ClearanceStatus = "active" | "expired" | "revoked" | "superseded";

export interface TrainingRestriction {
    id: string;
    label: string;
    blockedTrainingTypes: TrainingType[];
    blockedTechniques: Technique[];
    blockedRegions: BodyRegion[];
    /** Maximum allowed session RPE, if capped. */
    maxRpe: number | null;
}

export interface MedicalClearance {
    id: string;
    fighterId: string;
    doctorId: string;
    level: ClearanceLevel;
    status: ClearanceStatus;
    issuedAt: ISODate;
    validUntil: ISODate | null;
    reason: string;
    restrictions: TrainingRestriction[];
    examinationId: string | null;
    revokedAt: ISODate | null;
    revokedReason: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Platform
 * ──────────────────────────────────────────────────────────────────────────── */

export type NotificationCategory =
    | "training"
    | "ai_analysis"
    | "ai_alert"
    | "feedback"
    | "medical"
    | "clearance"
    | "goal"
    | "system";

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface Notification {
    id: string;
    userId: string;
    category: NotificationCategory;
    severity: NotificationSeverity;
    title: string;
    body: string;
    href: string | null;
    createdAt: ISODate;
    readAt: ISODate | null;
}

export type BroadcastStatus = "draft" | "scheduled" | "sent";

export type BroadcastChannel = "in_app" | "email" | "in_app_email";

export interface NotificationBroadcast {
    id: string;
    title: string;
    body: string;
    audience: Role[];
    channel: BroadcastChannel;
    status: BroadcastStatus;
    scheduledFor: ISODate | null;
    sentAt: ISODate | null;
    recipientCount: number;
    createdById: string;
    createdAt: ISODate;
}

export type AuditResourceType =
    | "auth"
    | "user"
    | "role"
    | "fighter"
    | "training_plan"
    | "training_session"
    | "goal"
    | "video"
    | "ai_job"
    | "ai_model"
    | "ai_finding"
    | "ai_alert"
    | "medical_record"
    | "examination"
    | "injury"
    | "treatment"
    | "recovery_plan"
    | "clearance"
    | "notification"
    | "settings";

export interface AuditLog {
    id: string;
    actorId: string | null;
    actorName: string;
    actorRole: Role | "system";
    action: string;
    resourceType: AuditResourceType;
    resourceId: string;
    resourceLabel: string;
    timestamp: ISODate;
    ipAddress: string;
    status: "success" | "failure";
    details: string | null;
}

export interface SystemSettings {
    organizationName: string;
    timezone: string;
    sessionTimeoutMin: number;
    requireMfa: boolean;
    videoMaxSizeMb: number;
    videoRetentionDays: number;
    allowedVideoFormats: string[];
    aiConfidenceThreshold: number;
    aiLowConfidenceThreshold: number;
    abnormalMovementAlertsEnabled: boolean;
    notifyDoctorOnAlert: boolean;
    clearanceExpiryWarningDays: number;
}
