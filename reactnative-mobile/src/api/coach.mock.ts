import { ApiError } from "./errors";
import type {
  CoachAssignment,
  Exercise,
  FighterMeasurement,
  FighterMedicalSummary,
  ListFighterSessionsQuery,
  ListFightersQuery,
  ListTrainingPlansQuery,
  ListTrainingSessionsQuery,
  MeasurementContext,
  MedicalDossier,
  MedicalStatus,
  Paginated,
  PublicFighter,
  SessionStatus,
  SessionType,
  TrainingPlan,
  TrainingPlanExercise,
  TrainingSession,
  TrainingSessionSummary,
} from "./types";
import type { WeightClass } from "@/constants/weight-classes";

/**
 * Dữ liệu giả lập cho màn Coach chỉ đọc (C-1..C-7). Chỉ bật khi EXPO_PUBLIC_COACH_MOCK=true.
 * Kịch bản kiểm thử (chỉ dev): `globalThis.__COACH_MOCK_SCENARIO__` =
 * "empty" (không có dữ liệu), "offline" (mất mạng), "slow" (chậm ~2,5 giây để thấy skeleton).
 */
type Scenario = "normal" | "empty" | "offline" | "slow";
const DAY = 86_400_000;

function scenario(): Scenario {
  const v = (globalThis as { __COACH_MOCK_SCENARIO__?: string }).__COACH_MOCK_SCENARIO__;
  return v === "empty" || v === "offline" || v === "slow" ? v : "normal";
}

async function wait(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, scenario() === "slow" ? 2500 : 350));
  if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
}

/** 00:00 UTC của ngày cách hôm nay `days` ngày (giờ VN). */
function day(days: number, hour = 0, minute = 0): string {
  const vn = new Date(Date.now() + 7 * 3_600_000);
  const base = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  return new Date(base + days * DAY + (hour - 7) * 3_600_000 + minute * 60_000).toISOString();
}

const STAMP = "2026-01-01T00:00:00.000Z";

type Seed = {
  name: [string, string];
  wc: WeightClass;
  gym: string;
  status: MedicalStatus;
  height: number;
  base: number;
  stance: PublicFighter["dominantStance"];
};
const SEEDS: Seed[] = [
  { name: ["Nguyễn", "Minh Khang"], wc: "FEATHERWEIGHT", gym: "CLB Sài Gòn Fight", status: "HEALTHY", height: 172, base: 68.5, stance: "ORTHODOX" },
  { name: ["Trần", "Quốc Bảo"], wc: "LIGHTWEIGHT", gym: "CLB Sài Gòn Fight", status: "MONITORING", height: 175, base: 71.2, stance: "SOUTHPAW" },
  { name: ["Lê", "Hoàng Phúc"], wc: "BANTAMWEIGHT", gym: "Phòng tập Quận 7", status: "RECOVERY", height: 168, base: 63.4, stance: "ORTHODOX" },
  { name: ["Phạm", "Gia Huy"], wc: "WELTERWEIGHT", gym: "Phòng tập Quận 7", status: "INJURED", height: 179, base: 78.9, stance: "SWITCH" },
  { name: ["Võ", "Thanh Tùng"], wc: "FLYWEIGHT", gym: "CLB Sài Gòn Fight", status: "NOT_CLEARED", height: 165, base: 58.1, stance: "ORTHODOX" },
  { name: ["Đặng", "Anh Khoa"], wc: "FEATHERWEIGHT", gym: "Võ đường Thủ Đức", status: "HEALTHY", height: 174, base: 67.2, stance: "SOUTHPAW" },
  { name: ["Bùi", "Đức Long"], wc: "MIDDLEWEIGHT", gym: "Võ đường Thủ Đức", status: "HEALTHY", height: 183, base: 84.3, stance: "ORTHODOX" },
];

const FIGHTERS: PublicFighter[] = SEEDS.map((s, i) => ({
  id: `cf-${i + 1}`,
  userId: `cu-${i + 1}`,
  firstName: s.name[0],
  lastName: s.name[1],
  dateOfBirth: `${1996 + (i % 5)}-0${(i % 9) + 1}-1${i}`,
  nationality: "Việt Nam",
  weightClass: s.wc,
  heightCm: s.height,
  reachCm: s.height + 4,
  dominantStance: s.stance,
  leftArmCm: null,
  rightArmCm: null,
  leftLegCm: null,
  rightLegCm: null,
  gym: s.gym,
  currentMedicalStatus: s.status,
  bio: null,
  profileImageUrl: null,
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
}));

