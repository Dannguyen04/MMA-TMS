import type { ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme";
import { vai } from "@/i18n/video-ai";
import type { AiJob } from "@/api/video-ai.types";

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
let mockRole = "COACH";
let mockJobs: (() => Promise<AiJob[]>) | null = null;

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual("react");
    useEffect(cb, [cb]);
  },
}));
const mockPlayer: { props: Record<string, unknown> | null } = { props: null };
jest.mock("@/screens/media/evidence/evidence-player", () => ({
  EvidencePlayer: (p: Record<string, unknown>) => {
    mockPlayer.props = p;
    return null;
  },
}));
jest.mock("@/api/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach.mock").mockCoachApi }));
jest.mock("@/api/video-ai", () => {
  const mock = jest.requireActual("@/api/video-ai.mock").mockVideoAiApi;
  return { USE_MOCK_VIDEO_AI: true, videoAiApi: { ...mock, listJobs: (...a: unknown[]) => (mockJobs ? mockJobs() : mock.listJobs(...a)) } };
});
jest.mock("@/api/one-tap", () => ({ USE_MOCK_ONE_TAP: true, oneTapApi: jest.requireActual("@/api/one-tap.mock").mockOneTapApi }));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({ user: { id: "demo-coach", email: "x@y.vn", role: mockRole }, isDemo: true, signOut: jest.fn() }),
  useSessionRole: () => mockRole,
}));

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const model = () => require("./ai-model") as typeof import("./ai-model");

beforeEach(() => {
  mockParams = {};
  mockRole = "COACH";
  mockJobs = null;
  mockPush.mockClear();
});

