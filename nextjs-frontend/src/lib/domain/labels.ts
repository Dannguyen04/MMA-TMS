import type {
    BoutMethod,
    BoutPhase,
    BoutResult,
    BoutSport,
    CancelReason,
    HydrationCheck,
    LossOfConsciousness,
    NutritionPhaseKey,
    RequirementState,
    SuspensionReason,
} from "./bout";
import type { Gate1Reason } from "./bout-rules";
import type { SuspensionState } from "./bout-suspension-rules";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

import { EXAMINATION_SCOPE_LABELS, type SessionType } from "./medical-contract";
import { TRAINING_TYPE_FOR } from "./training-contract";
import type { PlanAdherence, WeightStatus } from "./weight-chart";
import type {
    AIJobStatus,
    Injury,
    MedicalExamination,
    Treatment,
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
    fighter: "Võ sĩ",
    coach: "HLV",
    doctor: "Bác sĩ thể thao",
    admin: "Quản trị viên",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
    active: "Đang điều trị",
    invited: "Đã mời",
    suspended: "Bị đình chỉ",
};

export const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
    strawweight: "Hạng rơm",
    flyweight: "Hạng ruồi",
    bantamweight: "Hạng gà",
    featherweight: "Hạng lông",
    lightweight: "Hạng nhẹ",
    welterweight: "Hạng bán trung",
    middleweight: "Hạng trung",
    light_heavyweight: "Hạng dưới nặng",
    heavyweight: "Hạng nặng",
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
    orthodox: "Thuận tay phải",
    southpaw: "Thuận tay trái",
    switch: "Đổi thế",
};

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
    amateur: "Nghiệp dư",
    semi_pro: "Bán chuyên",
    professional: "Chuyên nghiệp",
    elite: "Tinh hoa",
};

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
    healthy: "Khỏe mạnh",
    monitoring: "Theo dõi",
    injured: "Chấn thương",
    recovery: "Phục hồi",
    not_cleared: "Không đủ điều kiện tập",
};

export const HEALTH_STATUS_DESCRIPTIONS: Record<HealthStatus, string> = {
    healthy: "Không có vấn đề sức khỏe.",
    monitoring: "Đang theo dõi — chưa xác định chấn thương.",
    injured: "Đang có chấn thương được y tế quản lý.",
    recovery: "Đang trở lại sau chấn thương theo kế hoạch phục hồi.",
    not_cleared: "Không được tập cho đến khi bác sĩ cấp phép.",
};

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
    shadow_boxing: "Đánh gió",
    pad_work: "Đánh đích",
    heavy_bag: "Đánh bao",
    sparring: "Đấu tập",
    technical_drilling: "Tập kỹ thuật",
    grappling: "Vật",
    strength_conditioning: "Sức mạnh & thể lực",
    recovery_mobility: "Hồi phục & linh hoạt",
};

export const VIDEO_TRAINING_TYPES: VideoTrainingType[] = ["shadow_boxing", "pad_work", "heavy_bag", "sparring"];

export const VIDEO_TRAINING_TYPE_HINTS: Record<VideoTrainingType, string> = {
    shadow_boxing: "Tập kỹ thuật và di chuyển một mình. Phù hợp phân tích tư thế và thế thủ.",
    pad_work: "Ra đòn vào đích của HLV. Bổ sung phân tích cự ly và độ chính xác.",
    heavy_bag: "Lực và khối lượng đòn vào bao. Bổ sung chỉ số tốc độ và sức bền.",
    sparring: "Hiệp đấu thật với bạn tập. Theo dõi cả hai võ sĩ; độ tin cậy có thể thấp hơn.",
};

export const TECHNIQUES: Technique[] = ["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"];

export const STRIKE_TYPES: StrikeType[] = ["punch", "jab", "cross", "hook", "kick"];

export const TECHNIQUE_LABELS: Record<Technique | StrikeType, string> = {
    punch: "Đấm (chưa phân loại)",
    jab: "Đấm thẳng tay trước",
    cross: "Đấm thẳng tay sau",
    hook: "Đấm móc",
    kick: "Đá",
    combination: "Tổ hợp đòn",
    footwork: "Bộ pháp",
    guard: "Thế thủ",
    head_movement: "Né đầu",
};

