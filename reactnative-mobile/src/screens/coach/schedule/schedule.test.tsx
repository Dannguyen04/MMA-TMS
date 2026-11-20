import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachSchedule as t } from "@/i18n/coach-schedule";
import { ot } from "@/i18n/one-tap";
import { ThemePreferenceProvider } from "@/theme/theme-preference";
import { parseHm, sessionStatusWord } from "./session-model";

const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockStatus = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = jest.requireActual("react"); useEffect(cb, [cb]); },
}));
jest.mock("@/api/coach/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach/coach.mock").mockCoachApi }));
jest.mock("@/api/coach/coach-nav", () => ({ coachNavApi: { ...jest.requireActual("@/api/coach/coach-nav.mock").mockCoachNavApi } }));
jest.mock("@/api/medical/one-tap", () => ({ oneTapApi: { updateSessionStatus: (...a: unknown[]) => mockStatus(...a) } }));
jest.mock("@/api", () => ({
  ...jest.requireActual("@/api"),
  updateTrainingSession: (...a: unknown[]) => mockUpdate(...a),
  createTrainingSession: (...a: unknown[]) => mockCreate(...a),
}));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    user: { id: "u-c", email: "hlv@mmavision.vn", role: "COACH", profile: { id: "c-1", firstName: "Lê", lastName: "Hùng" } },
    gate: "coach",
    isDemo: false,
    signOut: jest.fn(() => Promise.resolve()),
  }),
  useSessionRole: () => "COACH",
}));

jest.setTimeout(30000);

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const page = () => require("./session-page") as typeof import("./session-page");
const sub = () => require("./session-subpages") as typeof import("./session-subpages");
const footer = (ui: Awaited<ReturnType<typeof wrap>>) => within(ui.getByTestId("role-page-footer"));

beforeEach(() => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  for (const f of [mockPush, mockReplace, mockBack, mockUpdate, mockCreate, mockStatus]) f.mockReset();
});

describe("session model (redesign step 18)", () => {
  it("time hh:mm; status words with only done green and the ends red", () => {
    expect(parseHm("7:05")).toBe("07:05");
    expect(parseHm("24:00")).toBeNull();
    expect(parseHm("1730")).toBeNull();
    expect(sessionStatusWord("COMPLETED").tone).toBe("ok");
    expect(sessionStatusWord("CANCELLED").tone).toBe("warn");
    expect(sessionStatusWord("SCHEDULED").tone).toBeUndefined();
  });
});

describe("coach session page (redesign step 18)", () => {
  it("a scheduled session: numbers, status word, the pinned Bắt đầu buổi sends IN_PROGRESS", async () => {
    mockParams.id = "cs-5";
    mockStatus.mockResolvedValue({});
    const { CoachSessionPage } = page();
    const ui = await wrap(<CoachSessionPage/>);
    await waitFor(() => expect(ui.getByTestId("session-stats")).toBeTruthy());
    expect(ui.getByText(t.planned)).toBeTruthy();
    expect(ui.getByTestId("session-line").props.accessibilityLabel).toContain(t.status.SCHEDULED);
    expect(ui.getByTestId("session-edit")).toBeTruthy();
    fireEvent.press(footer(ui).getByRole("button", { name: ot.sessionStart }));
    await waitFor(() => expect(mockStatus).toHaveBeenCalledWith("cs-5", { status: "IN_PROGRESS" }));
  });

  it("a finished session shows the actual minutes and no main button", async () => {
    mockParams.id = "cs-1";
    const { CoachSessionPage } = page();
    const ui = await wrap(<CoachSessionPage/>);
    await waitFor(() => expect(ui.getByTestId("session-stats")).toBeTruthy());
    expect(ui.getByText(t.actual)).toBeTruthy();
    expect(ui.getByLabelText(`${t.actual}: 58 ${t.min}`)).toBeTruthy();
    expect(ui.queryByTestId("role-page-footer")).toBeNull();
  });

  it("edit: RPE over 10 is refused before sending", async () => {
    mockParams.id = "cs-1";
    const { CoachSessionEditScreen } = sub();
    const ui = await wrap(<CoachSessionEditScreen/>);
    await waitFor(() => expect(ui.getByLabelText(t.rpeField).props.value).toBe("7"));
    fireEvent.changeText(ui.getByLabelText(t.rpeField), "11");
    await waitFor(() => expect(ui.getByLabelText(t.rpeField).props.value).toBe("11"));
    fireEvent.press(footer(ui).getByRole("button", { name: t.save }));
    await waitFor(() => expect(ui.getByTestId("form-error").props.children).toBe(t.badRpe));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("new session: asks for a fighter before sending", async () => {
    const { CoachSessionFormScreen } = sub();
    const ui = await wrap(<CoachSessionFormScreen/>);
    await waitFor(() => expect(ui.getByTestId("session-pick-fighter")).toBeTruthy());
    fireEvent.press(footer(ui).getByRole("button", { name: t.saveNew }));
    expect(await ui.findByText(t.needFighter)).toBeTruthy();

    expect(mockCreate).not.toHaveBeenCalled();
    ui.unmount();
  });

  it("new session from a plan: checks the time, then sends and opens the new session", async () => {
    mockParams.fighterId = "cf-1"; mockParams.planId = "cp-1";
    const { CoachSessionFormScreen } = sub();
    const ui = await wrap(<CoachSessionFormScreen/>);
    await waitFor(() => expect(ui.getByTestId("session-plan-cp-1").props.accessibilityState.checked).toBe(true));
    // React 19: wait for every field to hold its value before pressing.
    fireEvent.changeText(ui.getByLabelText(t.name), "Đấm đích 6 hiệp");
    await waitFor(() => expect(ui.getByLabelText(t.name).props.value).toBe("Đấm đích 6 hiệp"));
    fireEvent.changeText(ui.getByLabelText(t.date), "20/11/2026");
    await waitFor(() => expect(ui.getByLabelText(t.date).props.value).toBe("20/11/2026"));
    fireEvent.changeText(ui.getByLabelText(t.time), "25:00");
    await waitFor(() => expect(ui.getByLabelText(t.time).props.value).toBe("25:00"));
    await fireEvent.press(footer(ui).getByRole("button", { name: t.saveNew }));
    await waitFor(() => expect(ui.getByTestId("form-error").props.children).toBe(t.badTime));

    mockCreate.mockResolvedValue({ id: "new-1" });
    fireEvent.changeText(ui.getByLabelText(t.time), "17:30");
    await waitFor(() => expect(ui.getByLabelText(t.time).props.value).toBe("17:30"));
    await fireEvent.press(footer(ui).getByRole("button", { name: t.saveNew }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const body = mockCreate.mock.calls[0][0];
    expect(body).toMatchObject({ fighterId: "cf-1", title: "Đấm đích 6 hiệp", sessionType: "PAD_WORK", coachId: "c-1", planId: "cp-1", plannedDurationSec: 3600, roundCount: 0 });
    expect(new Date(body.scheduledAt).getHours()).toBe(17);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/(coach)/schedule/chi-tiet", params: { id: "new-1" } }));
  });
});