function fighterIndex(id: string): number {
  const i = FIGHTERS.findIndex((f) => f.id === id);
  if (i < 0) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy võ sĩ");
  return i;
}

const CONTEXTS: MeasurementContext[] = ["TRAINING", "WEIGH_IN", "CHECKUP", "SELF_REPORTED"];
function measurementsFor(index: number): FighterMeasurement[] {
  const base = SEEDS[index]!.base;
  return Array.from({ length: 12 }, (_, k) => {
    const back = (11 - k) * 3;
    const kg = Math.round((base + (11 - k) * 0.28 - (k % 3) * 0.1) * 10) / 10;
    return {
      id: `cm-${index}-${k}`,
      fighterId: `cf-${index + 1}`,
      recordedById: "cu-coach",
      measuredAt: day(-back, 7, 30),
      measurementContext: CONTEXTS[k % 4]!,
      weightKg: kg,
      heightCm: null,
      reachCm: null,
      notes: null,
      supersedesId: null,
      isSuperseded: false,
      createdAt: STAMP,
    };
  });
}

const SESSION_TYPES: SessionType[] = ["SPARRING", "PAD_WORK", "STRENGTH_CONDITIONING", "HEAVY_BAG", "RECOVERY", "GRAPPLING", "SHADOW_BOXING"];
const PLAN_IDS = ["cp-1", "cp-2", "cp-3", "cp-4"];

const SESSIONS: TrainingSession[] = [
  [-3, 17, "COMPLETED", 0], [-2, 6, "COMPLETED", 1], [-1, 18, "SKIPPED", 2], [0, 6, "IN_PROGRESS", 0],
  [0, 17, "SCHEDULED", 1], [0, 19, "SCHEDULED", 5], [1, 7, "SCHEDULED", 2], [1, 18, "SCHEDULED", 0],
  [2, 17, "SCHEDULED", 6], [3, 6, "CANCELLED", 1], [3, 18, "SCHEDULED", 3], [5, 17, "SCHEDULED", 0],
].map(([d, h, status, f], i) => {
  const type = SESSION_TYPES[i % SESSION_TYPES.length]!;
  const done = status === "COMPLETED";
  return {
    id: `cs-${i + 1}`,
    fighterId: `cf-${(f as number) + 1}`,
    coachId: "cc-1",
    planId: PLAN_IDS[(f as number) % 4] ?? null,
    title: ["Đối kháng kỹ thuật", "Đấm đích tốc độ", "Sức mạnh thân dưới", "Bao cát 5 hiệp", "Phục hồi nhẹ", "Vật nền cơ bản", "Đấm bóng"][i % 7]!,
    scheduledAt: day(d as number, h as number, 0),
    plannedDurationSec: 3600 + (i % 3) * 900,
    actualDurationSec: done ? 3480 : null,
    roundCount: 4 + (i % 4),
    location: ["Phòng tập A", "Sân sau", "Phòng tạ", "Phòng tập A"][i % 4]!,
    sessionType: type,
    status: status as SessionStatus,
    coachNotes: i % 2 === 0 ? "Chú ý giữ guard cao và xoay hông khi ra đòn. Kết thúc buổi bằng 10 phút giãn cơ." : null,
    cancellationReason: status === "CANCELLED" ? "Võ sĩ đang theo dõi y tế" : null,
    checkedInAt: done || status === "IN_PROGRESS" ? day(d as number, h as number, 5) : null,
    completedAt: done ? day(d as number, (h as number) + 1, 0) : null,
    abandonedAt: null,
    skippedAt: status === "SKIPPED" ? day(d as number, h as number, 0) : null,
    reportedRpe: done ? 7 : null,
    isActive: true,
    createdAt: STAMP,
    updatedAt: STAMP,
    deletedAt: null,
    cancelledAt: status === "CANCELLED" ? day(d as number, 8, 0) : null,
  };
});

