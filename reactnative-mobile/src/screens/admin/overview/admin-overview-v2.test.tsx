import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { PublicFighter, TrainingSession } from "@/api/types";
import { contrastRatio } from "@/theme/appearance/color-math";
import { palettes } from "@/theme/colors";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { AdminOverviewV2Screen } from "./admin-overview-v2-screen";
import { CHART_COLORS } from "./overview-colors";
import {
  attentionList,
  completionRate,
  groupTotals,
  legendGroups,
  medicalCounts,
  num,
  pct,
  relativeTime,
  sessionColumns,
  vnClock,
  vnDayStart,
  vnRange,
  weightCounts,
} from "./overview-data";

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { role: "ADMIN" } }) }));

const mockUsers = jest.fn();
const mockFighters = jest.fn(() => Promise.reject(new Error("Network request failed")));
jest.mock("@/api/admin", () => ({
  adminApi: {
    listUsers: (q: { role?: string; status?: string }) => mockUsers(q),
    unreadCount: () => Promise.resolve({ count: 0 }),
    listNotifications: () => Promise.resolve({ data: [], total: 0, hasNextPage: false }),
  },
}));
jest.mock("@/api/coach", () => ({
  coachApi: {
    listFighters: () => mockFighters(),
    listSessions: () => Promise.resolve({ data: [], total: 0, hasNextPage: false }),
  },
}));

// 2026-10-19 16:00 UTC = 23:00 thứ Hai giờ Việt Nam.
const NOW = Date.parse("2026-10-19T16:00:00Z");
const f = (status: PublicFighter["currentMedicalStatus"], wc: PublicFighter["weightClass"] = "LIGHTWEIGHT", id = Math.random().toString()) =>
  ({ id, firstName: "A", lastName: "B", currentMedicalStatus: status, weightClass: wc }) as PublicFighter;
const s = (dayOffset: number, status: TrainingSession["status"]) =>
  ({ scheduledAt: new Date(vnDayStart(dayOffset, NOW) + 10 * 3_600_000).toISOString(), status }) as TrainingSession;

