import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachFighters as t } from "@/i18n/coach-fighters";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

const mockParams: Record<string, string> = { id: "cf-4" };
const mockPush = jest.fn();
const mockCreate = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("@/components/body3d/body-canvas", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/api/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach.mock").mockCoachApi }));
jest.mock("@/api/video-ai", () => ({ USE_MOCK_VIDEO_AI: true, videoAiApi: jest.requireActual("@/api/video-ai.mock").mockVideoAiApi }));
jest.mock("@/api/media", () => ({
  listVideos: jest.fn(() => Promise.resolve({ data: [], total: 2, hasNextPage: false })),
  listAnalysisJobs: jest.fn(() => Promise.resolve([])),
}));
jest.mock("@/api/medical", () => ({
  listFighterDoctors: jest.fn(() => Promise.resolve({ data: [], total: 0, hasNextPage: false })),
  listFighterMedicalHistory: jest.fn(() => Promise.resolve({ data: [], total: 0, hasNextPage: false })),
  listFighterMedicalExaminations: jest.fn(() => Promise.resolve({ data: [], total: 0, hasNextPage: false })),
  listFighterReviewRequests: jest.fn(() => Promise.resolve({
    data: [{ id: "rr-1", fighterId: "cf-4", reason: "Đau cổ tay phải", status: "OPEN", requestedAt: "2026-11-02T08:00:00.000Z", resolvedAt: null }],
    total: 1, hasNextPage: false,
  })),
  createFighterReviewRequest: (...a: unknown[]) => mockCreate(...a),
}));
jest.mock("@/features/fight-camp/api", () => {
  const actual = jest.requireActual("@/features/fight-camp/api");
  return { ...actual, campApi: { ...actual.campApi, suspensions: jest.fn() } };
});
jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    user: { id: "u-c", email: "hlv@mmavision.vn", role: "COACH", profile: { id: "c-1", firstName: "Lê", lastName: "Hùng" } },
    gate: "coach",
    isDemo: false,
    signOut: jest.fn(() => Promise.resolve()),
  }),
  useSessionRole: () => "COACH",
}));

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const list = () => require("./fighters-list") as typeof import("./fighters-list");
const page = () => require("./fighter-page") as typeof import("./fighter-page");
const sub = () => require("./fighter-subpages") as typeof import("./fighter-subpages");

jest.setTimeout(30000);

const { campApi: mockCamp } = jest.requireMock("@/features/fight-camp/api") as { campApi: { suspensions: jest.Mock } };
const suspended = { id: "s-1", fighterId: "cf-4", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-11-01", endsOn: "2026-11-30",
  blockedSessionTypes: ["SPARRING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null };

beforeEach(() => {
  mockCamp.suspensions.mockReset().mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
  mockPush.mockClear();
  mockCreate.mockReset();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockParams.id = "cf-4";
});

describe("coach Võ sĩ (redesign step 16)", () => {
  it("list: Trận thi đấu first, one row per fighter, a tap opens the one fighter page", async () => {
    const { CoachFightersScreen } = list();
    const ui = await wrap(<CoachFightersScreen/>);
    await waitFor(() => expect(ui.getByTestId("fighters-list")).toBeTruthy());
    expect(ui.getByTestId("fighters-bouts")).toBeTruthy();
    expect(ui.getByText("Phạm Gia Huy")).toBeTruthy();
    fireEvent.press(ui.getByTestId("fighter-row-cf-4"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(coach)/fighters/chi-tiet", params: { id: "cf-4" } });
  });

  it("fighter page: four tabs; Y tế keeps the body map and adds the four rows", async () => {
    mockParams.tab = "medical";
    const { CoachFighterDetailScreen } = page();
    const ui = await wrap(<CoachFighterDetailScreen/>);
    await waitFor(() => expect(ui.getByTestId("medical-rows")).toBeTruthy());
    for (const label of Object.values(t.tabs)) expect(ui.getAllByText(label).length).toBeGreaterThan(0);
    expect(ui.queryByTestId("body3d-frame") ?? ui.queryByTestId("body-fallback")).toBeTruthy();
    expect(ui.queryByText("Tình trạng hiện tại")).toBeNull();
    expect(ui.getByTestId("medical-ask")).toBeTruthy();
    expect(ui.getByTestId("medical-history")).toBeTruthy();
    await waitFor(() => expect(ui.getByTestId("medical-doctors")).toBeTruthy());
    expect(ui.getByTestId("medical-ai")).toBeTruthy();
    fireEvent.press(ui.getByTestId("medical-ask"));
    expect(mockPush).toHaveBeenCalledWith("/(coach)/fighters/cf-4/yeu-cau-kham");
  });

  it("admin page: no exam request or history rows, keeps its own Bác sĩ phụ trách", async () => {
    mockParams.tab = "medical";
    const { CoachFighterDetailScreen } = page();
    const ui = await wrap(<CoachFighterDetailScreen admin doctorsPath="/(admin)/vo-si/bac-si"/>);
    await waitFor(() => expect(ui.getByTestId("medical-rows")).toBeTruthy());
    expect(ui.queryByTestId("medical-ask")).toBeNull();
    expect(ui.getByTestId("fighter-doctors-admin")).toBeTruthy();
  });

  it("exam request: send stays off until a reason is typed; past requests listed", async () => {
    mockCreate.mockResolvedValue({ id: "rr-2" });
    const { CoachExamRequestScreen } = sub();
    const ui = await wrap(<CoachExamRequestScreen/>);
    await waitFor(() => expect(ui.getByTestId("exam-requests")).toBeTruthy());
    expect(within(ui.getByTestId("exam-requests")).getByText("Đau cổ tay phải")).toBeTruthy();
    const send = () => within(ui.getByTestId("role-page-footer")).getByRole("button", { name: t.askSend });
    expect(send().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(ui.getByPlaceholderText(t.askPlaceholder), "Đau vai trái");
    await waitFor(() => expect(send().props.accessibilityState.disabled).toBe(false));
    fireEvent.press(send());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith("cf-4", { reason: "Đau vai trái" }));
  });
  it("a suspended fighter says so on the list row and leads the fighter page with the full suspension", async () => {
    mockCamp.suspensions.mockResolvedValue({ data: [suspended, { ...suspended, id: "s-old", status: "ENDED" }], hasNextPage: false, nextCursor: null });
    const { CoachFightersScreen } = list();
    const ui = await wrap(<CoachFightersScreen/>);
    await waitFor(() => expect(ui.getByTestId("fighter-row-cf-4-note")).toBeTruthy());
    // Two lines, no "·" join that gets cut (owner 2026-11-18).
    expect(within(ui.getByTestId("fighter-row-cf-4")).getByText("Đang đình chỉ đến 30/11")).toBeTruthy();
    expect(within(ui.getByTestId("fighter-row-cf-4")).getByText("Nghỉ bắt buộc")).toBeTruthy();
    ui.unmount();

    const { CoachFighterDetailScreen } = page();
    const p = await wrap(<CoachFighterDetailScreen/>);
    await waitFor(() => expect(p.getByTestId("fighter-suspensions")).toBeTruthy());
    expect(within(p.getByTestId("fighter-status")).getByText("Đang đình chỉ đến 30/11")).toBeTruthy();
    expect(within(p.getByTestId("fighter-suspensions")).getAllByText(/Nghỉ bắt buộc/).length).toBeGreaterThan(0);
  });
});
