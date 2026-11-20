import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";
import { tabsFor } from "@/screens/media/evidence/evidence-tabs";

import { adminVideoHref, adminVideosHref } from "./admin-paths";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockAssign = jest.fn((..._a: unknown[]) => Promise.resolve({}));
let mockParams: Record<string, string> = {};

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = jest.requireActual("react"); useEffect(cb, [cb]); },
}));
jest.mock("@/api/coach/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach/coach.mock").mockCoachApi }));
jest.mock("@/api/video/video-ai", () => ({ USE_MOCK_VIDEO_AI: true, videoAiApi: jest.requireActual("@/api/video/video-ai.mock").mockVideoAiApi }));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({ isDemo: false, user: { id: "u-a", role: "ADMIN", email: "admin@lotus-combat.test", profile: null }, signOut: jest.fn() }),
  useSessionRole: () => "ADMIN",
}));
const fighters = [
  { id: "f1", firstName: "Aigerim", lastName: "Sadykova", weightClass: "FLYWEIGHT" },
  { id: "f2", firstName: "Lucas", lastName: "Ferreira", weightClass: "WELTERWEIGHT" },
];
jest.mock("@/api", () => ({
  listFighters: () => Promise.resolve({ data: fighters, total: 2 }),
  listUsers: () => Promise.resolve({ items: [
    { id: "u1", email: "thu.le@lotus-combat.test", role: "DOCTOR", isActive: true, profile: { id: "d1", firstName: "Thu", lastName: "Lê", specialization: "Bác sĩ trưởng" } },
    { id: "u2", email: "sam@lotus-combat.test", role: "DOCTOR", isActive: true, profile: { id: "d2", firstName: "Samuel", lastName: "Brooks", specialization: null } },
  ], total: 2, page: 1, limit: 100 }),
  listFighterDoctors: (id: string) => Promise.resolve({ data: id === "f2"
    ? [{ id: "a1", doctorId: "d1", doctorName: "Thu Lê", startsAt: "2026-09-21T00:00:00Z", endsAt: null }]
    : [], total: 0, hasNextPage: false }),
  assignFighterDoctor: (...a: unknown[]) => mockAssign(...a),
}));

jest.setTimeout(30000);

const wrap = async (el: ReactNode) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <ThemePreferenceProvider>{el}</ThemePreferenceProvider>
  </SafeAreaProvider>,
);

/* eslint-disable @typescript-eslint/no-require-imports */
beforeEach(() => {
  mockParams = {};
  mockPush.mockClear(); mockReplace.mockClear(); mockAssign.mockClear();
});

describe("admin tools (step 23)", () => {
  it("paths and the admin video page tabs", () => {
    expect(adminVideoHref("v1", "j1")).toEqual({ pathname: "/(admin)/quan-tri/video-chi-tiet", params: { id: "v1", jobId: "j1" } });
    const h = adminVideosHref({ seg: "ai", status: "FAILED" });
    expect(h.pathname).toBe("/(admin)/quan-tri/video");
    expect(h.params).toMatchObject({ seg: "ai", status: "FAILED" });
    expect(tabsFor("admin")).toEqual(["timeline", "metrics"]);
  });

  it("Video: Thư viện rows open the admin video page", async () => {
    const { AdminVideosScreen } = require("./admin-videos-screen");
    await wrap(<AdminVideosScreen/>);
    await waitFor(() => expect(screen.getByTestId("video-row-cv-3")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("video-row-cv-3"));
    expect(mockPush.mock.calls[0][0].pathname).toBe("/(admin)/quan-tri/video-chi-tiet");
  });

  it("Video: ?seg=ai&status=FAILED opens Phân tích AI on Lỗi", async () => {
    mockParams = { seg: "ai", status: "FAILED", t: "1" };
    const { AdminVideosScreen } = require("./admin-videos-screen");
    await wrap(<AdminVideosScreen/>);
    await waitFor(() => expect(screen.getByTestId("job-row-cj-4")).toBeTruthy());
    expect(screen.queryByTestId("job-row-cj-1")).toBeNull();
  });

  it("Phân công bác sĩ: fighter without a doctor → choose one → Phân công → done", async () => {
    mockParams = { fighterId: "f1" };
    const { AdminAssignScreen } = require("./admin-assign-screen");
    await wrap(<AdminAssignScreen/>);
    expect(await screen.findByTestId("assign-doctor-d2")).toBeTruthy();
    expect(screen.getByLabelText("Samuel Brooks, sam@lotus-combat.test")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Phân công" })).toBeDisabled();
    await fireEvent.press(screen.getByTestId("assign-doctor-d1"));
    await fireEvent.press(screen.getByRole("button", { name: "Phân công" }));
    expect(mockAssign).toHaveBeenCalledWith("f1", "d1");
    expect(await screen.findByTestId("admin-assign-done")).toBeTruthy();
    expect(screen.getByLabelText("Bác sĩ: Thu Lê")).toBeTruthy();
  });

  it("Phân công bác sĩ: a fighter who has a doctor shows that doctor and no button", async () => {
    mockParams = { fighterId: "f2" };
    const { AdminAssignScreen } = require("./admin-assign-screen");
    await wrap(<AdminAssignScreen/>);
    expect(await screen.findByLabelText("Thu Lê, từ 21/09/2026")).toBeTruthy();
    expect(screen.getByText("Võ sĩ này đã có bác sĩ.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phân công" })).toBeNull();
    await fireEvent.press(screen.getByTestId("assign-doctors-page"));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/(admin)/vo-si/bac-si", params: { id: "f2" } });
  });
});
