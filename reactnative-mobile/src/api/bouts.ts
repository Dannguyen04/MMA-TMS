import { ApiError } from "./errors";
import { createFighterMeasurement } from "./fighters";
import { mockAppendWeight, mockBoutsApi } from "./bouts.mock";
import { campApi, type CampBout, type CampDetail } from "./fight-camp";

/**
 * Compatibility adapter for existing home cards. New Fight Camp screens consume
 * the verified wire contract in fight-camp.ts directly. Real API is the default.
 */

export const BOUT_STATES = [
  "SCHEDULED",
  "CAMP",
  "FIGHT_WEEK",
  "WEIGHED_IN",
  "COMPLETED",
  "CANCELLED",
] as const;
export type BoutState = (typeof BOUT_STATES)[number];

/** Trận còn "đang hoạt động" với võ sĩ (chưa thi đấu / chưa hủy). */
export const ACTIVE_BOUT_STATES: readonly BoutState[] = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];

export const REQUIREMENT_STATUSES = ["MISSING", "PROVIDED", "REJECTED", "CONFIRMED"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_KINDS = ["MEDICAL_CLEARANCE", "BLOOD_TEST", "SIGNED_CONTRACT", "WEIGH_IN"] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export type BoutRequirement = {
  id: string;
  kind: RequirementKind;
  status: RequirementStatus;
  updatedAt: string | null;
};

export type Bout = {
  id: string;
  status: BoutState;
  eventName: string;
  opponentName: string;
  venue: string;
  /** ISO — giờ thi đấu. */
  scheduledAt: string;
  /** ISO — giờ cân chính thức. */
  weighInAt: string;
  /** Giới hạn cân của trận (kg). */
  limitKg: number;
  /** Tên hạng cân (tùy chọn); chưa có thì chỉ hiện giới hạn kg. */
  weightClassName?: string;
  requirements: BoutRequirement[];
};

export const WEIGHT_TRACK_STATUSES = ["GREEN", "YELLOW", "RED", "GREY", "NEUTRAL"] as const;
export type WeightTrackStatus = (typeof WEIGHT_TRACK_STATUSES)[number];

export type WeightTrackPoint = {
  id: string;
  weightKg: number;
  /** ISO */
  measuredAt: string;
};

export type WeightTrack = {
  boutId: string;
  limitKg: number;
  points: WeightTrackPoint[];
  latestKg: number | null;
  /** ISO của lần cân gần nhất. */
  latestOn: string | null;
  /** % cân nặng còn phải giảm để chạm giới hạn (0 khi đã đạt). */
  remainingPct: number | null;
  status: WeightTrackStatus;
  /** Đường giảm cân dự kiến từ đầu trại tới ngày cân. */
  referencePath: { on: string; kg: number }[];
};

export interface BoutsApi {
  listBouts(): Promise<Bout[]>;
  getBout(boutId: string): Promise<Bout>;
  getWeightTrack(boutId: string): Promise<WeightTrack>;
}

/** Mock is opt-in and never silently substitutes a failed authenticated request. */
export const USE_MOCK_BOUTS = process.env.EXPO_PUBLIC_BOUTS_MOCK === "true";

function mapBout(b: CampBout | CampDetail): Bout {
  return { id: b.id, status: b.status, eventName: b.eventName, opponentName: b.opponentName || "Chưa xác định", venue: b.venue || "Chưa xác định", scheduledAt: b.boutAt, weighInAt: b.weighInAt, limitKg: b.catchweightKg ?? b.weightLimitKg, requirements: [] };
}

const realBoutsApi: BoutsApi = {
  listBouts: async () => {
    const bouts: Bout[] = []; let cursor: string | undefined;
    do { const page = await campApi.list({ limit: 100, cursor }); bouts.push(...page.data.map(mapBout)); cursor = page.hasNextPage ? page.nextCursor ?? undefined : undefined; } while (cursor);
    return bouts;
  },
  getBout: async id => mapBout(await campApi.detail(id)),
  getWeightTrack: async id => {
    const track = await campApi.weightTrack(id);
    const status: WeightTrackStatus = ({ ON_TRACK: "GREEN", ABOVE_TARGET: "YELLOW", OVER_LIMIT: "RED", NOT_WEIGHED: "GREY", NEUTRAL: "NEUTRAL" } as const)[track.status];
    const limitKg = track.limitKg ?? (await campApi.detail(id)).weightLimitKg;
    return { boutId: id, ...track, status, limitKg, points: track.points.map((p, i) => ({ id: `${p.date}-${i}`, weightKg: p.kg, measuredAt: `${p.date}T12:00:00+07:00` })), referencePath: track.referencePath.map(p => ({ on: p.date, kg: p.kg })) };
  },
};

export const boutsApi: BoutsApi = USE_MOCK_BOUTS ? mockBoutsApi : realBoutsApi;

export const listBouts = () => boutsApi.listBouts();
export const getBout = (boutId: string) => boutsApi.getBout(boutId);
export const getWeightTrack = (boutId: string) => boutsApi.getWeightTrack(boutId);

/** Trận đang hoạt động gần nhất: trạng thái SCHEDULED/CAMP/FIGHT_WEEK/WEIGHED_IN, theo giờ cân tăng dần. */
export function pickActiveBout(bouts: readonly Bout[]): Bout | null {
  const active = bouts
    .filter((bout) => ACTIVE_BOUT_STATES.includes(bout.status))
    .sort((a, b) => Date.parse(a.weighInAt) - Date.parse(b.weighInAt));
  return active[0] ?? null;
}

/**
 * Ghi cân tự khai.
 * - Có id võ sĩ thật: gọi `createFighterMeasurement` (API thật). Lỗi (vd 403) được ném ra cho màn hình.
 * - Chế độ xem thử (không có id thật): chỉ ghi vào dữ liệu giả lập tại chỗ.
 * - Khi trận đang là dữ liệu giả lập, số cân cũng được thêm vào đường cân giả lập để màn hình cập nhật.
 */
export async function recordWeight(input: {
  fighterId: string | null;
  boutId: string;
  weightKg: number;
}): Promise<void> {
  const { fighterId, boutId, weightKg } = input;
  if (fighterId) {
    await createFighterMeasurement(fighterId, { weightKg, measurementContext: "SELF_REPORTED" });
    if (USE_MOCK_BOUTS) mockAppendWeight(boutId, weightKg, { checkScenario: false });
    return;
  }
  if (!USE_MOCK_BOUTS) throw new ApiError(0, "NOT_IMPLEMENTED", "Không có hồ sơ võ sĩ");
  mockAppendWeight(boutId, weightKg, { checkScenario: true });
}
