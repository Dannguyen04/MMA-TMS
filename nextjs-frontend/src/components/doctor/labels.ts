import type { BodyJoint, ClearanceType, EligibilityReason, ExaminationDecision, ExaminationScope, MedicalReviewRequest, SessionType, TechniqueType } from "@/lib/domain/medical-contract";
import type { ClearanceState } from "@/lib/domain/rules";
import type {
    AlertStatus,
    BodyRegion,
    ClearanceLevel,
    ExaminationOutcome,
    ExaminationType,
    Fighter,
    HealthStatus,
    InjuryMechanism,
    InjurySeverity,
    InjuryStatus,
    InjuryType,
    MedicalClearance,
    RecoveryPlanStatus,
    Stance,
    TreatmentType,
    WeightClass,
} from "@/lib/domain/types";

/** Nhãn tiếng Việt cho màn hình Bác sĩ. Khoá là giá trị của domain frontend (chữ thường) hoặc của API y tế (chữ hoa). */

export type Tone = "red" | "amber" | "green" | "blue" | "neutral";
export interface Labelled {
    label: string;
    tone: Tone;
}

export const WEIGHT_CLASS: Record<WeightClass, string> = {
    strawweight: "Hạng rơm 52 kg",
    flyweight: "Hạng ruồi 57 kg",
    bantamweight: "Hạng gà 61 kg",
    featherweight: "Hạng lông 66 kg",
    lightweight: "Hạng nhẹ 70 kg",
    welterweight: "Hạng bán trung 77 kg",
    middleweight: "Hạng trung 84 kg",
    light_heavyweight: "Hạng dưới nặng 93 kg",
    heavyweight: "Hạng nặng 120 kg",
};

export const STANCE: Record<Stance, string> = { orthodox: "Thuận tay phải", southpaw: "Thuận tay trái", switch: "Đổi thế" };

export const HEALTH_STATUS: Record<HealthStatus, Labelled> = {
    healthy: { label: "Khỏe mạnh", tone: "green" },
    monitoring: { label: "Theo dõi", tone: "blue" },
    recovery: { label: "Đang phục hồi", tone: "amber" },
    injured: { label: "Chấn thương", tone: "red" },
    not_cleared: { label: "Chưa được tập", tone: "red" },
};

export const ELIGIBILITY_REASON: Record<EligibilityReason, string> = {
    EXAMINATION_REQUIRED: "Cần phiếu khám ban đầu",
    REVIEW_REQUEST_PENDING: "Có yêu cầu xem xét đang mở",
    EXAMINATION_NOT_ELIGIBLE: "Phiếu khám kết luận không đủ điều kiện",
    CLEARANCE_REQUIRED: "Cần cấp giấy phép",
    CLEARANCE_EXPIRED: "Giấy phép đã hết hạn",
    SESSION_TYPE_RESTRICTED: "Bị giới hạn loại buổi tập",
    OTHER_MEDICAL_REASON: "Lý do y tế khác",
};

export const SCOPE: Record<ExaminationScope, string> = { TRAINING: "Tập luyện", COMPETITION: "Thi đấu" };

export const DECISION: Record<ExaminationDecision, Labelled> = {
    ELIGIBLE: { label: "Đủ điều kiện", tone: "green" },
    ELIGIBLE_WITH_RESTRICTIONS: { label: "Đủ, có giới hạn", tone: "amber" },
    NOT_ELIGIBLE: { label: "Không đủ điều kiện", tone: "red" },
};

/** Kết luận theo domain (phiếu khám demo và phiếu từ API đều có `outcome`). */
export const OUTCOME: Record<ExaminationOutcome, Labelled> = {
    fit: { label: "Đủ điều kiện", tone: "green" },
    fit_with_restrictions: { label: "Đủ, có giới hạn", tone: "amber" },
    unfit: { label: "Không đủ điều kiện", tone: "red" },
};

export const EXAM_TYPE: Record<ExaminationType, string> = {
    baseline: "Khám ban đầu",
    routine: "Khám định kỳ",
    pre_fight: "Khám trước trận",
    post_injury: "Khám sau chấn thương",
    concussion_screen: "Tầm soát chấn động",
    return_to_play: "Đánh giá trở lại tập",
};

