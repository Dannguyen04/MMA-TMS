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
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";

/** Nhãn cho màn hình Bác sĩ (khoá từ điển `doctorUi.*`, hiển thị bằng `t`). Khoá là giá trị của domain frontend (chữ thường) hoặc của API y tế (chữ hoa). */

export type Tone = "red" | "amber" | "green" | "blue" | "neutral";
export interface Labelled {
    label: MessageKey;
    tone: Tone;
}

export const WEIGHT_CLASS: Record<WeightClass, MessageKey> = {
    strawweight: "doctorUi.weightClass.strawweight",
    flyweight: "doctorUi.weightClass.flyweight",
    bantamweight: "doctorUi.weightClass.bantamweight",
    featherweight: "doctorUi.weightClass.featherweight",
    lightweight: "doctorUi.weightClass.lightweight",
    welterweight: "doctorUi.weightClass.welterweight",
    middleweight: "doctorUi.weightClass.middleweight",
    light_heavyweight: "doctorUi.weightClass.light_heavyweight",
    heavyweight: "doctorUi.weightClass.heavyweight",
};

export const STANCE: Record<Stance, MessageKey> = { orthodox: "doctorUi.stance.orthodox", southpaw: "doctorUi.stance.southpaw", switch: "doctorUi.stance.switch" };

export const HEALTH_STATUS: Record<HealthStatus, Labelled> = {
    healthy: { label: "doctorUi.healthStatus.healthy", tone: "green" },
    monitoring: { label: "doctorUi.healthStatus.monitoring", tone: "blue" },
    recovery: { label: "doctorUi.healthStatus.recovery", tone: "amber" },
    injured: { label: "doctorUi.healthStatus.injured", tone: "red" },
    not_cleared: { label: "doctorUi.healthStatus.not_cleared", tone: "red" },
};

export const ELIGIBILITY_REASON: Record<EligibilityReason, MessageKey> = {
    EXAMINATION_REQUIRED: "doctorUi.eligibility.EXAMINATION_REQUIRED",
    REVIEW_REQUEST_PENDING: "doctorUi.eligibility.REVIEW_REQUEST_PENDING",
    EXAMINATION_NOT_ELIGIBLE: "doctorUi.eligibility.EXAMINATION_NOT_ELIGIBLE",
    CLEARANCE_REQUIRED: "doctorUi.eligibility.CLEARANCE_REQUIRED",
    CLEARANCE_EXPIRED: "doctorUi.eligibility.CLEARANCE_EXPIRED",
    SESSION_TYPE_RESTRICTED: "doctorUi.eligibility.SESSION_TYPE_RESTRICTED",
    OTHER_MEDICAL_REASON: "doctorUi.eligibility.OTHER_MEDICAL_REASON",
};

export const SCOPE: Record<ExaminationScope, MessageKey> = { TRAINING: "doctorUi.scope.TRAINING", COMPETITION: "doctorUi.scope.COMPETITION" };

export const DECISION: Record<ExaminationDecision, Labelled> = {
    ELIGIBLE: { label: "doctorUi.decision.ELIGIBLE", tone: "green" },
    ELIGIBLE_WITH_RESTRICTIONS: { label: "doctorUi.decision.ELIGIBLE_WITH_RESTRICTIONS", tone: "amber" },
    NOT_ELIGIBLE: { label: "doctorUi.decision.NOT_ELIGIBLE", tone: "red" },
};

/** Kết luận theo domain (phiếu khám demo và phiếu từ API đều có `outcome`). */
export const OUTCOME: Record<ExaminationOutcome, Labelled> = {
    fit: { label: "doctorUi.decision.ELIGIBLE", tone: "green" },
    fit_with_restrictions: { label: "doctorUi.decision.ELIGIBLE_WITH_RESTRICTIONS", tone: "amber" },
    unfit: { label: "doctorUi.decision.NOT_ELIGIBLE", tone: "red" },
};

export const EXAM_TYPE: Record<ExaminationType, MessageKey> = {
    baseline: "doctorUi.examType.baseline",
    routine: "doctorUi.examType.routine",
    pre_fight: "doctorUi.examType.pre_fight",
    post_injury: "doctorUi.examType.post_injury",
    concussion_screen: "doctorUi.examType.concussion_screen",
    return_to_play: "doctorUi.examType.return_to_play",
};

export const HYDRATION: Record<"good" | "fair" | "poor", MessageKey> = { good: "doctorUi.hydration.good", fair: "doctorUi.hydration.fair", poor: "doctorUi.hydration.poor" };
export const ASSESSMENT: Record<"normal" | "abnormal" | "inconclusive", Labelled> = {
    normal: { label: "doctorUi.assessment.normal", tone: "green" },
    abnormal: { label: "doctorUi.assessment.abnormal", tone: "red" },
    inconclusive: { label: "doctorUi.assessment.inconclusive", tone: "amber" },
};