describe("ai-model", () => {
  const job = (id: string, status: string, h: number, extra: Partial<AiJob> = {}): AiJob => ({
    id, status, score: status === "DONE" ? 70 : null, fighterId: "f", sessionId: null, videoId: `v-${id}`, alertCount: 0, hasImpairment: false, exerciseName: null,
    createdAt: new Date(Date.now() - h * 3_600_000).toISOString(), updatedAt: "", ...extra,
  });

  it("lọc trên máy, mới nhất trước, job chờ HLV duyệt lên đầu", () => {
    const { arrangeJobs } = model();
    const rows = [job("a", "DONE", 1), job("b", "DONE", 5), job("c", "FAILED", 0), job("d", "DONE", 3)];
    expect(arrangeJobs(rows, { status: "DONE" }).map((j) => j.id)).toEqual(["a", "d", "b"]);
    expect(arrangeJobs(rows, { status: "DONE" }, new Set(["b"])).map((j) => j.id)).toEqual(["b", "a", "d"]);
    expect(arrangeJobs(rows, { status: "ALL" }).map((j) => j.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("điểm hiện nguyên số backend trả, không '/100'; chưa xong → '–'", () => {
    const { scoreText } = model();
    expect(scoreText({ status: "DONE", score: 71 })).toBe("71");
    expect(scoreText({ status: "DONE", score: 0 })).toBe("0");
    expect(scoreText({ status: "PROCESSING", score: 50 })).toBe("–");
  });

  it("người duyệt: không lộ id; trùng người đăng nhập → 'Bạn đã duyệt'", () => {
    const { reviewerText } = model();
    const at = "2026-10-19T03:00:00.000Z";
    expect(reviewerText("u-1", at, "u-2")).toBe("Đã duyệt · 19/10/2026");
    expect(reviewerText("u-2", at, "u-2")).toBe("Bạn đã duyệt · 19/10/2026");
    expect(reviewerText("u-1", at, "u-2")).not.toContain("u-1");
  });

  it("đúng 100 bản ghi mới hiện dòng giới hạn", () => {
    const { isCapped } = model();
    expect(isCapped(100)).toBe(true);
    expect(isCapped(99)).toBe(false);
    expect(isCapped(101)).toBe(false);
  });

  it("mức cảnh báo: thấp/trung bình = warning, cao = danger; nhóm theo khớp", () => {
    const { severityTone, groupByJoint } = model();
    expect(severityTone("medium")).toBe("attention");
    expect(severityTone("high")).toBe("danger");
    expect(severityTone("CRITICAL")).toBe("danger");
    const a = (joint: string, severity: string, t: number) => ({ joint, state: "SUSPECTED", severity, triggerTimeMs: t, windowStartMs: null, consecutiveLowRom: null, avgRomRatio: null, motionClass: null, recommendation: "" });
    const g = groupByJoint([a("LEFT_KNEE", "medium", 5), a("RIGHT_KNEE", "high", 9), a("LEFT_KNEE", "high", 2)]);
    expect(g.map((x) => [x.joint, x.worst, x.items.length])).toEqual([["LEFT_KNEE", "high", 2], ["RIGHT_KNEE", "high", 1]]);
    expect(g[0]!.items[0]!.triggerTimeMs).toBe(2);
  });

  it("tiến trình 4 bước và thời gian mm:ss", () => {
    const { currentStep, mmss } = model();
    expect(currentStep("PENDING")).toBe(0);
    expect(currentStep("PROCESSING")).toBe(1);
    expect(mmss(41_500)).toBe("00:42");
  });
});

describe("Cần chú ý (Bác sĩ)", () => {
  it("đếm võ sĩ khác nhau: hợp tình trạng y tế và cảnh báo suy giảm AI", () => {
    const { attentionUnion } = require("@/screens/doctor/redesign/doctor-format") as typeof import("@/screens/doctor/redesign/doctor-format");
    const items = [
      { id: "a", currentMedicalStatus: "INJURED" as const },
      { id: "b", currentMedicalStatus: "HEALTHY" as const },
      { id: "c", currentMedicalStatus: "NOT_CLEARED" as const },
    ];
    expect(attentionUnion(items, [])).toBe(2);
    expect(attentionUnion(items, ["a", "a", "b", "zz"])).toBe(3);
  });
});

describe("màn Video & AI", () => {
  it("Cần duyệt: mặc định 'Xong', chip 'Chờ HLV duyệt', không có 'Đánh dấu tất cả đã đọc'", async () => {
    const { CoachVideosScreen } = require("@/screens/coach/nav/coach-videos-screen") as typeof import("@/screens/coach/nav/coach-videos-screen");
    const ui = await wrap(<CoachVideosScreen />);
    await waitFor(() => expect(ui.getByText("Đấm đích hiệp 3")).toBeTruthy());
    await waitFor(() => expect(ui.getByLabelText(vai.segReviewA11y(1))).toBeTruthy());
    fireEvent.press(ui.getByLabelText(vai.segReviewA11y(1)));
    await waitFor(() => expect(ui.getByText(vai.needsReview)).toBeTruthy());
    expect(ui.queryByText(vai.status.PROCESSING!)).toBeNull();
    expect(ui.getByText(vai.score("86"))).toBeTruthy();
    expect(ui.queryByText(/\/100/)).toBeNull();
    expect(ui.queryByText(/Đánh dấu tất cả/)).toBeNull();
    expect(ui.queryByTestId("jobs-capped")).toBeNull();
  });

  it("đúng 100 job → dòng 'Đang hiện 100 phân tích gần nhất'", async () => {
    mockJobs = async () =>
      Array.from({ length: 100 }, (_, i) => ({ id: `j${i}`, status: "FAILED", score: null, fighterId: "cf-1", sessionId: null, videoId: null, alertCount: 0, hasImpairment: false, exerciseName: null, createdAt: new Date(Date.now() - i * 60_000).toISOString(), updatedAt: "" }));
    mockRole = "ADMIN";
    const { AiJobsScreen } = require("./ai-job-list") as typeof import("./ai-job-list");
    const ui = await wrap(<AiJobsScreen />);
    await waitFor(() => expect(ui.getByTestId("jobs-capped")).toBeTruthy());
    expect(ui.getByText(vai.capped)).toBeTruthy();
  });

  it("chi tiết (HLV): điểm thô, cảnh báo theo khớp, 'Bạn đã duyệt', không có 'Lần phân tích trước'", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const ui = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus="result" />);
    await waitFor(() => expect(ui.getByTestId("ai-score")).toBeTruthy());
    expect(ui.getByTestId("ai-score").props.children).toBe("71");
    fireEvent(ui.getByTestId("ai-track"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } } });
    await waitFor(() => expect(ui.getAllByTestId("alert-marker").length).toBe(2));
    await waitFor(() => expect(ui.getByTestId("ai-tab-review")).toBeTruthy());
    await fireEvent.press(ui.getByTestId("ai-tab-review"));
    await waitFor(() => expect(ui.getByText(vai.coachReview)).toBeTruthy());
    await waitFor(() => expect(ui.getByText(/Bạn đã duyệt/)).toBeTruthy());
    expect(ui.getByText("Đã duyệt · " + new Date(Date.now() - 80 * 3_600_000).toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" }))).toBeTruthy();
    expect(ui.queryByText(/demo-coach|cu-coach/)).toBeNull();
    expect(ui.queryByText(/Lần phân tích trước/)).toBeNull();
    expect(ui.queryByText(/\/100/)).toBeNull();
  });

  it("chi tiết (Bác sĩ): chỉ cảnh báo sức khỏe, không có phần HLV, không có thông báo quyền", async () => {
    mockRole = "DOCTOR";
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const ui = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus="alerts" />);
    await waitFor(() => expect(ui.getByText(vai.health)).toBeTruthy());
    await waitFor(() => expect(ui.getByText("Gối phải")).toBeTruthy());
    expect(ui.queryByText(vai.coachReview)).toBeNull();
    expect(ui.queryByText(/quyền/)).toBeNull();
  });

  it("đang phân tích: tiến trình 4 bước; lỗi: thẻ 'Phân tích không thành công' + nút 'Phân tích lại' (HLV)", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const run = await wrap(<AiVideoDetail videoId="cv-2" jobId="cj-3" focus={null} />);
    await waitFor(() => expect(run.getByTestId("ai-steps")).toBeTruthy());
    expect(run.getByText(vai.running)).toBeTruthy();
    await run.unmount();
    const fail = await wrap(<AiVideoDetail videoId="cv-1" jobId="cj-4" focus={null} />);
    await waitFor(() => expect(fail.getByText(vai.failed)).toBeTruthy());
    expect(fail.getByText("Phân tích không thành công. Video vẫn xem được.")).toBeTruthy();
    expect(fail.getByTestId("reanalyze-btn")).toBeTruthy();
    expect(fail.queryByText(/trên web/)).toBeNull();
    await fail.unmount();
    mockRole = "DOCTOR";
    const doc = await wrap(<AiVideoDetail videoId="cv-1" jobId="cj-4" focus={null} />);
    await waitFor(() => expect(doc.getByText(vai.failed)).toBeTruthy());
    expect(doc.queryByTestId("reanalyze-btn")).toBeNull();
    expect(doc.queryByTestId("more-btn")).toBeNull();
  });

  it("HLV: phân tích lại → sheet xác nhận → mở job mới; chip Chuẩn + phát hiện Đúng/Sai", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const ui = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(ui.getByTestId("ref-chip")).toBeTruthy());
    await waitFor(() => expect(ui.getByTestId("finding-f-1")).toBeTruthy());
    await fireEvent.press(ui.getByTestId("ai-tab-movement"));
    await waitFor(() => expect(ui.getByTestId("window-w-1")).toBeTruthy());
    await fireEvent.press(ui.getByTestId("more-btn"));
    expect(ui.getByText("Gỡ chuẩn")).toBeTruthy();
    await fireEvent.press(ui.getByText("Phân tích lại"));
    expect(ui.getByText("Phân tích lại video này?")).toBeTruthy();
    expect(ui.getByText("Kết quả cũ vẫn được giữ.")).toBeTruthy();
  });

  it("DONE không cảnh báo → 'Không phát hiện cảnh báo nào'", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const ui = await wrap(<AiVideoDetail videoId="cv-3" jobId="cj-2" focus={null} />);
    await waitFor(() => expect(ui.getByTestId("ai-no-alerts")).toBeTruthy());
    await fireEvent.press(ui.getByTestId("ai-tab-review"));
    await waitFor(() => expect(ui.getByText(vai.noReview)).toBeTruthy());
  });
});