export const HYDRATION: Record<"good" | "fair" | "poor", string> = { good: "Tốt", fair: "Trung bình", poor: "Kém" };
export const ASSESSMENT: Record<"normal" | "abnormal" | "inconclusive", Labelled> = {
    normal: { label: "Bình thường", tone: "green" },
    abnormal: { label: "Bất thường", tone: "red" },
    inconclusive: { label: "Chưa kết luận", tone: "amber" },
};

export const CLEARANCE_TYPE: Record<ClearanceType, string> = { TRAINING: "Tập luyện", COMPETITION: "Thi đấu", RETURN_FROM_INJURY: "Trở lại sau chấn thương" };
export const CLEARANCE_LEVEL: Record<ClearanceLevel, string> = { full: "Được tập", restricted: "Tập có hạn chế", not_cleared: "Chưa được tập" };
export const CLEARANCE_STATE: Record<ClearanceState, Labelled> = {
    full: { label: "Được tập", tone: "green" },
    restricted: { label: "Tập có hạn chế", tone: "amber" },
    not_cleared: { label: "Chưa được tập", tone: "red" },
    expired: { label: "Giấy phép hết hạn", tone: "red" },
    none: { label: "Chưa có giấy phép", tone: "neutral" },
};

/** Trạng thái hiển thị: REVOKED là thu hồi; hết hạn khi status=expired hoặc API báo không còn hiệu lực (backend không có job hết hạn). */
export function clearanceBadge(c: Pick<MedicalClearance, "status" | "isCurrentlyValid">): Labelled {
    if (c.status === "revoked") return { label: "Đã thu hồi", tone: "red" };
    if (c.status === "superseded") return { label: "Đã thay thế", tone: "neutral" };
    if (c.status === "expired" || c.isCurrentlyValid === false) return { label: "Hết hạn", tone: "neutral" };
    return { label: "Hiệu lực", tone: "green" };
}

export const JOINT: Record<BodyJoint, string> = {
    LEFT_SHOULDER: "Vai trái",
    RIGHT_SHOULDER: "Vai phải",
    LEFT_ELBOW: "Khuỷu trái",
    RIGHT_ELBOW: "Khuỷu phải",
    LEFT_WRIST: "Cổ tay trái",
    RIGHT_WRIST: "Cổ tay phải",
    LEFT_HIP: "Hông trái",
    RIGHT_HIP: "Hông phải",
    LEFT_KNEE: "Gối trái",
    RIGHT_KNEE: "Gối phải",
    LEFT_ANKLE: "Cổ chân trái",
    RIGHT_ANKLE: "Cổ chân phải",
    SPINE_CORE: "Cột sống / thân",
};
export const jointLabel = (joint: string) => (joint in JOINT ? JOINT[joint as BodyJoint] : joint);

export const BODY_REGION: Record<BodyRegion, string> = {
    head: "Đầu",
    neck: "Cổ",
    left_shoulder: "Vai trái",
    right_shoulder: "Vai phải",
    left_elbow: "Khuỷu trái",
    right_elbow: "Khuỷu phải",
    left_hand: "Bàn tay trái",
    right_hand: "Bàn tay phải",
    chest: "Ngực",
    ribs: "Xương sườn",
    lower_back: "Lưng dưới",
    left_hip: "Hông trái",
    right_hip: "Hông phải",
    left_hamstring: "Gân kheo trái",
    right_hamstring: "Gân kheo phải",
    left_knee: "Gối trái",
    right_knee: "Gối phải",
    left_shin: "Cẳng chân trái",
    right_shin: "Cẳng chân phải",
    left_ankle: "Cổ chân trái",
    right_ankle: "Cổ chân phải",
};