const PLANS: TrainingPlan[] = [
  { id: "cp-1", f: 0, title: "Trại thi đấu Sài Gòn Open", phase: "fight_camp", status: "ACTIVE", pct: 62, total: 24, goals: "Giữ cân dưới giới hạn và tăng tốc độ đòn thẳng.", ms: [["Cân nặng dưới 70 kg", true], ["Hoàn thành 6 buổi đối kháng", true], ["Cân thử lần cuối", false]] },
  { id: "cp-2", f: 1, title: "Nâng sức bền 8 tuần", phase: "build", status: "ACTIVE", pct: 35, total: 20, goals: "Tăng sức bền hiếu khí, giảm thời gian hồi nhịp tim.", ms: [["Chạy 5 km dưới 25 phút", false]] },
  { id: "cp-3", f: 2, title: "Phục hồi sau chấn thương vai", phase: "rehab", status: "ACTIVE", pct: 80, total: 10, goals: "Lấy lại biên độ vai và sức mạnh cơ xoay.", ms: [["Tầm vận động đầy đủ", true], ["Tập sức mạnh nhẹ", true]] },
  { id: "cp-4", f: 5, title: "Xây nền tảng kỹ thuật", phase: "base", status: "COMPLETED", pct: 100, total: 12, goals: null, ms: [] },
].map((p) => ({
  id: p.id,
  fighterId: `cf-${p.f + 1}`,
  coachId: "cc-1",
  title: p.title,
  description: null,
  startDate: day(-40).slice(0, 10),
  endDate: day(p.status === "COMPLETED" ? -5 : 21).slice(0, 10),
  status: p.status as TrainingPlan["status"],
  phase: p.phase as TrainingPlan["phase"],
  goals: p.goals,
  milestones: p.ms.map(([title, done], i) => ({
    id: `${p.id}-m${i}`,
    title: title as string,
    isCompleted: done as boolean,
    completedAt: done ? day(-8 - i) : undefined,
    notes: null,
  })),
  isActive: p.status === "ACTIVE",
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
  progress: {
    totalSessions: p.total,
    completedSessions: Math.round((p.total * p.pct) / 100),
    completionPercentage: p.pct,
  },
}));

const EXERCISES: Exercise[] = [
  ["ex-1", "Đấm bóng 3 hiệp", "STRIKING"],
  ["ex-2", "Đấm đích theo cặp", "STRIKING"],
  ["ex-3", "Squat tạ đòn", "STRENGTH_CONDITIONING"],
  ["ex-4", "Chạy interval 400 m", "STRENGTH_CONDITIONING"],
  ["ex-5", "Giãn cơ và kéo giãn", "RECOVERY"],
  ["ex-6", "Vật nền cơ bản", "GRAPPLING"],
].map(([id, name, category]) => ({
  id: id!,
  name: name!,
  description: null,
  category: category as Exercise["category"],
  targetMuscleGroups: [],
  videoUrl: null,
  thumbnailUrl: null,
  isActive: true,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
}));

function planExercises(planId: string): TrainingPlanExercise[] {
  const n = Number(planId.slice(3)) || 1;
  return [0, 1, 2, 3].map((k) => ({
    id: `${planId}-e${k}`,
    planId,
    exerciseId: EXERCISES[(k + n) % EXERCISES.length]!.id,
    orderIndex: k,
    sets: [3, 4, 5, 3][k]!,
    reps: [null, 12, 8, 10][k] ?? null,
    durationSeconds: k === 0 ? 540 : null,
    targetRpe: [6, 7, 8, 5][k]!,
    coachNotes: k % 2 === 0 ? "Giữ nhịp thở đều, nghỉ 60 giây giữa các hiệp." : null,
    createdAt: STAMP,
  }));
}

function page<T>(rows: T[], q?: { page?: number; limit?: number }): Paginated<T> {
  const limit = q?.limit ?? 20;
  const p = q?.page ?? 1;
  const start = (p - 1) * limit;
  return { data: rows.slice(start, start + limit), total: rows.length, hasNextPage: start + limit < rows.length };
}

function inRange(iso: string, from?: string, to?: string): boolean {
  const t = Date.parse(iso);
  return (!from || t >= Date.parse(from)) && (!to || t <= Date.parse(to));
}

function sessionsFiltered(q: ListTrainingSessionsQuery & ListFighterSessionsQuery & { fighterId?: string }): TrainingSession[] {
  return SESSIONS.filter(
    (s) =>
      (!q.fighterId || s.fighterId === q.fighterId) &&
      (!q.status || s.status === q.status) &&
      (!q.sessionType || s.sessionType === q.sessionType) &&
      inRange(s.scheduledAt, q.fromDate, q.toDate),
  ).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}

function dossierFor(index: number): MedicalDossier {
  const status = SEEDS[index]!.status;
  const id = `cf-${index + 1}`;
  const bad = status === "NOT_CLEARED" || status === "INJURED";
  return {
    fighterId: id,
    activeInjuries: [],
    activeRecoveryPlans: [],
    currentExaminations: { training: null, competition: null },
    activeClearances: [],
    openReviewRequests: [],
    eligibility: {
      training: {
        scope: "TRAINING",
        eligible: !bad,
        reasons: status === "NOT_CLEARED" ? ["CLEARANCE_REQUIRED", "REVIEW_REQUEST_PENDING"] : status === "INJURED" ? ["EXAMINATION_NOT_ELIGIBLE"] : [],
      },
      competition: { scope: "COMPETITION", eligible: status === "HEALTHY", reasons: status === "HEALTHY" ? [] : ["CLEARANCE_REQUIRED"] },
    },
  };
}

