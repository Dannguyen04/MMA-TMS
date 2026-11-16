import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { PublicFighter } from "@/api/types";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { doctorAiListHref, doctorVideoHref } from "./doctor-paths";

const mockPush = jest.fn();
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Redirect: (p: { href: unknown }) => { mockRedirect(p.href); return null; },
}));
jest.mock("@/screens/media/evidence/evidence-route", () => ({ EvidenceRoute: (p: { params: unknown }) => { mockRedirect({ evidence: p.params }); return null; } }));
jest.mock("@/screens/doctor/today/doctor-bell", () => ({ DoctorBell: () => null }));
jest.mock("@/screens/video-ai/ai-data", () => ({ useAiEnabled: () => true }));
jest.mock("@/screens/video-ai/doctor-ai-alerts", () => ({
  useImpairments: () => ({
    data: [{ jobId: "j1", videoId: "v1", fighterId: "f1", joint: "RIGHT_KNEE", severity: "high", count: 2, createdAt: "2026-11-10T03:00:00Z" }],
    loading: false, error: "", reload: jest.fn(), refresh: jest.fn(),
  }),
}));
const fighters = [
  { id: "f1", firstName: "Lucas", lastName: "Ferreira", weightClass: "WELTERWEIGHT", currentMedicalStatus: "INJURED" },
  { id: "f2", firstName: "An", lastName: "Nguyễn", weightClass: "LIGHTWEIGHT", currentMedicalStatus: "CLEARED" },
] as PublicFighter[];
jest.mock("@/screens/doctor/redesign/doctor-roster", () => ({
  useDoctorRoster: () => ({ items: mockFighters, loaded: true, loading: false, error: "", enabled: true, refresh: jest.fn(), reload: jest.fn() }),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFighters: any = fighters;

const wrap = (el: React.ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <ThemePreferenceProvider>{el}</ThemePreferenceProvider>
  </SafeAreaProvider>,
);

beforeEach(() => {
  mockPush.mockClear();
  mockRedirect.mockClear();
  mockParams = {};
});

describe("doctor paths (step 21)", () => {
  it("one video page for every AI row", () => {
    expect(doctorVideoHref("j1")).toEqual({ pathname: "/(doctor)/ai-alerts/xem", params: { jobId: "j1" } });
    expect(doctorVideoHref("j1", "v1")).toEqual({ pathname: "/(doctor)/ai-alerts/xem", params: { id: "v1", jobId: "j1" } });
    expect(doctorAiListHref("f1")).toEqual(expect.objectContaining({ pathname: "/(doctor)/vo-si", params: expect.objectContaining({ seg: "ai", fighterId: "f1" }) }));
  });

  it("old routes redirect to the video page or the AI tab", async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const Index = require("@/app/(doctor)/ai-alerts/index").default;
    const Job = require("@/app/(doctor)/ai-alerts/[jobId]").default;
    const Video = require("@/app/(doctor)/vo-si/video").default;
    const Xem = require("@/app/(doctor)/ai-alerts/xem").default;
    /* eslint-enable @typescript-eslint/no-require-imports */
    await render(<Index/>);
    expect(mockRedirect).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: "/(doctor)/vo-si", params: expect.objectContaining({ seg: "ai" }) }));
    mockParams = { jobId: "j9" };
    await render(<Job/>);
    expect(mockRedirect).toHaveBeenLastCalledWith(doctorVideoHref("j9"));
    mockParams = { id: "v2", job: "j2" };
    await render(<Video/>);
    expect(mockRedirect).toHaveBeenLastCalledWith(doctorVideoHref("j2", "v2"));
    mockParams = { id: "v2", job: "j2" };
    await render(<Xem/>);
    expect(mockRedirect).toHaveBeenLastCalledWith({ evidence: { id: "v2", jobId: "j2" } });
    mockParams = {};
    await render(<Xem/>);
    expect(mockRedirect).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: "/(doctor)/vo-si" }));
  });
});

describe("DoctorFightersScreen (step 21)", () => {
  it("rows per fighter, status chips filter on tap, AI tab rows open the video page", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DoctorFightersScreen } = require("./doctor-fighters-screen");
    await wrap(<DoctorFightersScreen/>);
    expect(screen.getByTestId("doctor-fighter-f1")).toBeTruthy();
    expect(screen.getByTestId("doctor-fighter-f2")).toBeTruthy();
    // Status is a field that opens a sheet (step 25 sweep): open it, then pick Cần chú ý.
    await fireEvent.press(screen.getByTestId("filter-status"));
    await fireEvent.press(screen.getByTestId("filter-status-opt-attention"));
    expect(screen.queryByTestId("doctor-fighter-f2")).toBeNull();
    await fireEvent.press(screen.getByTestId("doctor-fighter-f1"));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/(doctor)/vo-si/chi-tiet", params: { id: "f1" } });

    await fireEvent.press(screen.getByLabelText("Cảnh báo AI, 1 cảnh báo"));
    expect(screen.getByText("2 cảnh báo", { exact: false })).toBeTruthy();
    expect(screen.getByText("Kết quả AI chỉ để tham khảo.")).toBeTruthy();
    expect(screen.getByText("Quyết định y tế do bác sĩ đưa ra.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("doctor-ai-j1"));
    expect(mockPush).toHaveBeenLastCalledWith(doctorVideoHref("j1", "v1"));
  });
});
