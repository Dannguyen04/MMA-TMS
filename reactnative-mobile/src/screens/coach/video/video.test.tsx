import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachInbox, coachMe, coachVideo as t } from "@/i18n/coach-video";
import { fighterVideo } from "@/i18n/fighter-video";
import { ThemePreferenceProvider } from "@/theme/theme-preference";
import { COACH_VIDEOS, coachVideoHref } from "./video-model";

const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = jest.requireActual("react"); useEffect(cb, [cb]); },
}));
jest.mock("@/api/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach.mock").mockCoachApi }));
jest.mock("@/api/coach-nav", () => ({ coachNavApi: { ...jest.requireActual("@/api/coach-nav.mock").mockCoachNavApi } }));
jest.mock("@/api/video-ai", () => ({ USE_MOCK_VIDEO_AI: true, videoAiApi: jest.requireActual("@/api/video-ai.mock").mockVideoAiApi }));
jest.mock("@/api/one-tap", () => ({ USE_MOCK_ONE_TAP: true, oneTapApi: jest.requireActual("@/api/one-tap.mock").mockOneTapApi }));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    user: { id: "demo-coach", email: "hlv@mmavision.vn", role: "COACH", profile: { id: "c-1", firstName: "Lê", lastName: "Hùng", specialization: "Muay Thai", isHeadCoach: true } },
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
const list = () => require("./video-list") as typeof import("./video-list");
const upload = () => require("./video-upload") as typeof import("./video-upload");
const me = () => require("@/screens/coach/me/coach-me") as typeof import("@/screens/coach/me/coach-me");
const inbox = () => require("@/screens/coach/me/coach-inbox") as typeof import("@/screens/coach/me/coach-inbox");

beforeEach(() => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockPush.mockReset(); mockReplace.mockReset();
});

describe("coach Video list (redesign step 19)", () => {
  it("Thư viện: lit upload button, one row per video with only the status word coloured; a row opens the one video page", async () => {
    const { CoachVideosScreen } = list();
    const ui = await wrap(<CoachVideosScreen/>);
    await waitFor(() => expect(ui.getByTestId("video-row-cv-3")).toBeTruthy());
    expect(ui.getByRole("button", { name: t.upload })).toBeTruthy();
    await waitFor(() => expect(ui.getByTestId("video-row-cv-3").props.accessibilityLabel).toContain(fighterVideo.status.DONE), { timeout: 3000 });
    expect(ui.getByTestId("video-row-cv-1").props.accessibilityLabel).toContain(fighterVideo.status.FAILED);
    fireEvent.press(ui.getByTestId("video-row-cv-3"));
    expect(mockPush).toHaveBeenCalledWith(coachVideoHref("cv-3", "cj-2"));
  });

  it("Cần duyệt: the count rides on the tab; analyses waiting for the coach come first with a red 'Chờ duyệt'", async () => {
    const { CoachVideosScreen } = list();
    const ui = await wrap(<CoachVideosScreen/>);
    await waitFor(() => expect(ui.getByLabelText(t.reviewA11y(1))).toBeTruthy());
    fireEvent.press(ui.getByLabelText(t.reviewA11y(1)));
    await waitFor(() => expect(ui.getByTestId("job-row-cj-2")).toBeTruthy());
    const rows = within(ui.getByTestId("video-jobs")).getAllByRole("button");
    expect(rows[0].props.accessibilityLabel).toContain(t.waiting);
    expect(ui.queryByText(/Đánh dấu tất cả/)).toBeNull();
    expect(ui.queryByRole("button", { name: t.upload })).toBeNull();
  });

  it("opened from a fighter page on Cần duyệt: the fighter field is set and filters the list", async () => {
    mockParams.fighterId = "cf-4"; mockParams.seg = "review";
    const { CoachVideosScreen } = list();
    const ui = await wrap(<CoachVideosScreen/>);
    await waitFor(() => expect(ui.getByTestId("job-row-cj-1")).toBeTruthy());
    expect(ui.queryByTestId("job-row-cj-2")).toBeNull();
  });
});

