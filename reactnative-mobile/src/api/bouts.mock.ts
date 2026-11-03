import { ApiError } from "./errors";
import type {
  Bout,
  BoutRequirement,
  BoutsApi,
  RequirementKind,
  RequirementStatus,
  WeightTrack,
  WeightTrackPoint,
  WeightTrackStatus,
} from "./bouts";

/**
 * Dữ liệu giả lập cho trận đấu / đường cân. Mọi mốc thời gian tính từ lúc tải
 * (giờ Việt Nam, 07:00) để màn hình luôn có trận sắp tới.
 *
 * Kịch bản kiểm thử (chỉ dev): đặt `globalThis.__BOUTS_MOCK_SCENARIO__` =
 * "empty" (không có trận), "forbidden" (ghi cân bị 403), "offline" (mất mạng),
 * "slow" (chậm ~2,5 giây để thấy skeleton), "ontrack" (cân dưới hạng, không vượt) hoặc
 * "classname" (trận có tên hạng cân).
 */

const DAY = 86_400_000;
const LATENCY_MS = 450;
const SLOW_LATENCY_MS = 2500;

type Scenario = "normal" | "empty" | "forbidden" | "offline" | "slow" | "ontrack" | "classname";

function scenario(): Scenario {
  const value = (globalThis as { __BOUTS_MOCK_SCENARIO__?: string }).__BOUTS_MOCK_SCENARIO__;
  return value === "empty" || value === "forbidden" || value === "offline" || value === "slow" || value === "ontrack" || value === "classname"
    ? value
    : "normal";
}

/** 07:00 giờ VN (00:00 UTC) của ngày cách hôm nay `days` ngày. */
function vnMorning(days: number): number {
  const vnNow = new Date(Date.now() + 7 * 3_600_000);
  // Date.UTC(ngày VN) = 00:00 UTC cùng ngày lịch = 07:00 giờ VN.
  return Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate()) + days * DAY;
}

function req(boutId: string, kind: RequirementKind, status: RequirementStatus, daysAgo: number | null): BoutRequirement {
  return {
    id: `${boutId}-${kind}`,
    kind,
    status,
    updatedAt: daysAgo == null ? null : new Date(vnMorning(-daysAgo)).toISOString(),
  };
}

type Store = { bouts: Bout[]; points: Record<string, WeightTrackPoint[]> };
let store: Store | null = null;

function ensureStore(): Store {
  if (store) return store;
  const main = "bout-mock-main";
  const next = "bout-mock-next";
  const past = "bout-mock-past";
  const weighIn = vnMorning(9) + 3 * 3_600_000;
  const bouts: Bout[] = [
    {
      id: main,
      status: "CAMP",
      eventName: "Giải MMA Sài Gòn Open",
      opponentName: "Nguyễn Minh Khang",
      venue: "Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh",
      scheduledAt: new Date(vnMorning(10) + 11 * 3_600_000).toISOString(),
      weighInAt: new Date(weighIn).toISOString(),
      limitKg: 65.8,
      requirements: [
        req(main, "MEDICAL_CLEARANCE", "CONFIRMED", 12),
        req(main, "BLOOD_TEST", "PROVIDED", 3),
        req(main, "SIGNED_CONTRACT", "REJECTED", 1),
        req(main, "WEIGH_IN", "MISSING", null),
      ],
    },
    {
      id: next,
      status: "SCHEDULED",
      eventName: "Đêm võ đài Đà Nẵng",
      opponentName: "Trần Quốc Bảo",
      venue: "Cung thể thao Tiên Sơn, Đà Nẵng",
      scheduledAt: new Date(vnMorning(51) + 12 * 3_600_000).toISOString(),
      weighInAt: new Date(vnMorning(50) + 3 * 3_600_000).toISOString(),
      limitKg: 70.3,
      requirements: [
        req(next, "MEDICAL_CLEARANCE", "MISSING", null),
        req(next, "SIGNED_CONTRACT", "PROVIDED", 2),
        req(next, "WEIGH_IN", "MISSING", null),
      ],
    },
    {
      id: past,
      status: "COMPLETED",
      eventName: "Giải Hà Nội Fight Night",
      opponentName: "Lê Hoàng Phúc",
      venue: "Nhà thi đấu Quân khu 7, Hà Nội",
      scheduledAt: new Date(vnMorning(-40) + 11 * 3_600_000).toISOString(),
      weighInAt: new Date(vnMorning(-41) + 3 * 3_600_000).toISOString(),
      limitKg: 65.8,
      requirements: [req(past, "WEIGH_IN", "CONFIRMED", 41)],
    },
  ];
  // Đường cân thực tế: bắt đầu trại 71,0 kg, đang chậm hơn dự kiến một chút.
  const actual: [number, number][] = [
    [-27, 71.0],
    [-24, 70.6],
    [-21, 70.5],
    [-18, 70.1],
    [-15, 69.9],
    [-12, 69.6],
    [-9, 69.3],
    [-6, 69.0],
    [-3, 68.7],
    [-1, 68.5],
  ];
  const points: Record<string, WeightTrackPoint[]> = {
    [main]: actual.map(([d, kg], i) => ({
      id: `${main}-p${i}`,
      weightKg: kg,
      measuredAt: new Date(vnMorning(d)).toISOString(),
    })),
    [next]: [],
    [past]: [],
  };
  store = { bouts, points };
  return store;
}