export const CLEARANCE_TYPE: Record<ClearanceType, MessageKey> = { TRAINING: "doctorUi.clearanceType.TRAINING", COMPETITION: "doctorUi.clearanceType.COMPETITION", RETURN_FROM_INJURY: "doctorUi.clearanceType.RETURN_FROM_INJURY" };
export const CLEARANCE_LEVEL: Record<ClearanceLevel, MessageKey> = { full: "doctorUi.clearanceLevel.full", restricted: "doctorUi.clearanceLevel.restricted", not_cleared: "doctorUi.clearanceLevel.not_cleared" };
export const CLEARANCE_STATE: Record<ClearanceState, Labelled> = {
    full: { label: "doctorUi.clearanceLevel.full", tone: "green" },
    restricted: { label: "doctorUi.clearanceLevel.restricted", tone: "amber" },
    not_cleared: { label: "doctorUi.clearanceLevel.not_cleared", tone: "red" },
    expired: { label: "doctorUi.clearanceState.expired", tone: "red" },
    none: { label: "doctorUi.clearanceState.none", tone: "neutral" },
};

/** Trạng thái hiển thị: REVOKED là thu hồi; hết hạn khi status=expired hoặc API báo không còn hiệu lực (backend không có job hết hạn). */
export function clearanceBadge(c: Pick<MedicalClearance, "status" | "isCurrentlyValid">): Labelled {
    if (c.status === "revoked") return { label: "doctorUi.clearanceBadge.revoked", tone: "red" };
    if (c.status === "superseded") return { label: "doctorUi.clearanceBadge.superseded", tone: "neutral" };
    if (c.status === "expired" || c.isCurrentlyValid === false) return { label: "doctorUi.clearanceBadge.expired", tone: "neutral" };
    return { label: "doctorUi.clearanceBadge.active", tone: "green" };
}

export const JOINT: Record<BodyJoint, MessageKey> = {
    LEFT_SHOULDER: "doctorUi.joint.LEFT_SHOULDER",
    RIGHT_SHOULDER: "doctorUi.joint.RIGHT_SHOULDER",
    LEFT_ELBOW: "doctorUi.joint.LEFT_ELBOW",
    RIGHT_ELBOW: "doctorUi.joint.RIGHT_ELBOW",
    LEFT_WRIST: "doctorUi.joint.LEFT_WRIST",
    RIGHT_WRIST: "doctorUi.joint.RIGHT_WRIST",
    LEFT_HIP: "doctorUi.joint.LEFT_HIP",
    RIGHT_HIP: "doctorUi.joint.RIGHT_HIP",
    LEFT_KNEE: "doctorUi.joint.LEFT_KNEE",
    RIGHT_KNEE: "doctorUi.joint.RIGHT_KNEE",
    LEFT_ANKLE: "doctorUi.joint.LEFT_ANKLE",
    RIGHT_ANKLE: "doctorUi.joint.RIGHT_ANKLE",
    SPINE_CORE: "doctorUi.joint.SPINE_CORE",
};
export const jointLabel = (t: Translator, joint: string) => (joint in JOINT ? t(JOINT[joint as BodyJoint]) : joint);