/** Khớp của mô hình 3D cho một vùng cơ thể của domain (dùng khi chấn thương không mang mã khớp của API). */
const REGION_TO_JOINT: Partial<Record<BodyRegion, BodyJoint>> = {
    left_shoulder: "LEFT_SHOULDER",
    right_shoulder: "RIGHT_SHOULDER",
    left_elbow: "LEFT_ELBOW",
    right_elbow: "RIGHT_ELBOW",
    left_hand: "LEFT_WRIST",
    right_hand: "RIGHT_WRIST",
    left_hip: "LEFT_HIP",
    right_hip: "RIGHT_HIP",
    left_hamstring: "LEFT_HIP",
    right_hamstring: "RIGHT_HIP",
    left_knee: "LEFT_KNEE",
    right_knee: "RIGHT_KNEE",
    left_shin: "LEFT_ANKLE",
    right_shin: "RIGHT_ANKLE",
    left_ankle: "LEFT_ANKLE",
    right_ankle: "RIGHT_ANKLE",
    lower_back: "SPINE_CORE",
    // Đầu/cổ/ngực/sườn: vùng phụ của web (body3d/regions.ts EXTRA_REGIONS), không quy về cột sống nữa.
    head: "HEAD" as BodyJoint,
    neck: "NECK" as BodyJoint,
    chest: "CHEST" as BodyJoint,
    ribs: "RIBS" as BodyJoint,
};
export const jointOf = (injury: { joint?: BodyJoint; bodyRegion: BodyRegion }): string => injury.joint ?? REGION_TO_JOINT[injury.bodyRegion] ?? injury.bodyRegion.toUpperCase();
export const injuryPlace = (injury: { joint?: BodyJoint; bodyRegion: BodyRegion }) => (injury.joint ? JOINT[injury.joint] : BODY_REGION[injury.bodyRegion]);

export const INJURY_TYPE: Record<InjuryType, string> = {
    concussion: "Chấn động não",
    strain: "Căng cơ",
    sprain: "Bong gân",
    contusion: "Đụng dập",
    laceration: "Vết rách da",
    fracture: "Gãy xương",
    tendinopathy: "Bệnh lý gân",
    impingement: "Chèn ép khớp",
};
export const injuryName = (injury: { type: InjuryType | null; typeLabel?: string }) => injury.typeLabel || (injury.type ? INJURY_TYPE[injury.type] : "Chấn thương");

export const SEVERITY: Record<InjurySeverity, Labelled> = {
    minor: { label: "Nhẹ", tone: "neutral" },
    moderate: { label: "Vừa", tone: "amber" },
    severe: { label: "Nặng", tone: "red" },
    critical: { label: "Nguy kịch", tone: "red" },
};
export const INJURY_STATUS: Record<InjuryStatus, Labelled> = {
    active: { label: "Đang điều trị", tone: "red" },
    recovering: { label: "Đang hồi phục", tone: "amber" },
    resolved: { label: "Đã khỏi", tone: "green" },
};
export const MECHANISM: Record<InjuryMechanism, string> = {
    sparring: "Đấu tập",
    pad_work: "Đấm đích",
    heavy_bag: "Bao cát",
    grappling: "Vật",
    strength_conditioning: "Thể lực",
    competition: "Thi đấu",
    outside_training: "Ngoài giờ tập",
};

export const TREATMENT_TYPE: Record<TreatmentType, string> = {
    rest: "Nghỉ ngơi",
    ice_compression: "Chườm lạnh, băng ép",
    physiotherapy: "Vật lý trị liệu",
    manual_therapy: "Trị liệu bằng tay",
    medication: "Dùng thuốc",
    imaging: "Chẩn đoán hình ảnh",
    strength_rehab: "Phục hồi sức mạnh",
    specialist_referral: "Chuyển chuyên khoa",
    immobilisation: "Cố định",
};
export const treatmentName = (t: { type: TreatmentType | null; typeLabel?: string }) => t.typeLabel || (t.type ? TREATMENT_TYPE[t.type] : "Điều trị");

export const PLAN_STATUS: Record<RecoveryPlanStatus, Labelled> = {
    active: { label: "Đang thực hiện", tone: "blue" },
    paused: { label: "Tạm dừng", tone: "amber" },
    completed: { label: "Hoàn thành", tone: "green" },
    cancelled: { label: "Đã hủy", tone: "neutral" },
};

export const REQUESTER_ROLE: Record<MedicalReviewRequest["requesterRole"] | "GUEST", string> = { FIGHTER: "Võ sĩ", COACH: "HLV", DOCTOR: "Bác sĩ", ADMIN: "Quản trị", GUEST: "Khách" };