export const LIMB_LABELS: Record<Limb, string> = {
    left_arm: "Tay trái",
    right_arm: "Tay phải",
    left_leg: "Chân trái",
    right_leg: "Chân phải",
};

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
    striking: "Đòn đánh",
    defense: "Phòng thủ",
    footwork: "Bộ pháp",
    grappling: "Vật",
    conditioning: "Thể lực",
    strength: "Sức mạnh",
    mobility: "Vận động",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
    low: "Thấp",
    moderate: "Trung bình",
    high: "Cao",
};

export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
    base: "Nền tảng",
    build: "Tăng tải",
    fight_camp: "Fight Camp",
    taper: "Giảm tải",
    rehab: "Phục hồi chức năng",
    maintenance: "Duy trì",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
    draft: "Nháp",
    active: "Đang điều trị",
    completed: "Hoàn tất",
    archived: "Lưu trữ",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
    scheduled: "Đã lên lịch",
    in_progress: "Đang thực hiện",
    pending: "Cần dời lịch",
    completed: "Hoàn tất",
    missed: "Bỏ lỡ",
    cancelled: "Đã hủy",
};

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
    praise: "Khen ngợi",
    correction: "Đính chính",
    note: "Ghi chú",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
    on_track: "Đúng tiến độ",
    at_risk: "Có rủi ro",
    achieved: "Đã đạt",
    missed: "Bỏ lỡ",
};

export const CAMERA_ANGLE_LABELS: Record<CameraAngle, string> = {
    front: "Chính diện",
    side: "Bên hông",
    diagonal: "Chéo 45°",
};

export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
    uploading: "Đang tải lên",
    queued: "Đang chờ",
    processing: "AI đang xử lý",
    completed: "AI đã xong",
    failed: "AI lỗi",
};

export const AI_JOB_STATUS_LABELS: Record<AIJobStatus, string> = {
    queued: "Đang chờ",
    processing: "Đang xử lý",
    completed: "Hoàn tất",
    failed: "Lỗi",
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
    queued: "Đang chờ trong hàng đợi",
    decoding: "Đang giải mã Video",
    fighter_detection: "Đang nhận diện võ sĩ",
    tracking: "Đang theo dõi võ sĩ",
    pose_estimation: "Đang ước tính điểm khung xương",
    action_recognition: "Đang nhận dạng đòn",
    metrics: "Đang tính chỉ số thành tích",
    findings: "Đang tạo kết quả",
    done: "Phân tích xong",
};

export const MOVEMENT_EVENT_LABELS: Record<MovementEventType, string> = {
    guard_drop: "Hạ thế thủ",
    slip: "Lách đầu",
    roll: "Lắc người",
    pivot: "Xoay trụ",
    step_in: "Bước vào",
    step_out: "Bước ra",
    lateral_step: "Bước ngang",
    tracking_lost: "Mất theo dõi",
};

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
    ...TECHNIQUE_LABELS,
    movement_quality: "Chất lượng chuyển động",
};

export const FINDING_IMPACT_LABELS: Record<FindingImpact, string> = {
    strength: "Sức mạnh",
    improvement: "Điểm cần cải thiện",
    concern: "Điểm đáng lo ngại",
};

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
    confirmed: "Đã xác nhận",
    corrected: "Đã sửa",
    rejected: "Đã từ chối",
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
    ai_generated: "Do AI tạo",
    needs_review: "Cần xem lại",
    coach_approved: "HLV đã duyệt",
    coach_corrected: "HLV đã sửa",
    coach_rejected: "HLV đã từ chối",
    insufficient_evidence: "Chưa đủ căn cứ",
    shadow: "Ứng viên mô hình thử",
    not_validated: "Chưa kiểm định",
};

export const COACHING_FINDING_STATE_STYLES: Record<
    CoachingFindingState,
    { badgeColor: string; textColor: string; description: string }