function summaryFor(index: number): FighterMedicalSummary {
  const status = SEEDS[index]!.status;
  const id = `cf-${index + 1}`;
  const injured = status === "INJURED" || status === "RECOVERY";
  return {
    fighterId: id,
    currentMedicalStatus: status,
    activeClearance:
      status === "HEALTHY" || status === "MONITORING"
        ? { id: `cl-${index}`, clearanceType: "TRAINING", status: "ACTIVE", validFrom: day(-30), validUntil: day(status === "MONITORING" ? 6 : 75), notes: null }
        : null,
    activeInjuries: injured
      ? [
          {
            id: `ci-${index}`,
            affectedJoint: status === "INJURED" ? "RIGHT_KNEE" : "LEFT_SHOULDER",
            injuryType: status === "INJURED" ? "Căng dây chằng" : "Viêm gân",
            severity: status === "INJURED" ? "MODERATE" : "MINOR",
            status: status === "INJURED" ? "ACTIVE" : "RECOVERING",
            occurredAt: day(-12),
            description: null,
          },
        ]
      : [],
    jointStates: [],
    disclaimer: "",
  };
}

export const mockCoachApi = {
  async listFighters(q: ListFightersQuery = {}) {
    await wait();
    if (scenario() === "empty") return page<PublicFighter>([], q);
    const s = q.search?.trim().toLowerCase();
    const rows = FIGHTERS.filter(
      (f) =>
        (!q.weightClass || f.weightClass === q.weightClass) &&
        (!q.medicalStatus || f.currentMedicalStatus === q.medicalStatus) &&
        (!s || `${f.firstName} ${f.lastName}`.toLowerCase().includes(s)),
    );
    return page(rows, q);
  },
  async getFighter(id: string) {
    await wait();
    return FIGHTERS[fighterIndex(id)]!;
  },
  async listMeasurements(id: string, q: { page?: number; limit?: number } = {}) {
    await wait();
    if (scenario() === "empty") return page<FighterMeasurement>([], q);
    return page([...measurementsFor(fighterIndex(id))].reverse(), q);
  },
  async listCoaches(id: string): Promise<CoachAssignment[]> {
    await wait();
    fighterIndex(id);
    if (scenario() === "empty") return [];
    return [
      { id: `ca-${id}`, coachId: "cc-1", fighterId: id, assignedById: "cu-admin", startsAt: day(-120), endsAt: null, endedById: null, endReason: null, createdAt: STAMP, coachName: "Lê Hùng", coachGym: "CLB Sài Gòn Fight" },
    ];
  },
  async listFighterSessions(id: string, q: ListFighterSessionsQuery = {}) {
    await wait();
    fighterIndex(id);
    if (scenario() === "empty") return page<TrainingSessionSummary>([], q);
    return page(sessionsFiltered({ ...q, fighterId: id }) as TrainingSessionSummary[], q);
  },
  async getMedical(id: string) {
    await wait();
    return dossierFor(fighterIndex(id));
  },
  async getMedicalSummary(id: string) {
    await wait();
    return summaryFor(fighterIndex(id));
  },
  async listPlans(q: ListTrainingPlansQuery = {}) {
    await wait();
    if (scenario() === "empty") return page<TrainingPlan>([], q);
    const rows = PLANS.filter(
      (p) => (!q.fighterId || p.fighterId === q.fighterId) && (!q.status || p.status === q.status) && (q.isActive === undefined || p.isActive === q.isActive),
    );
    return page(rows, q);
  },
  async getPlan(id: string) {
    await wait();
    const found = PLANS.find((p) => p.id === id);
    if (!found) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy giáo án");
    return found;
  },
  async listPlanExercises(id: string) {
    await wait();
    return planExercises(id);
  },
  async listSessions(q: ListTrainingSessionsQuery = {}) {
    await wait();
    if (scenario() === "empty") return page<TrainingSession>([], q);
    return page(sessionsFiltered(q), q);
  },
  async getSession(id: string) {
    await wait();
    const found = SESSIONS.find((s) => s.id === id);
    if (!found) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy buổi tập");
    return found;
  },
  async listExercises(q: { page?: number; limit?: number } = {}) {
    await wait();
    return page(EXERCISES, q);
  },
};