describe("coach Tải video (redesign step 19)", () => {
  it("from the Video list: asks for a fighter before sending", async () => {
    const { CoachUploadScreen } = upload();
    const ui = await wrap(<CoachUploadScreen/>);
    await waitFor(() => expect(ui.getByTestId("upload-pick-fighter")).toBeTruthy());
    fireEvent.press(ui.getByRole("button", { name: fighterVideo.send }));
    expect(await ui.findByText(t.needFighter)).toBeTruthy();
  });

  it("from a fighter page: the fighter is shown, no field", async () => {
    mockParams.fighterId = "cf-1";
    const { CoachUploadScreen } = upload();
    const ui = await wrap(<CoachUploadScreen/>);
    await waitFor(() => expect(ui.getByTestId("upload-fighter")).toBeTruthy());
    expect(ui.queryByTestId("upload-pick-fighter")).toBeNull();
    expect(ui.getByText(t.forFighter)).toBeTruthy();
  });
});

describe("coach Tôi and Thông báo (redesign step 19)", () => {
  it("today in Vietnam time; initials from the name", () => {
    const { todayRangeVn, coachInitials } = me();
    const r = todayRangeVn(Date.parse("2026-10-19T20:00:00.000Z")); // 03:00 on 20/10 in Vietnam
    expect(r.fromDate).toBe("2026-10-19T17:00:00.000Z");
    expect(r.toDate).toBe("2026-10-20T16:59:59.999Z");
    expect(coachInitials("lê", "hùng")).toBe("LH");
  });

  it("Thông báo: unread rows carry the red mark; a fighter notification opens the fighter page", async () => {
    const { CoachInboxScreen } = inbox();
    const ui = await wrap(<CoachInboxScreen/>);
    // The inbox mock answers after 350 ms on a real timer; let it land before polling.
    await act(() => new Promise<void>(r => setTimeout(r, 600)));
    await waitFor(() => expect(ui.getByTestId("inbox-cn-1")).toBeTruthy(), { timeout: 3000 });
    expect(ui.getByTestId("inbox-cn-1-dot", { includeHiddenElements: true })).toBeTruthy();
    expect(ui.queryByTestId("inbox-cn-4-dot", { includeHiddenElements: true })).toBeNull();
    expect(ui.getByTestId("inbox-cn-1").props.accessibilityLabel.startsWith(coachInbox.unread)).toBe(true);
    fireEvent.press(ui.getByTestId("inbox-cn-1"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(coach)/fighters/chi-tiet", params: { id: "cf-4" } });
  });
  it("Tôi: role · speciality, email line, 3-number strip, rows Video · Giao diện · Đăng xuất with a confirm", async () => {
    const { CoachMeV2 } = me();
    const ui = await wrap(<CoachMeV2/>);
    expect(ui.getByText("HLV trưởng · Muay Thai")).toBeTruthy();
    expect(ui.getByText("hlv@mmavision.vn")).toBeTruthy();
    await waitFor(() => expect(ui.getByLabelText(new RegExp(`^${coachMe.fighters}: \\d+$`))).toBeTruthy());
    await waitFor(() => expect(ui.getByLabelText(`${coachMe.waiting}: 1`)).toBeTruthy());
    fireEvent.press(ui.getByTestId("me-video"));
    expect(mockPush).toHaveBeenCalledWith(COACH_VIDEOS);
    for (const gone of ["Thông tin chuyên môn", "Cài đặt"]) expect(ui.queryByText(gone)).toBeNull();
    fireEvent.press(ui.getByTestId("coach-logout"));
    expect(await ui.findByText(coachMe.signOutAsk)).toBeTruthy();
    // A dialog left open blocks the next test's screen (React 19 + Modal), so close the tree here.
    ui.unmount();
  });

});