> = {
    ai_generated: {
        badgeColor: "bg-blue-100 dark:bg-blue-900/40",
        textColor: "text-blue-800 dark:text-blue-300",
        description: "Do mô hình AI tạo; đang chờ HLV xác nhận.",
    },
    needs_review: {
        badgeColor: "bg-amber-100 dark:bg-amber-900/40",
        textColor: "text-amber-800 dark:text-amber-300",
        description: "Được đánh dấu để HLV ưu tiên xem.",
    },
    coach_approved: {
        badgeColor: "bg-green-100 dark:bg-green-900/40",
        textColor: "text-green-800 dark:text-green-300",
        description: "HLV đã kiểm tra và chấp nhận.",
    },
    coach_corrected: {
        badgeColor: "bg-purple-100 dark:bg-purple-900/40",
        textColor: "text-purple-800 dark:text-purple-300",
        description: "HLV đã sửa bằng bản thay thế.",
    },
    coach_rejected: {
        badgeColor: "bg-red-100 dark:bg-red-900/40",
        textColor: "text-red-800 dark:text-red-300",
        description: "HLV bỏ qua vì nhận dạng sai hoặc động tác không hợp lệ.",
    },
    insufficient_evidence: {
        badgeColor: "bg-zinc-100 dark:bg-zinc-800",
        textColor: "text-zinc-700 dark:text-zinc-300",
        description: "Không đủ dữ liệu camera hoặc khung xương để đánh giá.",
    },
    shadow: {
        badgeColor: "bg-indigo-100 dark:bg-indigo-900/40",
        textColor: "text-indigo-800 dark:text-indigo-300",
        description: "Nhận dạng của mô hình thử; chỉ để tham khảo.",
    },
    not_validated: {
        badgeColor: "bg-yellow-100 dark:bg-yellow-900/40",
        textColor: "text-yellow-800 dark:text-yellow-300",
        description: "Nhận dạng kỹ thuật chưa qua kiểm định chuẩn.",
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
    new: "Mới",
    acknowledged: "Đã xác nhận",
    follow_up: "Đã hẹn theo dõi",
    dismissed: "Đã bỏ qua",
};

export const AI_MODEL_TASK_LABELS: Record<AIModelTask, string> = {
    fighter_detection: "Nhận diện võ sĩ",
    pose_estimation: "Ước tính tư thế",
    action_recognition: "Nhận dạng động tác",
    anomaly_detection: "Phát hiện chuyển động bất thường",
};

export const AI_MODEL_STATUS_LABELS: Record<AIModelStatus, string> = {
    active: "Đang điều trị",
    staging: "Thử nghiệm",
    deprecated: "Ngừng dùng",
};

export const BODY_REGION_LABELS: Record<BodyRegion, string> = {
    head: "Đầu",
    neck: "Cổ",
    left_shoulder: "Vai trái",
    right_shoulder: "Vai phải",
    left_elbow: "Khuỷu tay trái",
    right_elbow: "Khuỷu tay phải",
    left_hand: "Bàn tay trái",
    right_hand: "Bàn tay phải",
    chest: "Ngực",
    ribs: "Xương sườn",
    lower_back: "Thắt lưng",
    left_hip: "Hông trái",
    right_hip: "Hông phải",
    left_hamstring: "Cơ đùi sau trái",
    right_hamstring: "Cơ đùi sau phải",
    left_knee: "Gối trái",
    right_knee: "Gối phải",
    left_shin: "Cẳng chân trái",
    right_shin: "Cẳng chân phải",
    left_ankle: "Cổ chân trái",
    right_ankle: "Cổ chân phải",
};

export const EXAMINATION_TYPE_LABELS: Record<ExaminationType, string> = {
    baseline: "Khám nền",
    routine: "Khám định kỳ",
    pre_fight: "Khám trước trận",
    post_injury: "Đánh giá sau chấn thương",
    concussion_screen: "Tầm soát chấn động",
    return_to_play: "Đánh giá trở lại tập",
};

/**
 * Examination areas the mobile app stores under English names (reactnative-mobile baseline-payload BASELINE_AREAS),
 * plus common clinical areas, shown in Vietnamese. Any other area is a doctor's own wording and shown as written.
 */
const ASSESSMENT_AREA_VI: Record<string, string> = {
    cardiovascular: "Tim mạch",
    respiratory: "Hô hấp",
    neurological: "Thần kinh",
    "neurological screen": "Sàng lọc thần kinh",
    musculoskeletal: "Cơ xương khớp",
    "musculoskeletal screen": "Sàng lọc cơ xương khớp",
    vision: "Thị lực",
    "eye screen": "Sàng lọc mắt",
    "range of motion": "Biên độ vận động",
    strength: "Sức mạnh",
    "special tests": "Nghiệm pháp đặc hiệu",
    "weight & hydration": "Cân nặng & mức nước",
    "weight check": "Kiểm tra cân nặng",
    "infectious disease screen": "Sàng lọc bệnh truyền nhiễm",
    head: "Đầu",
    neck: "Cổ",
    skin: "Da",
};

export function assessmentAreaLabel(area: string): string {
    return ASSESSMENT_AREA_VI[area.trim().toLowerCase()] ?? area;
}

export const EXAMINATION_OUTCOME_LABELS: Record<ExaminationOutcome, string> = {
    fit: "Đủ điều kiện tập",
    fit_with_restrictions: "Đủ điều kiện có hạn chế",
    unfit: "Không đủ điều kiện tập",
};

export const ASSESSMENT_RESULT_LABELS: Record<AssessmentResult, string> = {
    normal: "Bình thường",
    abnormal: "Bất thường",
    inconclusive: "Chưa kết luận",
};

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
    concussion: "Chấn động não",
    strain: "Căng cơ",
    sprain: "Bong gân dây chằng",
    contusion: "Đụng dập",
    laceration: "Rách da",
    fracture: "Gãy xương",
    tendinopathy: "Bệnh lý gân",
    impingement: "Hội chứng chèn ép",
};