describe("batch44: khung xương trên chi tiết video AI", () => {
  afterEach(() => {
    delete (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: unknown }).__VIDEO_AI_MOCK_STREAMS__;
  });
  it("job DONE có điểm khung xương → truyền kết quả GET /jobs/:id/result vào trình phát (ready)", async () => {
    (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: unknown }).__VIDEO_AI_MOCK_STREAMS__ = { "cv-4": "https://x/p.mp4" };
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(mockPlayer.props?.poseState).toBe("ready"), { timeout: 15000 });
    const r = mockPlayer.props!.result as { frames: { keypoints: unknown[] }[]; width: number };
    expect(r.frames.length).toBeGreaterThan(0);
    expect(r.frames[0]!.keypoints).toHaveLength(17);
    expect(r.width).toBe(720);
  }, 20000);
  it("job DONE không có điểm khung xương → poseState 'missing'", async () => {
    (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: unknown }).__VIDEO_AI_MOCK_STREAMS__ = { "cv-3": "https://x/l.mp4" };
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    await wrap(<AiVideoDetail videoId="cv-3" jobId="cj-2" focus={null} />);
    await waitFor(() => expect(mockPlayer.props?.poseState).toBe("missing"), { timeout: 15000 });
  }, 20000);
});

describe("batch45: chi tiết video dạng tab", () => {
  it("HLV: 3 tab Phân tích · Chuyển động · Đánh giá; 1 dòng tên + thông tin; chạm đoạn → nhảy video", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    const ui = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(ui.getByTestId("ai-tab-movement")).toBeTruthy());
    expect(ui.getByTestId("ai-tab-analysis").props.accessibilityState).toEqual({ selected: true });
    expect(ui.getByTestId("ai-tab-review")).toBeTruthy();
    await waitFor(() => expect(ui.getByTestId("ai-info-line").props.accessibilityLabel).toMatch(/Phạm Gia Huy/));
    const info = ui.getByTestId("ai-info-line");
    expect(info.props.numberOfLines).toBeUndefined();
    const text = [info.props.children].flat().filter((x: unknown) => typeof x === "string").join("");
    expect(text).not.toMatch(/Ngày tải/);
    expect(text).toMatch(/1:35 · \d{2}\/\d{2}\/\d{4}$/);
    await fireEvent.press(ui.getByTestId("ai-tab-movement"));
    await waitFor(() => expect(ui.getByTestId("seek-w-1")).toBeTruthy());
    expect(ui.getByText("Chạm một đoạn để video nhảy đến đúng giây đó.")).toBeTruthy();
  });
  it("Bác sĩ: không có tab Đánh giá; Admin: không có tab Chuyển động", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    mockRole = "DOCTOR";
    const d = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(d.getByTestId("ai-tab-movement")).toBeTruthy());
    expect(d.queryByTestId("ai-tab-review")).toBeNull();
    await d.unmount();
    mockRole = "ADMIN";
    const a = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(a.getByTestId("ai-tab-review")).toBeTruthy());
    expect(a.queryByTestId("ai-tab-movement")).toBeNull();
    await a.unmount();
    // Admin + phân tích lỗi: chỉ còn 1 tab → ẩn hẳn thanh tab.
    const f = await wrap(<AiVideoDetail videoId="cv-1" jobId="cj-4" focus={null} />);
    await waitFor(() => expect(f.getByTestId("reanalyze-btn")).toBeTruthy());
    expect(f.queryByTestId("ai-tabs")).toBeNull();
  });
  it("cuộn xuống → trình phát chuyển sang thanh mini (cùng trình phát)", async () => {
    const { AiVideoDetail } = require("./ai-video-detail-screen") as typeof import("./ai-video-detail-screen");
    (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: unknown }).__VIDEO_AI_MOCK_STREAMS__ = { "cv-4": "https://x/p.mp4" };
    const ui = await wrap(<AiVideoDetail videoId="cv-4" jobId="cj-1" focus={null} />);
    await waitFor(() => expect(mockPlayer.props?.fit).toEqual(expect.objectContaining({ mini: false })));
    expect((mockPlayer.props!.fit as { height: number }).height).toBe(Math.min(Math.round(jest.requireActual("react-native").Dimensions.get("window").height * 0.3), 280));
    await fireEvent.scroll(ui.getByTestId("ai-scroll"), { nativeEvent: { contentOffset: { y: 200 }, contentSize: { height: 2000, width: 375 }, layoutMeasurement: { height: 400, width: 375 } } });
    await waitFor(() => expect(mockPlayer.props?.fit).toEqual(expect.objectContaining({ mini: true, height: 64 })));
    await fireEvent.scroll(ui.getByTestId("ai-scroll"), { nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 2000, width: 375 }, layoutMeasurement: { height: 400, width: 375 } } });
    await waitFor(() => expect(mockPlayer.props?.fit).toEqual(expect.objectContaining({ mini: false })));
    delete (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: unknown }).__VIDEO_AI_MOCK_STREAMS__;
  }, 20000);
});
