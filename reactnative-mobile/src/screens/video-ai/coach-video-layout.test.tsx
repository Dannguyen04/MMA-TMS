import type { ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { vai } from "@/i18n/video-ai";
import { ThemePreferenceProvider } from "@/theme";

let mockSize = { width: 720, height: 1280 };
jest.mock("expo-video", () => ({
  useVideoPlayer: () => ({
    pause: jest.fn(),
    play: jest.fn(),
    timeUpdateEventInterval: 0,
    currentTime: 0,
    duration: 10,
    addListener: (name: string, listener: (e: unknown) => void) => {
      if (name === "sourceLoad") listener({ availableVideoTracks: [{ size: mockSize }] });
      return { remove: jest.fn() };
    },
  }),
  VideoView: () => null,
}));
jest.mock("@/api/video-ai", () => ({
  videoAiApi: {
    getJobResult: jest.fn().mockResolvedValue({
      movementEvidence: { windows: [{ id: "w-1", startMs: 0, endMs: 5000 }, { id: "w-2", startMs: 5000, endMs: 9000 }] },
    }),
    getMovementReviews: jest.fn().mockResolvedValue({ reviews: [{ windowId: "w-1", reviewerId: "me", revision: 1, decision: "confirmed" }] }),
  },
}));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ user: { id: "me" } }), useSessionRole: () => "COACH" }));

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

const { EvidencePlayer } = jest.requireActual("@/screens/media/evidence/evidence-player") as typeof import("@/screens/media/evidence/evidence-player");

const P = (extra: Record<string, unknown> = {}) => (
  <EvidencePlayer source={{ uri: "x.mp4" }} mimeType="video/mp4" height={250} fit={{ height: 250 }} result={null} poseState="idle" fallbackDurationMs={10_000} onRetry={() => undefined} {...extra} />
);

describe("video chi tiết: trình phát thu gọn (batch45)", () => {
  it("khung cao cố định = fit.height, nền đen; điều khiển ẩn, chạm video mới hiện; có 'Phóng to' và thanh tiến độ 3dp", async () => {
    const ui = await wrap(P());
    const st = StyleSheet.flatten(ui.getByTestId("evidence-stage").props.style);
    expect(st.height).toBe(250);
    expect(st.backgroundColor).toBe("#000");
    expect(ui.queryByTestId("evidence-controls")).toBeNull();
    expect(ui.getByText("Phóng to")).toBeTruthy();
    expect(StyleSheet.flatten(ui.getByTestId("fullscreen-button").props.style).backgroundColor).toBe("rgba(0,0,0,0.6)");
    expect(StyleSheet.flatten(ui.getByTestId("thin-progress").props.style).height).toBe(3);
    await fireEvent.press(ui.getByTestId("stage-tap"));
    expect(ui.getByTestId("stage-tap")).toBeTruthy();
    expect(ui.getByTestId("evidence-stage")).toContainElement(ui.getByTestId("evidence-controls"));
    expect(ui.getByTestId("layers-button")).toBeTruthy();
  });
  it("Phóng to → chế độ toàn màn hình; vuốt xuống / Thu nhỏ để thoát", async () => {
    const ui = await wrap(P());
    await fireEvent.press(ui.getByTestId("fullscreen-button"));
    expect(ui.getByTestId("fullscreen")).toBeTruthy();
    expect(ui.getByText("Thu nhỏ")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("fullscreen-exit"));
    expect(ui.queryByText("Thu nhỏ")).toBeNull();
  });
  it("thanh mini 64dp: ảnh nhỏ, tên võ sĩ, thời gian, nút dừng/phát", async () => {
    const ui = await wrap(P({ fit: { height: 64, mini: true, miniTitle: "Phạm Gia Huy" } }));
    const bar = ui.getByTestId("mini-bar");
    expect(StyleSheet.flatten(bar.props.style).height).toBe(64);
    expect(ui.getByText("Phạm Gia Huy")).toBeTruthy();
    expect(ui.getByTestId("mini-clock")).toBeTruthy();
    expect(ui.getByLabelText("Phát")).toBeTruthy();
  });
  it("đoạn đã duyệt ẩn Xác nhận/Bác bỏ, đoạn chưa duyệt vẫn có", async () => {
    const { MovementCard } = jest.requireActual("@/screens/one-tap/video-actions") as typeof import("@/screens/one-tap/video-actions");
    const ui = await wrap(<MovementCard jobId="j-1" meId="me" />);
    await waitFor(() => expect(ui.getByTestId("window-w-2")).toBeTruthy());
    await waitFor(() => expect(ui.getAllByTestId("move-confirm")).toHaveLength(1));
    expect(ui.getAllByTestId("move-reject")).toHaveLength(1);
  });
  it("thẻ đánh giá HLV chỉ ghi 'Chưa có đánh giá.'", () => {
    expect(vai.noReview).toBe("Chưa có đánh giá.");
  });
});

describe("batch44: nút Lớp", () => {
  const Toast = (jest.requireMock("react-native-toast-message") as { default: { show: jest.Mock } }).default;
  const { ev } = jest.requireActual("@/i18n/video-evidence") as typeof import("@/i18n/video-evidence");
  const frame = { timeMs: 0, keypoints: Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, conf: 0.9 })) };
  const result = { fps: 30, durationMs: 1000, width: 720, height: 1280, frames: [frame], strikes: [], findings: [], movementEvidence: null, avgScore: null };
  const player = (poseState: "ready" | "missing") => (
    <EvidencePlayer source={{ uri: "x.mp4" }} mimeType="video/mp4" height={250} fit={{ height: 250 }} result={poseState === "ready" ? (result as never) : null} poseState={poseState} fallbackDurationMs={1000} onRetry={() => undefined} />
  );
  it("không có điểm khung xương: Lớp mờ (disabled), chạm → 'Video này chưa có dữ liệu khung xương'", async () => {
    Toast.show.mockClear();
    const ui = await wrap(player("missing"));
    await fireEvent.press(ui.getByTestId("stage-tap"));
    const btn = ui.getByTestId("layers-button");
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(btn);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: "Video này chưa có dữ liệu khung xương", position: "bottom", bottomOffset: 96 }));
    expect(ev.noSkeleton).toBe("Video này chưa có dữ liệu khung xương");
    expect(ui.queryByTestId("layer-skeleton")).toBeNull();
  });
  it("có khung xương: mặc định BẬT; Lớp mở bảng để tắt", async () => {
    Toast.show.mockClear();
    const ui = await wrap(player("ready"));
    await fireEvent.press(ui.getByTestId("stage-tap"));
    await fireEvent.press(ui.getByTestId("layers-button"));
    expect(Toast.show).not.toHaveBeenCalled();
    expect(ui.getByTestId("layer-skeleton").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });
});