export const INJURY_SEVERITY_LABELS: Record<InjurySeverity, string> = {
    minor: "Nhẹ",
    moderate: "Trung bình",
    severe: "Nặng",
    critical: "Nguy kịch",
};

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
    active: "Đang điều trị",
    recovering: "Đang phục hồi",
    resolved: "Đã khỏi",
};

export const INJURY_MECHANISM_LABELS: Record<InjuryMechanism, string> = {
    sparring: "Đấu tập",
    pad_work: "Đánh đích",
    heavy_bag: "Đánh bao",
    grappling: "Vật",
    strength_conditioning: "Sức mạnh & thể lực",
    competition: "Thi đấu",
    outside_training: "Ngoài giờ tập",
};

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
    rest: "Nghỉ tương đối",
    ice_compression: "Chườm lạnh & băng ép",
    physiotherapy: "Vật lý trị liệu",
    manual_therapy: "Trị liệu bằng tay",
    medication: "Dùng thuốc",
    imaging: "Chẩn đoán hình ảnh",
    strength_rehab: "Phục hồi sức mạnh",
    specialist_referral: "Chuyển chuyên khoa",
    immobilisation: "Bất động",
};

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
    planned: "Dự kiến",
    ongoing: "Đang diễn ra",
    completed: "Hoàn tất",
};

export const RECOVERY_PLAN_STATUS_LABELS: Record<RecoveryPlanStatus, string> = {
    active: "Đang điều trị",
    paused: "Tạm dừng",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
};

export const CLEARANCE_LEVEL_LABELS: Record<ClearanceLevel, string> = {
    full: "Được tập",
    restricted: "Được tập có hạn chế",
    not_cleared: "Chưa được tập",
};

export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
    active: "Đang điều trị",
    expired: "Hết hạn",
    revoked: "Đã thu hồi",
    superseded: "Đã thay thế",
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
    admission: "Tuyển sinh",
    training: "Tập luyện",
    ai_analysis: "Phân tích AI",
    ai_alert: "Cảnh báo AI",
    feedback: "Nhận xét của HLV",
    medical: "Y tế",
    clearance: "Giấy phép",
    goal: "Mục tiêu",
    system: "Hệ thống",
};

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
    draft: "Nháp",
    scheduled: "Đã lên lịch",
    sent: "Đã gửi",
};

export const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = {
    in_app: "Trong ứng dụng",
    email: "Email",
    in_app_email: "Trong ứng dụng + Email",
};

/* ─── Fight camp ──────────────────────────────────────────────────────────── */

export const WEIGHT_STATUS_LABELS: Record<WeightStatus, string> = {
    ON_TRACK: "On track",
    ABOVE_TARGET: "Above tolerance",
    OVER_LIMIT: "Exceeds cut limit",
    NOT_WEIGHED: "No recent weigh-in",
    NEUTRAL: "Not judged",
};

export const PLAN_ADHERENCE_LABELS: Record<PlanAdherence, string> = {
    ON_PLAN: "On plan",
    SLIGHTLY_OFF: "Slightly off",
    WAY_OFF: "Way off",
};

