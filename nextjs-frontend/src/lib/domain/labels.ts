import type {
    AIJobStatus,
    AIModelStatus,
    AIModelTask,
    AlertStatus,
    AssessmentResult,
    BodyRegion,
    BroadcastChannel,
    BroadcastStatus,
    CameraAngle,
    ClearanceLevel,
    ClearanceStatus,
    ExaminationOutcome,
    ExaminationType,
    ExerciseCategory,
    FeedbackKind,
    FindingCategory,
    FindingImpact,
    GoalStatus,
    HealthStatus,
    InjuryMechanism,
    InjurySeverity,
    InjuryStatus,
    InjuryType,
    Intensity,
    Limb,
    MovementEventType,
    NotificationCategory,
    PipelineStage,
    PlanStatus,
    RecoveryPlanStatus,
    ReviewDecision,
    Role,
    SessionStatus,
    Stance,
    StrikeType,
    Technique,
    TrainingLevel,
    TrainingPhase,
    TrainingType,
    TreatmentStatus,
    TreatmentType,
    UserStatus,
    VideoStatus,
    VideoTrainingType,
    WeightClass,
} from "./types";

/** Human-readable labels for every domain enum. Single source of truth for UI copy. */

export const ROLE_LABELS: Record<Role, string> = {
    fighter: "Fighter",
    coach: "Coach",
    doctor: "Sports doctor",
    admin: "Administrator",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
    active: "Active",
    invited: "Invited",
    suspended: "Suspended",
};

export const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
    strawweight: "Strawweight",
    flyweight: "Flyweight",
    bantamweight: "Bantamweight",
    featherweight: "Featherweight",
    lightweight: "Lightweight",
    welterweight: "Welterweight",
    middleweight: "Middleweight",
    light_heavyweight: "Light heavyweight",
    heavyweight: "Heavyweight",
};

/** Upper limit of each weight class in kg (non-title bouts). */
export const WEIGHT_CLASS_LIMIT_KG: Record<WeightClass, number> = {
    strawweight: 52.2,
    flyweight: 56.7,
    bantamweight: 61.2,
    featherweight: 65.8,
    lightweight: 70.3,
    welterweight: 77.1,
    middleweight: 83.9,
    light_heavyweight: 93.0,
    heavyweight: 120.2,
};

export const WEIGHT_CLASS_ORDER: WeightClass[] = [
    "strawweight",
    "flyweight",
    "bantamweight",
    "featherweight",
    "lightweight",
    "welterweight",
    "middleweight",
    "light_heavyweight",
    "heavyweight",
];

export const STANCE_LABELS: Record<Stance, string> = {
    orthodox: "Orthodox",
    southpaw: "Southpaw",
    switch: "Switch",
};

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
    amateur: "Amateur",
    semi_pro: "Semi-pro",
    professional: "Professional",
    elite: "Elite",
};

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
    healthy: "Healthy",
    monitoring: "Monitoring",
    injured: "Injured",
    recovery: "Recovery",
    not_cleared: "Unfit to train",
};

export const HEALTH_STATUS_DESCRIPTIONS: Record<HealthStatus, string> = {
    healthy: "No active health concerns.",
    monitoring: "Under observation — no confirmed injury.",
    injured: "Active injury under medical management.",
    recovery: "Returning from injury on a recovery plan.",
    not_cleared: "Must not train until a doctor clears them.",
};

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
    shadow_boxing: "Shadow boxing",
    pad_work: "Pad work",
    heavy_bag: "Heavy bag",
    sparring: "Sparring",
    technical_drilling: "Technical drilling",
    grappling: "Grappling",
    strength_conditioning: "Strength & conditioning",
    recovery_mobility: "Recovery & mobility",
};

export const VIDEO_TRAINING_TYPES: VideoTrainingType[] = ["shadow_boxing", "pad_work", "heavy_bag", "sparring"];

export const VIDEO_TRAINING_TYPE_HINTS: Record<VideoTrainingType, string> = {
    shadow_boxing: "Solo technique and movement. Best for form and guard analysis.",
    pad_work: "Strikes on a coach's pads. Adds distance and accuracy to the analysis.",
    heavy_bag: "Power and volume on the bag. Adds speed and endurance metrics.",
    sparring: "Live rounds with a partner. Tracks both fighters; confidence may be lower.",
};

export const TECHNIQUES: Technique[] = ["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"];

export const STRIKE_TYPES: StrikeType[] = ["jab", "cross", "hook", "kick"];

export const TECHNIQUE_LABELS: Record<Technique, string> = {
    jab: "Jab",
    cross: "Cross",
    hook: "Hook",
    kick: "Kick",
    combination: "Combination",
    footwork: "Footwork",
    guard: "Guard",
    head_movement: "Head movement",
};

export const LIMB_LABELS: Record<Limb, string> = {
    left_arm: "Left arm",
    right_arm: "Right arm",
    left_leg: "Left leg",
    right_leg: "Right leg",
};

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
    striking: "Striking",
    defense: "Defense",
    footwork: "Footwork",
    grappling: "Grappling",
    conditioning: "Conditioning",
    strength: "Strength",
    mobility: "Mobility",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
};