export const BODY_REGION: Record<BodyRegion, MessageKey> = {
    head: "doctorUi.region.head",
    neck: "doctorUi.region.neck",
    left_shoulder: "doctorUi.region.left_shoulder",
    right_shoulder: "doctorUi.region.right_shoulder",
    left_elbow: "doctorUi.region.left_elbow",
    right_elbow: "doctorUi.region.right_elbow",
    left_hand: "doctorUi.region.left_hand",
    right_hand: "doctorUi.region.right_hand",
    chest: "doctorUi.region.chest",
    ribs: "doctorUi.region.ribs",
    lower_back: "doctorUi.region.lower_back",
    left_hip: "doctorUi.region.left_hip",
    right_hip: "doctorUi.region.right_hip",
    left_hamstring: "doctorUi.region.left_hamstring",
    right_hamstring: "doctorUi.region.right_hamstring",
    left_knee: "doctorUi.region.left_knee",
    right_knee: "doctorUi.region.right_knee",
    left_shin: "doctorUi.region.left_shin",
    right_shin: "doctorUi.region.right_shin",
    left_ankle: "doctorUi.region.left_ankle",
    right_ankle: "doctorUi.region.right_ankle",
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
export const injuryPlace = (t: Translator, injury: { joint?: BodyJoint; bodyRegion: BodyRegion }) => t(injury.joint ? JOINT[injury.joint] : BODY_REGION[injury.bodyRegion]);

export const INJURY_TYPE: Record<InjuryType, MessageKey> = {
    concussion: "doctorUi.injuryType.concussion",
    strain: "doctorUi.injuryType.strain",
    sprain: "doctorUi.injuryType.sprain",
    contusion: "doctorUi.injuryType.contusion",
    laceration: "doctorUi.injuryType.laceration",
    fracture: "doctorUi.injuryType.fracture",
    tendinopathy: "doctorUi.injuryType.tendinopathy",
    impingement: "doctorUi.injuryType.impingement",
};
export const injuryName = (t: Translator, injury: { type: InjuryType | null; typeLabel?: string }) => injury.typeLabel || t(injury.type ? INJURY_TYPE[injury.type] : "doctorUi.injuryFallback");

export const SEVERITY: Record<InjurySeverity, Labelled> = {
    minor: { label: "doctorUi.severity.minor", tone: "neutral" },
    moderate: { label: "doctorUi.severity.moderate", tone: "amber" },
    severe: { label: "doctorUi.severity.severe", tone: "red" },
    critical: { label: "doctorUi.severity.critical", tone: "red" },
};
export const INJURY_STATUS: Record<InjuryStatus, Labelled> = {
    active: { label: "doctorUi.injuryStatus.active", tone: "red" },
    recovering: { label: "doctorUi.injuryStatus.recovering", tone: "amber" },
    resolved: { label: "doctorUi.injuryStatus.resolved", tone: "green" },
};
export const MECHANISM: Record<InjuryMechanism, MessageKey> = {
    sparring: "doctorUi.mechanism.sparring",
    pad_work: "doctorUi.mechanism.pad_work",
    heavy_bag: "doctorUi.mechanism.heavy_bag",
    grappling: "doctorUi.mechanism.grappling",
    strength_conditioning: "doctorUi.mechanism.strength_conditioning",
    competition: "doctorUi.mechanism.competition",
    outside_training: "doctorUi.mechanism.outside_training",
};

export const TREATMENT_TYPE: Record<TreatmentType, MessageKey> = {
    rest: "doctorUi.treatmentType.rest",
    ice_compression: "doctorUi.treatmentType.ice_compression",
    physiotherapy: "doctorUi.treatmentType.physiotherapy",
    manual_therapy: "doctorUi.treatmentType.manual_therapy",
    medication: "doctorUi.treatmentType.medication",
    imaging: "doctorUi.treatmentType.imaging",
    strength_rehab: "doctorUi.treatmentType.strength_rehab",
    specialist_referral: "doctorUi.treatmentType.specialist_referral",
    immobilisation: "doctorUi.treatmentType.immobilisation",
};
export const treatmentName = (t: Translator, tr: { type: TreatmentType | null; typeLabel?: string }) => tr.typeLabel || t(tr.type ? TREATMENT_TYPE[tr.type] : "doctorUi.treatmentFallback");

export const PLAN_STATUS: Record<RecoveryPlanStatus, Labelled> = {
    active: { label: "doctorUi.planStatus.active", tone: "blue" },
    paused: { label: "doctorUi.planStatus.paused", tone: "amber" },
    completed: { label: "doctorUi.planStatus.completed", tone: "green" },
    cancelled: { label: "doctorUi.planStatus.cancelled", tone: "neutral" },
};

export const REQUESTER_ROLE: Record<MedicalReviewRequest["requesterRole"] | "GUEST", MessageKey> = { FIGHTER: "doctorUi.role.FIGHTER", COACH: "doctorUi.role.COACH", DOCTOR: "doctorUi.role.DOCTOR", ADMIN: "doctorUi.role.ADMIN", GUEST: "doctorUi.role.GUEST" };

export const SESSION_TYPE: Record<SessionType, MessageKey> = {
    SHADOW_BOXING: "doctorUi.session.SHADOW_BOXING",
    PAD_WORK: "doctorUi.session.PAD_WORK",
    HEAVY_BAG: "doctorUi.session.HEAVY_BAG",
    SPARRING: "doctorUi.session.SPARRING",
    GRAPPLING: "doctorUi.session.GRAPPLING",
    STRENGTH_CONDITIONING: "doctorUi.session.STRENGTH_CONDITIONING",
    RECOVERY: "doctorUi.session.RECOVERY",
    PHYSICAL_THERAPY: "doctorUi.session.PHYSICAL_THERAPY",
};
export const TECHNIQUE: Record<TechniqueType, MessageKey> = {
    JAB: "doctorUi.technique.JAB",
    CROSS: "doctorUi.technique.CROSS",
    LEAD_HOOK: "doctorUi.technique.LEAD_HOOK",
    REAR_HOOK: "doctorUi.technique.REAR_HOOK",
    LEAD_UPPERCUT: "doctorUi.technique.LEAD_UPPERCUT",
    REAR_UPPERCUT: "doctorUi.technique.REAR_UPPERCUT",
    LEAD_LOW_KICK: "doctorUi.technique.LEAD_LOW_KICK",
    REAR_LOW_KICK: "doctorUi.technique.REAR_LOW_KICK",
    LEAD_MIDDLE_KICK: "doctorUi.technique.LEAD_MIDDLE_KICK",
    REAR_MIDDLE_KICK: "doctorUi.technique.REAR_MIDDLE_KICK",
    LEAD_HIGH_KICK: "doctorUi.technique.LEAD_HIGH_KICK",
    REAR_HIGH_KICK: "doctorUi.technique.REAR_HIGH_KICK",
    FRONT_TEEP: "doctorUi.technique.FRONT_TEEP",
    SPINNING_BACK_FIST: "doctorUi.technique.SPINNING_BACK_FIST",
};

export const ALERT_STATUS: Record<AlertStatus, Labelled> = {
    new: { label: "doctorUi.alertStatus.new", tone: "blue" },
    acknowledged: { label: "doctorUi.alertStatus.acknowledged", tone: "neutral" },
    follow_up: { label: "doctorUi.alertStatus.follow_up", tone: "amber" },
    dismissed: { label: "doctorUi.alertStatus.dismissed", tone: "neutral" },
};

/* ─── Ngày giờ: dd/mm/yyyy, giờ Asia/Saigon ─────────────────────────────── */

const TZ = "Asia/Ho_Chi_Minh";
const formatters = (locale: Locale) => ({
    date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }),
    datetime: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }),
    weekday: new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }),
});
const FORMATS: Record<Locale, ReturnType<typeof formatters>> = { vi: formatters("vi"), en: formatters("en") };
/** Ngày thuần (YYYY-MM-DD) đọc ở giữa ngày theo giờ Việt Nam để không lệch ngày. */
export const toTime = (v: string) => Date.parse(v.length === 10 ? `${v}T12:00:00+07:00` : v);
export const fmtDate = (v: string | null | undefined, locale: Locale) => (v ? FORMATS[locale].date.format(new Date(toTime(v))) : "—");
export const fmtDateTime = (v: string | null | undefined, locale: Locale) => (v ? FORMATS[locale].datetime.format(new Date(toTime(v))) : "—");
export const todayLabel = (locale: Locale, now: string | number = Date.now()) => {
    const t = FORMATS[locale].weekday.format(new Date(now));
    return t.charAt(0).toUpperCase() + t.slice(1);
};
/** Khoá ngày (YYYY-MM-DD) theo giờ Việt Nam. */
export const dayKey = (v: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(typeof v === "number" ? v : toTime(v)));
/** Số ngày lịch (giờ Việt Nam) từ `now` tới `v`; âm là đã qua. */
export const dayDiff = (v: string, now: string | number = Date.now()) => Math.round((Date.parse(`${dayKey(v)}T00:00:00Z`) - Date.parse(`${dayKey(typeof now === "number" ? now : toTime(now))}T00:00:00Z`)) / 86_400_000);
export const rel = (t: Translator, v: string, now?: string | number) => {
    const d = dayDiff(v, now);
    return d === 0 ? t("doctorUi.rel.today") : d > 0 ? plural(t, "doctorUi.rel.future", d) : plural(t, "doctorUi.rel.past", -d);
};
export const age = (dob: string, now: number = Date.now()) => Math.floor((now - toTime(dob)) / (365.25 * 86_400_000));
/** Số có `digits` chữ số thập phân: dấu phẩy trong tiếng Việt, dấu chấm trong tiếng Anh. */
export const num = (n: number, locale: Locale, digits = 1) => (locale === "vi" ? n.toFixed(digits).replace(".", ",") : n.toFixed(digits));

/* ─── Võ sĩ ──────────────────────────────────────────────────────────────── */

export const fname = (f: Pick<Fighter, "name">) => f.name;
export const fmeta = (t: Translator, f: Pick<Fighter, "weightClass" | "dateOfBirth" | "stance">) =>
    [t(WEIGHT_CLASS[f.weightClass]), f.dateOfBirth ? plural(t, "doctorUi.age", age(f.dateOfBirth)) : null, f.stance ? t(STANCE[f.stance]) : null].filter(Boolean).join(" · ");
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