export const NUTRITION_PHASE_LABELS: Record<NutritionPhaseKey, string> = {
    camp: "Camp",
    fightWeek: "Fight week",
    postWeighIn: "After the official weigh-in",
};

export const BOUT_PHASE_LABELS: Record<BoutPhase, string> = {
    SCHEDULED: "Scheduled",
    CAMP: "Camp",
    FIGHT_WEEK: "Fight week",
    WEIGHED_IN: "Weighed in",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
};

export const BOUT_SPORT_LABELS: Record<BoutSport, string> = {
    BOXING: "Boxing",
    MUAY_THAI: "Muay Thai",
    KICKBOXING: "Kickboxing",
    MMA: "MMA",
};

export const REQUIREMENT_STATE_LABELS: Record<RequirementState, string> = {
    MISSING: "Missing",
    PROVIDED: "Provided",
    CONFIRMED: "Confirmed",
    REJECTED: "Rejected",
};

export const GATE1_REASON_LABELS: Record<Gate1Reason, string> = {
    MISSING: "missing",
    EXPIRED: "expires before the bout",
    REJECTED: "rejected",
};

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
    OPPONENT_WITHDREW: "Opponent withdrew",
    INJURY: "Injury",
    MISSED_WEIGHT: "Missed weight",
    DOCUMENTS: "Documents",
    ORGANISER_CANCELLED: "Organiser cancelled",
    OTHER: "Other",
};

export const HYDRATION_CHECK_LABELS: Record<HydrationCheck, string> = {
    NOT_APPLICABLE: "Not applicable",
    PASSED: "Passed",
    FAILED: "Failed",
};

export const BOUT_RESULT_LABELS: Record<BoutResult, string> = {
    WIN: "Win",
    LOSS: "Loss",
    DRAW: "Draw",
    NO_CONTEST: "No contest",
};

export const BOUT_METHOD_LABELS: Record<BoutMethod, string> = {
    KO: "KO",
    TKO: "TKO",
    DECISION: "Decision",
    SUBMISSION: "Submission",
    DQ: "Disqualification",
    OTHER: "Other",
};

export const LOSS_OF_CONSCIOUSNESS_LABELS: Record<LossOfConsciousness, string> = {
    NONE: "No",
    UNDER_1_MIN: "Under 1 minute",
    OVER_1_MIN: "Over 1 minute",
    UNKNOWN: "Not known",
};

export const SUSPENSION_REASON_LABELS: Record<SuspensionReason, string> = {
    KO: "KO",
    TKO: "TKO",
    DQ: "Disqualification",
    MANDATORY_REST: "Mandatory rest",
    MEDICAL: "Medical",
    OTHER: "Other",
};

export const SUSPENSION_STATE_LABELS: Record<SuspensionState, string> = {
    UPCOMING: "Starts later",
    ACTIVE: "Suspended",
    AWAITING_CLEARANCE: "Awaiting clearance",
    ENDED: "Ended",
    CLEARED: "Cleared to train",
};
export function weightClassLabel(weightClass: WeightClass, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`weightClass.${weightClass}`);
    return WEIGHT_CLASS_LABELS[weightClass];
}

/**
 * The weight class as a fighter's profile shows it: in Vietnamese the English name the sport uses
 * follows in brackets ("Hạng gà (Bantamweight)"); badges and tables use `weightClassLabel`.
 */
export function weightClassFullLabel(weightClass: WeightClass, locale: Locale): string {
    const label = weightClassLabel(weightClass, locale);
    return locale === "vi" ? `${label} (${WEIGHT_CLASS_LABELS[weightClass]})` : label;
}

export function stanceLabel(stance: Stance, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`stance.${stance}`);
    return STANCE_LABELS[stance];
}

export function trainingLevelLabel(level: TrainingLevel, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`trainingLevel.${level}`);
    return TRAINING_LEVEL_LABELS[level];
}

export function healthStatusLabel(status: HealthStatus, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`healthStatus.${status}`);
    return HEALTH_STATUS_LABELS[status];
}

export function healthStatusDescription(status: HealthStatus, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`healthStatusDesc.${status}`);
    return HEALTH_STATUS_DESCRIPTIONS[status];
}

export function clearanceLevelLabel(level: ClearanceLevel, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`clearanceLevel.${level}`);
    return CLEARANCE_LEVEL_LABELS[level];
}