export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
    base: "Base",
    build: "Build",
    fight_camp: "Fight camp",
    taper: "Taper",
    rehab: "Rehab",
    maintenance: "Maintenance",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    archived: "Archived",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
    missed: "Missed",
    cancelled: "Cancelled",
};

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
    praise: "Praise",
    correction: "Correction",
    note: "Note",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
    on_track: "On track",
    at_risk: "At risk",
    achieved: "Achieved",
    missed: "Missed",
};

export const CAMERA_ANGLE_LABELS: Record<CameraAngle, string> = {
    front: "Front",
    side: "Side",
    diagonal: "45° diagonal",
};

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
    uploading: "Uploading",
    queued: "Queued",
    processing: "AI processing",
    completed: "AI completed",
    failed: "AI failed",
};

export const AI_JOB_STATUS_LABELS: Record<AIJobStatus, string> = {
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
};

export const PIPELINE_STAGES: PipelineStage[] = [
    "queued",
    "decoding",
    "fighter_detection",
    "tracking",
    "pose_estimation",
    "action_recognition",
    "metrics",
    "findings",
    "done",
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
    queued: "Waiting in queue",
    decoding: "Decoding video",
    fighter_detection: "Detecting fighter",
    tracking: "Tracking fighter",
    pose_estimation: "Estimating pose keypoints",
    action_recognition: "Recognising strikes",
    metrics: "Computing performance metrics",
    findings: "Generating findings",
    done: "Analysis complete",
};

export const MOVEMENT_EVENT_LABELS: Record<MovementEventType, string> = {
    guard_drop: "Guard drop",
    slip: "Slip",
    roll: "Roll",
    pivot: "Pivot",
    step_in: "Step in",
    step_out: "Step out",
    lateral_step: "Lateral step",
    tracking_lost: "Tracking lost",
};

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
    ...TECHNIQUE_LABELS,
    movement_quality: "Movement quality",
};

export const FINDING_IMPACT_LABELS: Record<FindingImpact, string> = {
    strength: "Strength",
    improvement: "Improvement area",
    concern: "Area of concern",
};

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
    confirmed: "Confirmed",
    corrected: "Corrected",
    rejected: "Rejected",
};

export type CoachingFindingState =
    | "ai_generated"
    | "needs_review"
    | "coach_approved"
    | "coach_corrected"
    | "coach_rejected"
    | "insufficient_evidence"
    | "shadow"
    | "not_validated";

export const COACHING_FINDING_STATE_LABELS: Record<CoachingFindingState, string> = {
    ai_generated: "AI Generated",
    needs_review: "Needs Review",
    coach_approved: "Coach Approved",
    coach_corrected: "Coach Corrected",
    coach_rejected: "Coach Rejected",
    insufficient_evidence: "Insufficient Evidence",
    shadow: "Shadow Candidate",
    not_validated: "Not Validated",
};

export const COACHING_FINDING_STATE_STYLES: Record<
    CoachingFindingState,
    { badgeColor: string; textColor: string; description: string }
> = {
    ai_generated: {
        badgeColor: "bg-blue-100 dark:bg-blue-900/40",
        textColor: "text-blue-800 dark:text-blue-300",
        description: "Generated by AI model; awaiting human coach confirmation.",
    },
    needs_review: {
        badgeColor: "bg-amber-100 dark:bg-amber-900/40",
        textColor: "text-amber-800 dark:text-amber-300",
        description: "Flagged for priority coach review.",
    },
    coach_approved: {
        badgeColor: "bg-green-100 dark:bg-green-900/40",
        textColor: "text-green-800 dark:text-green-300",
        description: "Verified and accepted by coach.",
    },
    coach_corrected: {
        badgeColor: "bg-purple-100 dark:bg-purple-900/40",
        textColor: "text-purple-800 dark:text-purple-300",
        description: "Corrected by coach with superseding revision.",
    },
    coach_rejected: {
        badgeColor: "bg-red-100 dark:bg-red-900/40",
        textColor: "text-red-800 dark:text-red-300",
        description: "Dismissed by coach as false detection or invalid form.",
    },
    insufficient_evidence: {
        badgeColor: "bg-zinc-100 dark:bg-zinc-800",
        textColor: "text-zinc-700 dark:text-zinc-300",
        description: "Insufficient camera or pose evidence to assess.",
    },
    shadow: {
        badgeColor: "bg-indigo-100 dark:bg-indigo-900/40",
        textColor: "text-indigo-800 dark:text-indigo-300",
        description: "Shadow model detection; informational only.",
    },
    not_validated: {
        badgeColor: "bg-yellow-100 dark:bg-yellow-900/40",
        textColor: "text-yellow-800 dark:text-yellow-300",
        description: "Technique detection has not completed gold gate validation.",
    },
};

