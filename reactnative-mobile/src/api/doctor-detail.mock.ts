import { mockCoachApi } from "./coach.mock";
import { ApiError } from "./errors";
import type { AnalysisJob, HealthAlert, JobHealthAlerts } from "./media";
import type {
  DoctorAssignment,
  MedicalClearance,
  FighterMedicalSummary,
  ListMedicalExaminationsQuery,
  ListMedicalHistoryQuery,
  ListReviewRequestsQuery,
  MedicalDossier,
  MedicalExamination,
  MedicalHistoryEntry,
  MedicalReviewRequest,
  Paginated,
  RecoveryPlan,
} from "./types";

/**
 * Dữ liệu giả lập cho chi tiết võ sĩ của Doctor (chỉ dev, `EXPO_PUBLIC_DOCTOR_MOCK=true`).
 * Kịch bản `globalThis.__DOCTOR_MOCK_SCENARIO__`: "empty" | "offline" | "slow" | "forbidden".
 * Khóa snapshot lịch sử theo đúng máy chủ: camelCase (medical.repo projectSnapshot).
 */
const DAY = 86_400_000;
const day = (n: number) => new Date(Date.now() + n * DAY).toISOString();

function scenario(): string {
  const g = globalThis as { __DOCTOR_MOCK_SCENARIO__?: string; __COACH_MOCK_SCENARIO__?: string };
  return g.__DOCTOR_MOCK_SCENARIO__ ?? g.__COACH_MOCK_SCENARIO__ ?? "normal";
}