export const SESSION_TYPE: Record<SessionType, string> = {
    SHADOW_BOXING: "Đánh gió",
    PAD_WORK: "Đấm đích",
    HEAVY_BAG: "Bao cát",
    SPARRING: "Đấu tập",
    GRAPPLING: "Vật",
    STRENGTH_CONDITIONING: "Thể lực",
    RECOVERY: "Hồi phục",
    PHYSICAL_THERAPY: "Vật lý trị liệu",
};
export const TECHNIQUE: Record<TechniqueType, string> = {
    JAB: "Đấm thẳng tay trước",
    CROSS: "Đấm thẳng tay sau",
    LEAD_HOOK: "Móc tay trước",
    REAR_HOOK: "Móc tay sau",
    LEAD_UPPERCUT: "Đấm móc lên tay trước",
    REAR_UPPERCUT: "Đấm móc lên tay sau",
    LEAD_LOW_KICK: "Đá thấp chân trước",
    REAR_LOW_KICK: "Đá thấp chân sau",
    LEAD_MIDDLE_KICK: "Đá tầm trung chân trước",
    REAR_MIDDLE_KICK: "Đá tầm trung chân sau",
    LEAD_HIGH_KICK: "Đá cao chân trước",
    REAR_HIGH_KICK: "Đá cao chân sau",
    FRONT_TEEP: "Đạp trước",
    SPINNING_BACK_FIST: "Xoay người đấm ngược",
};

export const ALERT_STATUS: Record<AlertStatus, Labelled> = {
    new: { label: "Mới", tone: "blue" },
    acknowledged: { label: "Đã ghi nhận", tone: "neutral" },
    follow_up: { label: "Cần theo dõi", tone: "amber" },
    dismissed: { label: "Đã bỏ qua", tone: "neutral" },
};

/* ─── Ngày giờ: dd/mm/yyyy, giờ Asia/Saigon ─────────────────────────────── */

const TZ = "Asia/Ho_Chi_Minh";
const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const DATETIME = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const WEEKDAY = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
/** Ngày thuần (YYYY-MM-DD) đọc ở giữa ngày theo giờ Việt Nam để không lệch ngày. */
export const toTime = (v: string) => Date.parse(v.length === 10 ? `${v}T12:00:00+07:00` : v);
export const fmtDate = (v: string | null | undefined) => (v ? DATE.format(new Date(toTime(v))) : "—");
export const fmtDateTime = (v: string | null | undefined) => (v ? DATETIME.format(new Date(toTime(v))) : "—");
export const todayLabel = (now: string | number = Date.now()) => {
    const t = WEEKDAY.format(new Date(now));
    return t.charAt(0).toUpperCase() + t.slice(1);
};
/** Khoá ngày (YYYY-MM-DD) theo giờ Việt Nam. */
export const dayKey = (v: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(typeof v === "number" ? v : toTime(v)));
/** Số ngày lịch (giờ Việt Nam) từ `now` tới `v`; âm là đã qua. */
export const dayDiff = (v: string, now: string | number = Date.now()) => Math.round((Date.parse(`${dayKey(v)}T00:00:00Z`) - Date.parse(`${dayKey(typeof now === "number" ? now : toTime(now))}T00:00:00Z`)) / 86_400_000);
export const rel = (v: string, now?: string | number) => {
    const d = dayDiff(v, now);
    return d === 0 ? "hôm nay" : d > 0 ? `sau ${d} ngày` : `${-d} ngày trước`;
};
export const age = (dob: string, now: number = Date.now()) => Math.floor((now - toTime(dob)) / (365.25 * 86_400_000));
export const num = (n: number, digits = 1) => n.toFixed(digits).replace(".", ",");

/* ─── Võ sĩ ──────────────────────────────────────────────────────────────── */

export const fname = (f: Pick<Fighter, "name">) => f.name;
export const fmeta = (f: Pick<Fighter, "weightClass" | "dateOfBirth" | "stance">) =>
    [WEIGHT_CLASS[f.weightClass], f.dateOfBirth ? `${age(f.dateOfBirth)} tuổi` : null, f.stance ? STANCE[f.stance] : null].filter(Boolean).join(" · ");
/** Tỉ lệ đo được so với mức nền của chính võ sĩ (0–1), cho vòng biên độ. */
export const alertRatio = (m: { observed: number; baseline: number }) => {
    const hi = Math.max(m.observed, m.baseline);
    return hi > 0 ? Math.max(0, Math.min(1, Math.min(m.observed, m.baseline) / hi)) : 0;
};

export const initials = (name: string) =>
    name
        .replace(/^(BS\.?|Dr\.?)\s+/i, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((w) => w[0]!.toUpperCase())
        .join("");
