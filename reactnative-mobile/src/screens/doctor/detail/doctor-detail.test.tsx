import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiError } from "@/api/errors";
import type { MedicalHistoryEntry, PublicFighter } from "@/api/types";
import { doctorRo } from "@/i18n/doctor-ro";
import { mapFighterError } from "@/screens/fighter/errors";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { DECISION_CHIP, detailError, expiresSoon, groupByMonth, headerFacts, historyDot, historySummary, planProgress, planStatusText, severityText } from "./detail-format";
import { badgeLabel } from "./detail-ui";

const t = doctorRo.detail2;

const huy = {
  id: "cf-4", firstName: "Huy", lastName: "Phạm", weightClass: "WELTERWEIGHT", currentMedicalStatus: "INJURED",
  dateOfBirth: "2002-03-01", heightCm: 179, reachCm: 183, dominantStance: "ORTHODOX", nationality: "Việt Nam", gym: "Phòng tập Quận 7",
} as PublicFighter;

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("@/components/body3d/body-canvas", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: "cf-4" }),
}));
jest.mock("@/api/doctor-ro", () => ({ doctorRoApi: jest.requireActual("@/api/doctor-ro.mock").mockDoctorRoApi }));
jest.mock("@/screens/doctor/redesign/doctor-roster", () => ({
  useDoctorRoster: () => ({ items: [mockHuy], loaded: true, loading: false, error: "", enabled: true, refresh: jest.fn(), reload: jest.fn() }),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockHuy: any = huy;

describe("doctor detail format", () => {
  it("đầu hồ sơ: tuổi · cao · tầm với · thế đứng; bỏ mục thiếu", () => {
    const f = headerFacts(huy, new Date("2026-10-20"));
    const N = "\u00A0";
    expect(f.line).toBe(`24${N}tuổi${N}· 179${N}cm${N}· Tầm${N}với${N}183${N}cm${N}· Thuận${N}phải`);
    // chỉ còn khoảng trắng thường sau dấu "·" → chỉ ngắt dòng tại đó
    expect(f.line.split(" ").length).toBe(4);
    expect(f.line.replace(/\u00A0/g, " ")).toBe("24 tuổi · 179 cm · Tầm với 183 cm · Thuận phải");
    expect(f.nationality).toBe("Việt Nam");
    expect(headerFacts({ ...huy, reachCm: null, dominantStance: null, nationality: null }, new Date("2026-10-20"))).toEqual({ line: "24\u00A0tuổi\u00A0· 179\u00A0cm", nationality: "" });
  });

  it("403 → câu không còn phụ trách; lỗi khác giữ nguyên", () => {
    expect(detailError(mapFighterError(new ApiError(403, "FORBIDDEN", "")))).toBe(t.forbidden);
    const net = mapFighterError(new ApiError(0, "NETWORK_ERROR", ""));
    expect(detailError(net)).toBe(net);
  });

  it("snapshot camelCase (và snake_case cũ) tóm tắt thành chữ tiếng Việt", () => {
    const e = { recordType: "INJURY", snapshot: { affectedJoint: "RIGHT_KNEE", injuryType: "Căng dây chằng", severity: "MODERATE", status: "ACTIVE" } } as unknown as MedicalHistoryEntry;
    expect(historySummary(e)).toBe("Gối phải · Căng dây chằng · Trung bình · Đang chấn thương");
    const plan = { recordType: "RECOVERY_PLAN", snapshot: { title: "Phục hồi", status: "ACTIVE" } } as unknown as MedicalHistoryEntry;
    expect(historySummary(plan)).toBe("Phục hồi · Đang áp dụng");
    const old = { recordType: "MEDICAL_CLEARANCE", snapshot: { clearance_type: "TRAINING", status: "REVOKED" } } as unknown as MedicalHistoryEntry;
    expect(historySummary(old)).toBe("Tập luyện · Đã thu hồi");
  });

  it("tiến độ phục hồi, sắp hết hạn, nhóm theo tháng", () => {
    expect(planProgress({ milestones: [{ isCompleted: true }, { isCompleted: false }] } as never)).toEqual({ done: 1, total: 2, pct: 50 });
    const now = new Date("2026-10-20T00:00:00Z");
    expect(expiresSoon("2026-10-25T00:00:00Z", now)).toBe(true);
    expect(expiresSoon("2026-12-25T00:00:00Z", now)).toBe(false);
    expect(expiresSoon(null, now)).toBe(false);
    const g = groupByMonth(["2026-10-18T05:00:00Z", "2026-10-02T05:00:00Z", "2026-09-30T05:00:00Z"], (s) => s);
    expect(g.map((x) => [x.label, x.rows.length])).toEqual([["Tháng 10/2026", 2], ["Tháng 9/2026", 1]]);
  });
});

function renderScreen() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DoctorFighterDetailScreen } = require("@/screens/doctor/redesign/doctor-fighter-detail-screen");
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>
        <DoctorFighterDetailScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("doctor detail fix1", () => {
  it("chấm Hồ sơ theo loại; giấy phép thu hồi = đỏ", () => {
    const h = (recordType: string, snapshot = {}) => ({ recordType, snapshot }) as unknown as MedicalHistoryEntry;
    expect(historyDot(h("MEDICAL_REVIEW_REQUEST"))).toBe("attention");
    expect(historyDot(h("INJURY"))).toBe("danger");
    expect(historyDot(h("RECOVERY_PLAN"))).toBe("info");
    expect(historyDot(h("TREATMENT"))).toBe("info");
    expect(historyDot(h("MEDICAL_EXAMINATION"))).toBe("muted");
    expect(historyDot(h("MEDICAL_CLEARANCE", { status: "ACTIVE" }))).toBe("success");
    expect(historyDot(h("MEDICAL_CLEARANCE", { status: "REVOKED" }))).toBe("danger");
  });
  it("badge 9+, nhãn riêng của Doctor", () => {
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(12)).toBe("9+");
    expect(DECISION_CHIP.NOT_ELIGIBLE.label).toBe("Không đạt");
    expect(planStatusText("ACTIVE")).toBe("Đang áp dụng");
    expect(severityText("MODERATE")).toBe("Trung bình");
    expect(severityText("MINOR")).toBe("Nhẹ");
  });
});

describe("DoctorFighterDetailScreen", () => {
  afterEach(() => {
    delete (globalThis as { __DOCTOR_MOCK_SCENARIO__?: string }).__DOCTOR_MOCK_SCENARIO__;
  });

  it("Tổng quan: đầu hồ sơ + các thẻ; badge Khám; chuyển tab Khám và Hồ sơ", async () => {
    const s = await renderScreen();
    expect(s.getByText("Huy Phạm")).toBeTruthy();
    expect(s.getByText(/179[\s\u00A0]cm[\s\u00A0]· Tầm[\s\u00A0]với[\s\u00A0]183[\s\u00A0]cm[\s\u00A0]· Thuận[\s\u00A0]phải/)).toBeTruthy();
    expect(await s.findByText(t.injuries, {}, { timeout: 3000 })).toBeTruthy();
    expect(await s.findByText("Căng dây chằng · Gối phải")).toBeTruthy();
    expect(s.getByText("Phục hồi gối phải – giai đoạn 1")).toBeTruthy();
    expect(s.getByText(t.noClearance)).toBeTruthy();
    expect(await s.findByText("Lan Phạm", {}, { timeout: 3000 })).toBeTruthy();
    expect(s.queryByText("Vũ Thanh Bình")).toBeNull();
    expect(s.getByLabelText(t.tabBadge(t.tabs.exams, 1))).toBeTruthy();

    await fireEvent.press(s.getByLabelText(t.tabBadge(t.tabs.exams, 1)));
    expect(await s.findByText("Khám tập luyện · Lần 3", {}, { timeout: 3000 })).toBeTruthy();
    expect(s.getByText("Khám thi đấu · Lần 2")).toBeTruthy();
    await fireEvent.press(s.getByText("Thi đấu"));
    expect(await s.findByText("Khám thi đấu · Lần 2", {}, { timeout: 3000 })).toBeTruthy();
    await s.findByText(t.filterAll);

    await fireEvent.press(s.getByText(t.tabs.history));
    expect((await s.findAllByText(/Tháng \d+\/2026/, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(s.getByText("Gối phải · Căng dây chằng · Trung bình · Đang chấn thương", { exact: false })).toBeTruthy();
  });

  it("Video AI: cảnh báo nhóm theo khớp + câu tham khảo; chỉ của võ sĩ này", async () => {
    const s = await renderScreen();
    await s.findByText(t.injuries, {}, { timeout: 3000 });
    await fireEvent.press(s.getByText("Video AI"));
    expect(await s.findByText("Gối phải · 2 cảnh báo", {}, { timeout: 3000 })).toBeTruthy();
    expect(s.getByText("Vai trái · 1 cảnh báo")).toBeTruthy();
    expect(s.queryByText(/Cổ chân trái/)).toBeNull();
    expect(s.getByText("Kết quả AI chỉ để tham khảo, quyết định y tế do bác sĩ đưa ra.")).toBeTruthy();
    expect(s.queryByText(/Phân tích lại/)).toBeNull();
  });

  it("403: từng thẻ báo không còn phụ trách", async () => {
    (globalThis as { __DOCTOR_MOCK_SCENARIO__?: string }).__DOCTOR_MOCK_SCENARIO__ = "forbidden";
    const s = await renderScreen();
    expect((await s.findAllByText(t.forbidden, {}, { timeout: 3000 })).length).toBe(2);
  });

  it("rỗng: câu trống từng thẻ", async () => {
    (globalThis as { __DOCTOR_MOCK_SCENARIO__?: string }).__DOCTOR_MOCK_SCENARIO__ = "empty";
    const s = await renderScreen();
    expect(await s.findByText(t.noInjuries, {}, { timeout: 3000 })).toBeTruthy();
    expect(await s.findByText(t.noDoctors, {}, { timeout: 3000 })).toBeTruthy();
  });
});
