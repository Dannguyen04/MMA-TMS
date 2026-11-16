import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachRo } from "@/i18n/coach-ro";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

const mockParams: { id: string } = { id: "cf-4" };
const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockUnread = jest.fn(() => Promise.resolve({ count: 3 }));

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("@/components/body3d/body-canvas", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/api/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach.mock").mockCoachApi }));
jest.mock("@/api/coach-nav", () => {
  const mock = jest.requireActual("@/api/coach-nav.mock").mockCoachNavApi;
  return { coachNavApi: { ...mock, unreadCount: () => mockUnread() } };
});
jest.mock("@/api/video-ai", () => ({ USE_MOCK_VIDEO_AI: true, videoAiApi: jest.requireActual("@/api/video-ai.mock").mockVideoAiApi }));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    user: { id: "u-c", email: "hlv@mmavision.vn", role: "COACH", profile: { id: "c-1", firstName: "Lê", lastName: "Hùng", specialization: "Muay Thai", isHeadCoach: true } },
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
const nav = () => require("./coach-unread") as typeof import("./coach-unread");

describe("coach-nav-v2", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUnread.mockReset();
  });

  it("chuông: huy hiệu số chưa đọc, nhãn đọc màn hình, bấm mở Thông báo", async () => {
    mockUnread.mockResolvedValue({ count: 3 });
    const { CoachUnreadProvider, CoachBell, COACH_NOTIFICATIONS_PATH } = nav();
    const ui = await wrap(
      <CoachUnreadProvider>
        <CoachBell />
      </CoachUnreadProvider>,
    );
    await waitFor(() => expect(ui.getByTestId("coach-bell-badge", { includeHiddenElements: true })).toBeTruthy());
    expect(ui.getByText("3", { includeHiddenElements: true })).toBeTruthy();
    expect(ui.getByLabelText("Thông báo, 3 chưa đọc")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("coach-bell"));
    expect(mockPush).toHaveBeenCalledWith(COACH_NOTIFICATIONS_PATH);
  });

  it("chuông: '99+' khi vượt 99, ẩn khi 0", async () => {
    mockUnread.mockResolvedValue({ count: 128 });
    const { CoachUnreadProvider, CoachBell } = nav();
    const ui = await wrap(
      <CoachUnreadProvider>
        <CoachBell />
      </CoachUnreadProvider>,
    );
    await waitFor(() => expect(ui.getByText("99+", { includeHiddenElements: true })).toBeTruthy());
    await ui.unmount();
    mockUnread.mockResolvedValue({ count: 0 });
    const zero = await wrap(
      <CoachUnreadProvider>
        <CoachBell />
      </CoachUnreadProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(zero.queryByTestId("coach-bell-badge", { includeHiddenElements: true })).toBeNull();
    expect(zero.getByLabelText("Thông báo")).toBeTruthy();
  });

  it("chuông làm mới mỗi 60 giây", async () => {
    jest.useFakeTimers();
    mockUnread.mockResolvedValue({ count: 1 });
    const { CoachUnreadProvider, CoachBell, UNREAD_POLL_MS } = nav();
    await wrap(
      <CoachUnreadProvider>
        <CoachBell />
      </CoachUnreadProvider>,
    );
    expect(mockUnread).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    expect(mockUnread).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  // Step 19: video rows, Tôi and the Video list moved to screens/coach/video/video.test.tsx.
});

describe("batch38 fix: huy hiệu, tab trong màn, Mục tiêu & cột mốc", () => {
  it("chuông 99+, huy hiệu tab (Khám) 9+", () => {
    const { badgeText } = require("@/screens/doctor/redesign/doctor-unread") as typeof import("@/screens/doctor/redesign/doctor-unread");
    const { badgeLabel } = require("@/screens/doctor/detail/detail-ui") as typeof import("@/screens/doctor/detail/detail-ui");
    expect(badgeText(100)).toBe("99+");
    expect(badgeText(99)).toBe("99");
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(9)).toBe("9");
  });

  it("tab trong màn: cuộn ngang được, nhãn không thu nhỏ/cắt", async () => {
    const { SegmentTabs } = require("@/screens/coach/readonly/ro-ui") as typeof import("@/screens/coach/readonly/ro-ui");
    const tabs = [
      { key: "a", label: "Tổng quan" },
      { key: "b", label: "Cân nặng" },
    ] as const;
    const ui = await wrap(<SegmentTabs tabs={tabs} value="a" onChange={() => undefined} />);
    expect(ui.getByTestId("segment-tabs").props.horizontal).toBe(true);
    expect(ui.getByText("Tổng quan").props.adjustsFontSizeToFit).toBeUndefined();
    // Tab chọn: nền accentSoft, chữ link, viền 1px cùng màu nền (không viền đỏ) — như chip lọc Doctor.
    const { StyleSheet } = require("react-native");
    const tab = StyleSheet.flatten(ui.getAllByRole("tab")[0]!.props.style);
    expect(tab.borderWidth).toBe(1);
    expect(tab.borderColor).toBe(tab.backgroundColor);
  });
});
