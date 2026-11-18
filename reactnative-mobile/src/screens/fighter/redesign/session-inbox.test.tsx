import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachInbox } from "@/i18n/coach-video";
import { fighter } from "@/i18n/fighter";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockMark = jest.fn((_id: string) => Promise.resolve());
const mockSession = jest.fn();
const mockList = jest.fn();
let mockCanFetch = true;

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ canFetch: mockCanFetch, isDemo: !mockCanFetch, fighterId: "f-1" }) }));
jest.mock("@/screens/fighter/api", () => ({ getTrainingSession: (id: string) => mockSession(id) }));
jest.mock("@/api/notifications", () => ({ listNotifications: () => mockList() }));
jest.mock("@/api/one-tap", () => ({ oneTapApi: { markNotificationRead: (id: string) => mockMark(id) } }));

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
const inbox = () => require("@/screens/fighter/me/fighter-inbox") as typeof import("@/screens/fighter/me/fighter-inbox");
const Page = () => { const { FighterSessionPage } = page(); return <FighterSessionPage/>; };
const Inbox = () => { const { FighterInboxScreen } = inbox(); return <FighterInboxScreen/>; };

const base = {
  id: "s-1", title: "Đấm đích: phối hợp", sessionType: "PAD_WORK", status: "SCHEDULED", scheduledAt: "2026-11-13T10:30:00.000Z",
  location: "Sàn 2", roundCount: 6, plannedDurationSec: 3600, actualDurationSec: null, coachNotes: "Giữ tay cao. Nghỉ 1 phút giữa hiệp.",
  cancellationReason: null, reportedRpe: null,
};

beforeEach(() => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockPush.mockReset(); mockMark.mockClear(); mockSession.mockReset(); mockList.mockReset();
  mockCanFetch = true;
});

describe("fighter Buổi tập (redesign step 25)", () => {
  it("reads the short version: title, 'type · status word', time and place, notes one sentence per line; no old fact labels", async () => {
    mockParams.id = "s-1";
    mockSession.mockResolvedValue(base);
    const ui = await wrap(<Page/>);
    await waitFor(() => expect(ui.getByText(base.title)).toBeTruthy(), { timeout: 8000 });
    expect(ui.getByTestId("session-line").props.accessibilityLabel).toContain(fighter.sessionStatus.SCHEDULED);
    expect(ui.getByText(fighter.tap.when)).toBeTruthy();
    expect(ui.getByText("Sàn 2")).toBeTruthy();
    expect(ui.getByText("Giữ tay cao.")).toBeTruthy();
    expect(ui.getByText("Nghỉ 1 phút giữa hiệp.")).toBeTruthy();
    for (const gone of [fighter.tap.rounds, fighter.tap.planned, fighter.tap.type, fighter.tap.status]) expect(ui.queryByText(gone)).toBeNull();
  });

  it("a cancelled session shows Lý do hủy", async () => {
    mockParams.id = "s-1";
    mockSession.mockResolvedValue({ ...base, status: "CANCELLED", cancellationReason: "HLV bận" });
    const ui = await wrap(<Page/>);
    await waitFor(() => expect(ui.getByText(fighter.tap.cancelReason)).toBeTruthy(), { timeout: 8000 });
    expect(ui.getByText("HLV bận")).toBeTruthy();
  });

  it("a session waiting to be rescheduled says the coach will move it; no notes reads Chưa có ghi chú", async () => {
    mockParams.id = "s-1";
    mockSession.mockResolvedValue({ ...base, status: "PENDING", coachNotes: null });
    const ui = await wrap(<Page/>);
    await waitFor(() => expect(ui.getByTestId("session-pending")).toBeTruthy(), { timeout: 8000 });
    expect(ui.getByText(fighter.tap.noNotes)).toBeTruthy();
  });

  it("a load failure offers Thử lại", async () => {
    mockParams.id = "s-1";
    mockSession.mockRejectedValue(new Error("x"));
    const ui = await wrap(<Page/>);
    await waitFor(() => expect(ui.getByText(fighter.tap.loadFailed)).toBeTruthy(), { timeout: 8000 });
    expect(ui.getByText(fighter.common.retry)).toBeTruthy();
  });

  it("only the status word is coloured: done green, cancelled red, scheduled ink", () => {
    const { fighterSessionWord } = page();
    expect(fighterSessionWord("COMPLETED").tone).toBe("ok");
    expect(fighterSessionWord("CANCELLED").tone).toBe("warn");
    expect(fighterSessionWord("SCHEDULED").tone).toBeUndefined();
  });
});

describe("fighter Thông báo (redesign step 25)", () => {
  const rows = [
    { id: "n-1", type: "TRAINING_SESSION_SCHEDULED", title: "Có buổi tập mới", message: "HLV vừa xếp một buổi tập mới.", isRead: false, readAt: null, createdAt: new Date().toISOString(), payload: { target: { type: "TRAINING_SESSION", id: "s-9" } } },
    { id: "n-2", type: "TRAINING_PLAN_ACTIVATED", title: "Giáo án đã áp dụng", message: "", isRead: true, readAt: "2026-11-10T00:00:00.000Z", createdAt: "2026-11-10T00:00:00.000Z", payload: { target: { type: "TRAINING_PLAN", id: "p-2" } } },
    { id: "n-3", type: "SUSPENSION_CREATED", title: "Có đình chỉ mới", message: "", isRead: true, readAt: "2026-11-10T00:00:00.000Z", createdAt: "2026-11-10T00:00:00.000Z", payload: {} },
  ];

  it("an empty inbox says so", async () => {
    mockList.mockResolvedValue({ data: [], meta: { page: 1, limit: 30, total: 0 } });
    const ui = await wrap(<Inbox/>);
    await waitFor(() => expect(ui.getByTestId("inbox-empty")).toBeTruthy(), { timeout: 8000 });
  });

  it("unread rows carry the red mark; a session notification marks it read and opens the session", async () => {
    mockList.mockResolvedValue({ data: rows, meta: { page: 1, limit: 30, total: 3 } });
    const ui = await wrap(<Inbox/>);
    await waitFor(() => expect(ui.getByTestId("inbox-n-1")).toBeTruthy(), { timeout: 8000 });
    expect(ui.getByTestId("inbox-n-1").props.accessibilityLabel.startsWith(coachInbox.unread)).toBe(true);
    expect(ui.queryByTestId("inbox-n-2-dot", { includeHiddenElements: true })).toBeNull();
    fireEvent.press(ui.getByTestId("inbox-n-1"));
    expect(mockMark).toHaveBeenCalledWith("n-1");
    expect(mockPush).toHaveBeenCalledWith("/tap/s-9");
    fireEvent.press(ui.getByTestId("inbox-n-2"));
    expect(mockPush).toHaveBeenCalledWith("/giao-an/p-2");
    // Let the mark-read refetch settle, then close the tree so it does not hold the next test (React 19).
    await act(() => new Promise<void>(r => setTimeout(r, 50)));
    ui.unmount();
  });

  it("links: sessions and plans only", () => {
    const { fighterNotificationHref } = inbox();
    expect(fighterNotificationHref({ target: { type: "TRAINING_SESSION", id: "a" } })).toBe("/tap/a");
    expect(fighterNotificationHref({ target: { type: "FIGHTER", id: "a" } })).toBeNull();
    expect(fighterNotificationHref(null)).toBeNull();
  });
});