async function gate(): Promise<"normal" | "empty"> {
  const s = scenario();
  await new Promise<void>((resolve) => setTimeout(resolve, s === "slow" ? 2500 : 300));
  if (s === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  if (s === "forbidden") throw new ApiError(403, "MEDICAL_ACCESS_DENIED", "Forbidden");
  return s === "empty" ? "empty" : "normal";
}

function page<T>(rows: T[], q: { page?: number; limit?: number } = {}): Paginated<T> {
  const limit = q.limit ?? 20;
  const p = q.page ?? 1;
  return { data: rows.slice((p - 1) * limit, p * limit), total: rows.length, hasNextPage: p * limit < rows.length };
}

/** Võ sĩ có hồ sơ y tế đầy đủ trong bản giả lập: cf-4 (Phạm Gia Huy, chấn thương). */
const RICH = "cf-4";

const PLAN: RecoveryPlan = {
  id: "rp-1", fighterId: RICH, injuryId: "ci-3", doctorId: "doc-1", title: "Phục hồi gối phải – giai đoạn 1",
  description: "Giảm tải, vật lý trị liệu 3 buổi/tuần.", startDate: day(-11), estimatedEndDate: day(9), actualEndDate: null,
  status: "ACTIVE",
  milestones: [
    { id: "m1", title: "Hết sưng", criteria: "Không sưng sau 48 giờ", targetDate: day(-4), isCompleted: true, completedAt: day(-5), notes: null },
    { id: "m2", title: "Gập gối 120°", criteria: "Đo bằng thước góc", targetDate: day(3), isCompleted: true, completedAt: day(-1), notes: null },
    { id: "m3", title: "Chạy nhẹ 10 phút", criteria: "Không đau", targetDate: day(9), isCompleted: false, completedAt: null, notes: null },
  ],
  revision: 1, createdAt: day(-11), updatedAt: day(-1),
};

const REVIEWS: MedicalReviewRequest[] = [
  { id: "rr-1", fighterId: RICH, requestedById: "u-coach", requesterRole: "COACH", reason: "Võ sĩ báo đau khi xoay gối.", status: "OPEN", requestedAt: day(-1), resolvedByExaminationId: null, resolvedAt: null, revision: 1 },
  { id: "rr-0", fighterId: RICH, requestedById: "u-fighter", requesterRole: "FIGHTER", reason: "Đau vai sau buổi đối kháng.", status: "RESOLVED", requestedAt: day(-40), resolvedByExaminationId: "ex-1", resolvedAt: day(-38), revision: 2 },
];

const EXAMS: MedicalExamination[] = [
  {
    id: "ex-3", sequenceNo: 3, fighterId: RICH, doctorId: "doc-1", recordedById: "u-doc", scope: "TRAINING", decision: "NOT_ELIGIBLE",
    examinedAt: day(-12), reason: "Căng dây chằng gối phải sau buổi đối kháng.",
    restrictions: { allowedSessionTypes: ["RECOVERY"], allowedTechniqueTypes: null, excludedJoints: ["RIGHT_KNEE"], notes: "Không chịu lực lên gối phải." },
    validUntil: null, supersedesId: null, createdAt: day(-12),
    details: {
      examinationType: "POST_INJURY",
      vitals: { weightKg: 78.4, restingHeartRate: 62, bloodPressureSystolic: 122, bloodPressureDiastolic: 78, temperatureC: 36.7, spo2Pct: 98, hydration: "GOOD" },
      assessments: [
        { area: "Gối phải", result: "ABNORMAL", note: "Sưng nhẹ, đau khi gập sâu." },
        { area: "Thần kinh", result: "NORMAL", note: null },
      ],
      recommendations: "Chườm lạnh, vật lý trị liệu, tái khám sau 2 tuần.",
      followUpDate: day(2),
      scat6: null,
    },
  },
  {
    id: "ex-2", sequenceNo: 2, fighterId: RICH, doctorId: "doc-1", recordedById: "u-doc", scope: "COMPETITION", decision: "ELIGIBLE",
    examinedAt: day(-47), reason: "Khám trước giải.", restrictions: null, validUntil: day(44), supersedesId: null, createdAt: day(-47),
    details: null,
  },
  {
    id: "ex-1", sequenceNo: 1, fighterId: RICH, doctorId: "doc-1", recordedById: "u-doc", scope: "TRAINING", decision: "ELIGIBLE_WITH_RESTRICTIONS",
    examinedAt: day(-90), reason: "Khám nền đầu mùa.",
    restrictions: { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: ["LEFT_SHOULDER"], notes: null },
    validUntil: day(-10), supersedesId: null, createdAt: day(-90), details: null,
  },
];

const HISTORY: MedicalHistoryEntry[] = [
  { recordType: "MEDICAL_REVIEW_REQUEST", recordId: "rr-1", revision: 1, source: "APPLICATION", recordedAt: day(-1), recordedByUserId: "u-coach",
    snapshot: { id: "rr-1", requesterRole: "COACH", reason: "Võ sĩ báo đau khi xoay gối.", status: "OPEN", requestedAt: day(-1) } },
  { recordType: "RECOVERY_PLAN", recordId: "rp-1", revision: 1, source: "APPLICATION", recordedAt: day(-11), recordedByUserId: "u-doc",
    snapshot: { id: "rp-1", title: "Phục hồi gối phải – giai đoạn 1", status: "ACTIVE", startDate: day(-11), estimatedEndDate: day(9) } },
  { recordType: "TREATMENT", recordId: "tr-1", revision: 1, source: "APPLICATION", recordedAt: day(-11), recordedByUserId: "u-doc",
    snapshot: { id: "tr-1", treatmentType: "Vật lý trị liệu", treatmentDate: day(-11), outcomeNotes: "Giảm đau sau buổi đầu." } },
  { recordType: "MEDICAL_EXAMINATION", recordId: "ex-3", revision: 1, source: "APPLICATION", recordedAt: day(-12), recordedByUserId: "u-doc",
    snapshot: { id: "ex-3", scope: "TRAINING", decision: "NOT_ELIGIBLE", examinedAt: day(-12), reason: "Căng dây chằng gối phải sau buổi đối kháng." } },
  { recordType: "INJURY", recordId: "ci-3", revision: 1, source: "APPLICATION", recordedAt: day(-12), recordedByUserId: "u-doc",
    snapshot: { id: "ci-3", affectedJoint: "RIGHT_KNEE", injuryType: "Căng dây chằng", severity: "MODERATE", status: "ACTIVE", occurredAt: day(-12) } },
  { recordType: "MEDICAL_CLEARANCE", recordId: "cl-9", revision: 2, source: "APPLICATION", recordedAt: day(-12), recordedByUserId: "u-doc",
    snapshot: { id: "cl-9", clearanceType: "TRAINING", status: "REVOKED", validFrom: day(-60), validUntil: day(30), revokedReason: "Chấn thương gối phải." } },
  { recordType: "MEDICAL_EXAMINATION", recordId: "ex-2", revision: 1, source: "APPLICATION", recordedAt: day(-47), recordedByUserId: "u-doc",
    snapshot: { id: "ex-2", scope: "COMPETITION", decision: "ELIGIBLE", examinedAt: day(-47), reason: "Khám trước giải." } },
  { recordType: "MEDICAL_EXAMINATION", recordId: "ex-1", revision: 1, source: "MIGRATION_BASELINE", recordedAt: day(-90), recordedByUserId: null,
    snapshot: { id: "ex-1", scope: "TRAINING", decision: "ELIGIBLE_WITH_RESTRICTIONS", examinedAt: day(-90), reason: "Khám nền đầu mùa." } },
];

const DOCTORS: DoctorAssignment[] = [
  { id: "da-10", doctorId: "doc-1", fighterId: RICH, assignedById: "u-1", startsAt: day(-48), endsAt: null, endedById: null, endReason: null, createdAt: day(-48), doctorName: "Lan Phạm" },
  { id: "da-09", doctorId: "doc-2", fighterId: RICH, assignedById: "u-1", startsAt: day(-200), endsAt: day(-49), endedById: "u-1", endReason: "Chuyển", createdAt: day(-200), doctorName: "Vũ Thanh Bình" },
];

const JOBS: AnalysisJob[] = [
  { id: "job-3", status: "DONE", score: 62, fighterId: RICH, sessionId: null, videoId: "v-3", alertCount: 2, hasImpairment: true, createdAt: day(-2), updatedAt: day(-2) },
  { id: "job-2", status: "DONE", score: 70, fighterId: RICH, sessionId: null, videoId: "v-2", alertCount: 1, hasImpairment: true, createdAt: day(-6), updatedAt: day(-6) },
  { id: "job-1", status: "DONE", score: 75, fighterId: "cf-5", sessionId: null, videoId: "v-1", alertCount: 1, hasImpairment: true, createdAt: day(-3), updatedAt: day(-3) },
];
const alert = (joint: string, severity: string, t: number, rom: number, motion: string): HealthAlert => ({
  joint, state: "CONFIRMED_IMPAIRMENT", severity, triggerTimeMs: t, windowStartMs: t - 8000, consecutiveLowRom: 3, avgRomRatio: rom, motionClass: motion,
  recommendation: "Giảm cường độ đòn chân phải, theo dõi biên độ gối trong 3 buổi tới.",
});
const ALERTS: Record<string, HealthAlert[]> = {
  "job-3": [alert("RIGHT_KNEE", "high", 42_000, 0.58, "POWER_STRIKE"), alert("RIGHT_KNEE", "medium", 95_500, 0.66, "PARTIAL_STRIKE")],
  "job-2": [alert("LEFT_SHOULDER", "medium", 18_200, 0.7, "TACTICAL_FEINT")],
  "job-1": [alert("LEFT_ANKLE", "critical", 12_000, 0.4, "UNKNOWN")],
};

const clearance = (id: string, clearanceType: "TRAINING" | "COMPETITION", days: number): MedicalClearance => ({
  id, fighterId: "cf-1", examinationId: null, issuedById: "u-doc", clearanceType, status: "ACTIVE", validFrom: day(-30), validUntil: day(days), notes: null,
  restrictions: { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null, notes: null },
  revokedAt: null, revokedById: null, revokedReason: null, revision: 1, createdAt: day(-30), isCurrentlyValid: true,
});

export const mockDoctorDetailApi = {
  /** GET /jobs/impairments: máy chủ đã lọc theo võ sĩ bác sĩ phụ trách; màn lọc tiếp theo fighterId. */
  async listImpairments(): Promise<AnalysisJob[]> {
    const s = await gate();
    return s === "empty" ? [] : JOBS;
  },
  async getHealthAlerts(jobId: string): Promise<JobHealthAlerts> {
    await gate();
    const rows = ALERTS[jobId] ?? [];
    return { jobId, status: "DONE", alertCount: rows.length, hasImpairment: rows.length > 0, healthAlerts: rows, jointStates: {} };
  },
  async getDossier(id: string): Promise<MedicalDossier> {
    const s = await gate();
    const base = await withNormalCoach(() => mockCoachApi.getMedical(id));
    if (s === "empty") return { ...base, activeInjuries: [], activeRecoveryPlans: [], activeClearances: [], openReviewRequests: [] };
    if (id === "cf-1") return { ...base, activeClearances: [clearance("cl-1t", "TRAINING", 75), clearance("cl-1c", "COMPETITION", 20)] };
    if (id !== RICH) return base;
    return {
      ...base,
      activeInjuries: [
        { id: "ci-3", fighterId: RICH, reportedById: "u-doc", affectedJoint: "RIGHT_KNEE", injuryType: "Căng dây chằng", severity: "MODERATE", occurredAt: day(-12),
          description: null, status: "ACTIVE", resolvedAt: null, sourceAlertId: null, triggerVideoId: null, revision: 1, createdAt: day(-12), updatedAt: day(-12) },
      ],
      activeRecoveryPlans: [PLAN],
      openReviewRequests: REVIEWS.filter((r) => r.status === "OPEN"),
      eligibility: {
        training: { scope: "TRAINING", eligible: false, reasons: ["EXAMINATION_NOT_ELIGIBLE"] },
        competition: { scope: "COMPETITION", eligible: false, reasons: ["CLEARANCE_REQUIRED"] },
      },
    };
  },
  /** Tóm tắt y tế (jointStates cho sơ đồ cơ thể). cf-4: gối phải chấn thương, vai trái đang hồi phục, cột sống đã khỏi. */
  async getMedicalSummary(id: string): Promise<FighterMedicalSummary> {
    const s = await gate();
    const base = await withNormalCoach(() => mockCoachApi.getMedicalSummary(id));
    if (s === "empty") return { ...base, activeInjuries: [], jointStates: [] };
    if (id !== RICH) return base;
    const inj = (id2: string, joint: string, type: string, sev: string, status: string) =>
      ({ id: id2, affectedJoint: joint, injuryType: type, severity: sev, status, occurredAt: day(-12), description: null }) as FighterMedicalSummary["activeInjuries"][number];
    return {
      ...base,
      activeInjuries: [
        inj("ci-3", "RIGHT_KNEE", "Căng dây chằng", "MODERATE", "ACTIVE"),
        inj("ci-2", "LEFT_SHOULDER", "Viêm gân", "MINOR", "RECOVERING"),
        inj("ci-1", "SPINE_CORE", "Đau thắt lưng", "MINOR", "RESOLVED"),
      ],
      jointStates: [
        { id: "js-1", joint: "LEFT_ANKLE", currentState: "SUSPECTED", stateUpdatedAt: day(-2), notes: null },
        { id: "js-2", joint: "LEFT_HAND", currentState: "CONFIRMED_IMPAIRMENT", stateUpdatedAt: day(-3), notes: null },
      ],
    };
  },
  async listExaminations(id: string, q: ListMedicalExaminationsQuery = {}): Promise<Paginated<MedicalExamination>> {
    const s = await gate();
    const rows = s === "empty" || id !== RICH ? [] : EXAMS.filter((e) => !q.scope || e.scope === q.scope);
    return page(rows, q);
  },
  async listReviewRequests(id: string, q: ListReviewRequestsQuery = {}): Promise<Paginated<MedicalReviewRequest>> {
    const s = await gate();
    const rows = s === "empty" || id !== RICH ? [] : REVIEWS.filter((r) => !q.status || r.status === q.status);
    return page(rows, q);
  },
  async listHistory(id: string, q: ListMedicalHistoryQuery = {}): Promise<Paginated<MedicalHistoryEntry>> {
    const s = await gate();
    const rows = s === "empty" || id !== RICH ? [] : HISTORY.filter((h) => !q.recordType || h.recordType === q.recordType);
    return page(rows, q);
  },
  async listDoctors(id: string, q: { page?: number; limit?: number } = {}): Promise<Paginated<DoctorAssignment>> {
    const s = await gate();
    return page(s === "empty" || id !== RICH ? [] : DOCTORS, q);
  },
};

/** Dossier gốc lấy từ mock Coach ở kịch bản thường (lỗi/rỗng do `gate()` xử lý). */
async function withNormalCoach<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { __COACH_MOCK_SCENARIO__?: string };
  const keep = g.__COACH_MOCK_SCENARIO__;
  g.__COACH_MOCK_SCENARIO__ = "normal";
  try {
    return await fn();
  } finally {
    g.__COACH_MOCK_SCENARIO__ = keep;
  }
}