function referencePathFor(bout: Bout): { on: string; kg: number }[] {
  const end = Date.parse(bout.weighInAt);
  const start = end - 30 * DAY;
  const startKg = 71.0;
  return [0, 10, 20, 30].map((d) => {
    const t = start + d * DAY;
    const kg = startKg + ((bout.limitKg - startKg) * d) / 30;
    return { on: new Date(t).toISOString(), kg: Math.round(kg * 10) / 10 };
  });
}

function expectedAt(path: { on: string; kg: number }[], at: number): number {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return 0;
  if (at <= Date.parse(first.on)) return first.kg;
  if (at >= Date.parse(last.on)) return last.kg;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const ta = Date.parse(a.on);
    const tb = Date.parse(b.on);
    if (at <= tb) return a.kg + ((b.kg - a.kg) * (at - ta)) / (tb - ta);
  }
  return last.kg;
}

/** Quy tắc giả lập: đạt giới hạn → GREEN; lệch ≤0,5 kg so với đường dự kiến → GREEN; ≤1,5 → YELLOW; còn lại RED. */
function buildTrack(bout: Bout, points: WeightTrackPoint[]): WeightTrack {
  const sorted = [...points].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
  const latest = sorted[sorted.length - 1] ?? null;
  const referencePath = referencePathFor(bout);
  let status: WeightTrackStatus = "GREY";
  let remainingPct: number | null = null;
  if (latest) {
    remainingPct = Math.max(0, Math.round(((latest.weightKg - bout.limitKg) / latest.weightKg) * 1000) / 10);
    const delta = latest.weightKg - expectedAt(referencePath, Date.parse(latest.measuredAt));
    status = latest.weightKg <= bout.limitKg || delta <= 0.5 ? "GREEN" : delta <= 1.5 ? "YELLOW" : "RED";
  }
  return {
    boutId: bout.id,
    limitKg: bout.limitKg,
    points: sorted,
    latestKg: latest?.weightKg ?? null,
    latestOn: latest?.measuredAt ?? null,
    remainingPct,
    status,
    referencePath: latest || bout.status !== "COMPLETED" ? referencePath : [],
  };
}

/** Kịch bản "classname": trận chính có tên hạng cân (các trận khác để trống). */
function shown(bout: Bout): Bout {
  const copy = { ...bout, requirements: [...bout.requirements] };
  if (scenario() === "classname" && bout.id === "bout-mock-main") copy.weightClassName = "lông";
  return copy;
}

const wait = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, scenario() === "slow" ? SLOW_LATENCY_MS : LATENCY_MS));
  if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
};

export const mockBoutsApi: BoutsApi = {
  async listBouts() {
    await wait();
    if (scenario() === "empty") return [];
    return ensureStore().bouts.map(shown);
  },
  async getBout(boutId) {
    await wait();
    const found = scenario() === "empty" ? null : ensureStore().bouts.find((bout) => bout.id === boutId);
    if (!found) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy trận");
    return shown(found);
  },
  async getWeightTrack(boutId) {
    await wait();
    const s = ensureStore();
    const bout = s.bouts.find((item) => item.id === boutId);
    if (!bout) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy trận");
    const points = s.points[boutId] ?? [];
    // "ontrack": cùng đường cân nhưng thấp hơn hạng cân (không vượt).
    const shown =
      scenario() === "ontrack"
        ? points.map((p) => ({ ...p, weightKg: Math.round((p.weightKg - 3.3) * 10) / 10 }))
        : points;
    return buildTrack(bout, shown);
  },
};

/** Thêm một số cân vào đường cân giả lập. */
export function mockAppendWeight(boutId: string, weightKg: number, opts: { checkScenario: boolean }): void {
  if (opts.checkScenario && scenario() === "forbidden") {
    throw new ApiError(403, "FORBIDDEN", "Forbidden");
  }
  const s = ensureStore();
  const list = (s.points[boutId] ??= []);
  list.push({ id: `${boutId}-p${list.length}-${Date.now()}`, weightKg, measuredAt: new Date().toISOString() });
}