describe("overview-data", () => {
  it("ngày theo giờ Việt Nam", () => {
    expect(new Date(vnDayStart(0, NOW)).toISOString()).toBe("2026-10-18T17:00:00.000Z");
    expect(vnRange(-6, 0, NOW)).toEqual({ fromDate: "2026-10-12T17:00:00.000Z", toDate: "2026-10-19T16:59:59.999Z" });
    expect(vnClock(NOW)).toBe("23:00");
  });

  it("đếm y tế, hạng cân (nhẹ → nặng, bỏ hạng 0) và danh sách cần chú ý", () => {
    const rows = [f("HEALTHY", "FLYWEIGHT"), f("INJURED"), f("NOT_CLEARED"), f("INJURED", "HEAVYWEIGHT")];
    expect(medicalCounts(rows)).toEqual({ HEALTHY: 1, MONITORING: 0, RECOVERY: 0, INJURED: 2, NOT_CLEARED: 1 });
    // Nhẹ → nặng theo enum, không theo số lượng.
    expect(weightCounts(rows)).toEqual([
      { weightClass: "FLYWEIGHT", count: 1 },
      { weightClass: "LIGHTWEIGHT", count: 2 },
      { weightClass: "HEAVYWEIGHT", count: 1 },
    ]);
    expect(attentionList(rows).map((r) => r.currentMedicalStatus)).toEqual(["INJURED", "INJURED", "NOT_CLEARED"]);
  });

  it("7 cột ngày qua, nhóm trạng thái và tỉ lệ hoàn thành", () => {
    const cols = sessionColumns([s(-6, "COMPLETED"), s(-1, "SKIPPED"), s(0, "SCHEDULED"), s(0, "CANCELLED"), s(-7, "COMPLETED"), s(1, "SCHEDULED")], NOW);
    expect(cols.map((c) => c.label)).toEqual(["T3", "T4", "T5", "T6", "T7", "CN", "T2"]);
    expect(cols[6]!.today).toBe(true);
    const t = groupTotals(cols);
    expect(t).toEqual({ done: 1, skipped: 1, abandoned: 0, cancelled: 1, inProgress: 0, planned: 1 });
    expect(completionRate(t)).toBe(33);
    expect(completionRate({ done: 0, skipped: 0, abandoned: 0, cancelled: 0, inProgress: 2, planned: 4 })).toBeNull();
    // "Bỏ dở" / "Đang tập" chỉ hiện khi > 0.
    expect(legendGroups(t)).toEqual(["done", "skipped", "cancelled", "planned"]);
    expect(legendGroups({ ...t, abandoned: 1, inProgress: 2 })).toEqual(["done", "skipped", "abandoned", "cancelled", "inProgress", "planned"]);
    expect(completionRate({ done: 1, skipped: 0, abandoned: 1, cancelled: 0, inProgress: 0, planned: 0 })).toBe(50);
  });

  it("định dạng số, phần trăm, thời gian tương đối", () => {
    expect(num(1234)).toBe("1.234");
    expect(pct(1, 3)).toBe(33);
    expect(pct(1, 0)).toBe(0);
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 phút trước");
    expect(relativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3 giờ trước");
    expect(relativeTime(new Date(vnDayStart(-1, NOW) + 3_600_000).toISOString(), NOW)).toBe("Hôm qua");
  });
});

describe("màu biểu đồ", () => {
  it("đồ họa ≥ 3:1 với nền thẻ ở sáng và tối", () => {
    for (const scheme of ["light", "dark"] as const) {
      const c = CHART_COLORS[scheme];
      const surface = palettes[scheme].surface;
      const all = [...Object.values(c.medical), ...Object.values(c.session), c.weight, ...Object.values(c.role)];
      for (const color of all) expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("AdminOverviewV2Screen", () => {
  it("mỗi khối tải riêng: khối võ sĩ lỗi có 'Thử lại', khối người dùng vẫn hiện số; số 0 hiện '0'", async () => {
    mockUsers.mockImplementation((q: { role?: string; status?: string }) =>
      Promise.resolve({ items: [], total: q.role === "FIGHTER" ? 4 : q.role ? 1 : q.status === "INACTIVE" ? 2 : q.status ? 6 : 8, page: 1, limit: 1 }),
    );
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ThemePreferenceProvider>
          <AdminOverviewV2Screen />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await screen.findByLabelText("Người dùng: 8")).toBeTruthy();
    expect(await screen.findByText("Đã khóa 2")).toBeTruthy();
    expect(screen.getByLabelText("Thông báo chưa đọc: 0")).toBeTruthy();
    expect(screen.getAllByText("Không tải được dữ liệu").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Thử lại").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Cần chú ý")).toBeNull();
    expect(await screen.findByText("Chưa có buổi tập nào trong 7 ngày qua")).toBeTruthy();
    expect(screen.getByText("Chưa có thông báo")).toBeTruthy();
  });

  it("Cần chú ý: tối đa 5 tên, chip 'Chưa cho phép', nút theo trạng thái ẩn khi bằng 0", async () => {
    mockUsers.mockImplementation(() => Promise.resolve({ items: [], total: 1, page: 1, limit: 1 }));
    const rows = Array.from({ length: 6 }, (_, i) => ({ ...f(i === 5 ? "NOT_CLEARED" : "INJURED", "LIGHTWEIGHT", `x${i}`), firstName: `Tên${i}`, lastName: "Võ" }));
    mockFighters.mockImplementation(() => Promise.resolve({ data: rows, total: rows.length, hasNextPage: false }) as never);
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ThemePreferenceProvider>
          <AdminOverviewV2Screen />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await screen.findByText("Chấn thương (5)")).toBeTruthy();
    expect(screen.getByText("Chưa cho phép (1)")).toBeTruthy();
    expect(screen.queryByText("Xem tất cả")).toBeNull();
    expect(screen.getAllByLabelText(/^Tên\d Võ, /)).toHaveLength(5);
    expect(screen.queryByText("Chưa đủ điều kiện")).toBeNull();
  });
});