export function clearanceStatusLabel(status: ClearanceStatus, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`clearanceStatus.${status}`);
    return CLEARANCE_STATUS_LABELS[status];
}

export function injuryTypeLabel(type: InjuryType, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`injuryType.${type}`);
    return INJURY_TYPE_LABELS[type];
}

export function injurySeverityLabel(severity: InjurySeverity, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`injurySeverity.${severity}`);
    return INJURY_SEVERITY_LABELS[severity];
}

export function injuryStatusLabel(status: InjuryStatus, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`injuryStatus.${status}`);
    return INJURY_STATUS_LABELS[status];
}

export function injuryMechanismLabel(mechanism: InjuryMechanism, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`injuryMechanism.${mechanism}`);
    return INJURY_MECHANISM_LABELS[mechanism];
}

export function bodyRegionLabel(region: BodyRegion, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`bodyRegion.${region}`);
    return BODY_REGION_LABELS[region];
}

export function recoveryPlanStatusLabel(status: RecoveryPlanStatus, locale?: Locale): string {
    if (locale) return createTranslator(locale)(`recoveryPlanStatus.${status}`);
    return RECOVERY_PLAN_STATUS_LABELS[status];
}


/* ─── Display titles for records the medical service describes in free text ── */

/** "Routine check", or the decision's scope for a medical-service examination ("Training examination"). */
export function examinationTitle(examination: Pick<MedicalExamination, "type" | "scope">, locale?: Locale): string {
    if (locale) {
        const t = createTranslator(locale);
        if (examination.type) return t(`examinationType.${examination.type}`);
        return examination.scope ? t("health.examinationScopeSuffix", { scope: EXAMINATION_SCOPE_LABELS[examination.scope] }) : t("health.examinationFallback");
    }
    if (examination.type) return EXAMINATION_TYPE_LABELS[examination.type];
    return examination.scope ? `Phiếu khám ${EXAMINATION_SCOPE_LABELS[examination.scope].toLowerCase()}` : "Phiếu khám";
}

/** "Strain", or the injury type as the doctor wrote it. */
export function injuryTypeName(injury: Pick<Injury, "type" | "typeLabel">, locale?: Locale): string {
    if (injury.type) return injuryTypeLabel(injury.type, locale);
    return injury.typeLabel?.trim() || (locale ? createTranslator(locale)("health.injuryFallback") : "Chấn thương");
}

/** "Physiotherapy", or the treatment as the doctor wrote it. */
export function treatmentTitle(treatment: Pick<Treatment, "type" | "typeLabel">): string {
    if (treatment.type) return TREATMENT_TYPE_LABELS[treatment.type];
    return treatment.typeLabel?.trim() || "Điều trị";
}


/* ─── Training enum label helpers (T-015) ─────────────────────────────────── */

export function trainingTypeLabel(t: Translator, type: TrainingType): string {
    return t(`trainingType.${type}` as MessageKey);
}

/**
 * Label for one of the training service's session types. Recovery and physical therapy share an interface training
 * type, so they get their own labels; the rest read as their training type.
 */
export function sessionTypeLabel(t: Translator, type: SessionType): string {
    if (type === "RECOVERY") return t("sessionType.RECOVERY");
    if (type === "PHYSICAL_THERAPY") return t("sessionType.PHYSICAL_THERAPY");
    return trainingTypeLabel(t, TRAINING_TYPE_FOR[type]);
}

export function techniqueLabel(t: Translator, technique: Technique | StrikeType): string {
    return t(`technique.${technique}` as MessageKey);
}

export function exerciseCategoryLabel(t: Translator, category: ExerciseCategory): string {
    return t(`exerciseCategory.${category}` as MessageKey);
}

export function intensityLabel(t: Translator, intensity: Intensity): string {
    return t(`intensity.${intensity}` as MessageKey);
}

export function trainingPhaseLabel(t: Translator, phase: TrainingPhase): string {
    return t(`trainingPhase.${phase}` as MessageKey);
}

export function planStatusLabel(t: Translator, status: PlanStatus): string {
    return t(`planStatus.${status}` as MessageKey);
}

export function sessionStatusLabel(t: Translator, status: SessionStatus): string {
    return t(`sessionStatus.${status}` as MessageKey);
}

export function feedbackKindLabel(t: Translator, kind: FeedbackKind): string {
    return t(`feedbackKind.${kind}` as MessageKey);
}