export function resolveFindingState(finding: {
    status?: string;
    reviewStatus?: string;
    isShadow?: boolean;
    validationStatus?: string;
}): CoachingFindingState {
    if (finding.isShadow) return "shadow";
    if (finding.validationStatus === "NOT_VALIDATED" || finding.validationStatus === "SHADOW_NOT_VALIDATED") {
        return "not_validated";
    }
    const s = (finding.reviewStatus || finding.status || "ai_generated").toLowerCase();
    switch (s) {
        case "coach_approved":
        case "confirmed":
        case "approved":
            return "coach_approved";
        case "coach_corrected":
        case "corrected":
            return "coach_corrected";
        case "coach_rejected":
        case "rejected":
            return "coach_rejected";
        case "insufficient_evidence":
            return "insufficient_evidence";
        case "needs_review":
            return "needs_review";
        default:
            return "ai_generated";
    }
}


export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
    new: "New",
    acknowledged: "Acknowledged",
    follow_up: "Follow-up scheduled",
    dismissed: "Dismissed",
};

export const AI_MODEL_TASK_LABELS: Record<AIModelTask, string> = {
    fighter_detection: "Fighter detection",
    pose_estimation: "Pose estimation",
    action_recognition: "Action recognition",
    anomaly_detection: "Abnormal movement detection",
};

export const AI_MODEL_STATUS_LABELS: Record<AIModelStatus, string> = {
    active: "Active",
    staging: "Staging",
    deprecated: "Deprecated",
};

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
    head: "Head",
    neck: "Neck",
    left_shoulder: "Left shoulder",
    right_shoulder: "Right shoulder",
    left_elbow: "Left elbow",
    right_elbow: "Right elbow",
    left_hand: "Left hand",
    right_hand: "Right hand",
    chest: "Chest",
    ribs: "Ribs",
    lower_back: "Lower back",
    left_hip: "Left hip",
    right_hip: "Right hip",
    left_hamstring: "Left hamstring",
    right_hamstring: "Right hamstring",
    left_knee: "Left knee",
    right_knee: "Right knee",
    left_shin: "Left shin",
    right_shin: "Right shin",
    left_ankle: "Left ankle",
    right_ankle: "Right ankle",
};

export const EXAMINATION_TYPE_LABELS: Record<ExaminationType, string> = {
    baseline: "Baseline physical",
    routine: "Routine check",
    pre_fight: "Pre-fight medical",
    post_injury: "Post-injury assessment",
    concussion_screen: "Concussion screening",
    return_to_play: "Return-to-training assessment",
};

export const EXAMINATION_OUTCOME_LABELS: Record<ExaminationOutcome, string> = {
    fit: "Fit to train",
    fit_with_restrictions: "Fit with restrictions",
    unfit: "Unfit to train",
};

export const ASSESSMENT_RESULT_LABELS: Record<AssessmentResult, string> = {
    normal: "Normal",
    abnormal: "Abnormal",
    inconclusive: "Inconclusive",
};

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
    concussion: "Concussion",
    strain: "Muscle strain",
    sprain: "Ligament sprain",
    contusion: "Contusion",
    laceration: "Laceration",
    fracture: "Fracture",
    tendinopathy: "Tendinopathy",
    impingement: "Impingement",
};

export const INJURY_SEVERITY_LABELS: Record<InjurySeverity, string> = {
    minor: "Minor",
    moderate: "Moderate",
    severe: "Severe",
};

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
    active: "Active",
    recovering: "Recovering",
    resolved: "Resolved",
};

export const INJURY_MECHANISM_LABELS: Record<InjuryMechanism, string> = {
    sparring: "Sparring",
    pad_work: "Pad work",
    heavy_bag: "Heavy bag",
    grappling: "Grappling",
    strength_conditioning: "Strength & conditioning",
    competition: "Competition",
    outside_training: "Outside training",
};

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
    rest: "Relative rest",
    ice_compression: "Ice & compression",
    physiotherapy: "Physiotherapy",
    manual_therapy: "Manual therapy",
    medication: "Medication",
    imaging: "Imaging",
    strength_rehab: "Strength rehab",
    specialist_referral: "Specialist referral",
    immobilisation: "Immobilisation",
};

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
    planned: "Planned",
    ongoing: "Ongoing",
    completed: "Completed",
};

export const RECOVERY_PLAN_STATUS_LABELS: Record<RecoveryPlanStatus, string> = {
    active: "Active",
    paused: "Paused",
    completed: "Completed",
};

export const CLEARANCE_LEVEL_LABELS: Record<ClearanceLevel, string> = {
    full: "Cleared",
    restricted: "Cleared with restrictions",
    not_cleared: "Not cleared",
};

export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
    active: "Active",
    expired: "Expired",
    revoked: "Revoked",
    superseded: "Superseded",
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
    training: "Training",
    ai_analysis: "AI analysis",
    ai_alert: "AI alert",
    feedback: "Coach feedback",
    medical: "Medical",
    clearance: "Medical Clearance",
    goal: "Goals",
    system: "System",
};

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    sent: "Sent",
};

export const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = {
    in_app: "In-app",
    email: "Email",
    in_app_email: "In-app + email",
};
