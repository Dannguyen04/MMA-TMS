import type { ReactNode } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ApiError } from "@/api/errors";
import { ot } from "@/i18n/one-tap";
import { ThemePreferenceProvider } from "@/theme";

const mockFetch = jest.fn();
jest.mock("@/api/client", () => ({ apiFetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({ user: { id: "u-coach", role: "COACH", profile: { id: "coach-1" } } }),
  useSessionRole: () => "COACH",
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = jest.requireActual("fs") as typeof import("fs");
const swagger = JSON.parse(fs.readFileSync(`${__dirname}/../../../docs/api-docs.json`, "utf8")) as {
  paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> } }>>;
  components: { schemas: Record<string, { required?: string[]; properties?: Record<string, { enum?: string[] }> }> };
};

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue({});
  (Toast.show as jest.Mock).mockClear();
});

describe("lớp ghi one-tap", () => {
  const { realOneTapApi, USE_MOCK_ONE_TAP } = jest.requireActual("@/api/one-tap") as typeof import("@/api/one-tap");

  it("mock chỉ bật bằng EXPO_PUBLIC_ONE_TAP_MOCK=true", () => {
    expect(USE_MOCK_ONE_TAP).toBe(process.env.EXPO_PUBLIC_ONE_TAP_MOCK === "true");
  });

  it("đúng endpoint + thân", async () => {
    await realOneTapApi.reanalyzeVideo("v 1", { fighterId: "f-1" });
    await realOneTapApi.reviewFinding({ analysisId: "a", actionId: "b", findingId: "c", status: "approved" });
    await realOneTapApi.revokeReference({ coachId: "coach-1", referenceId: "r", reason: "Chọn nhầm video" });
    await realOneTapApi.reviewMovement("j-1", { requestId: "q", windowId: "w", expectedRevision: 0, decision: "confirmed", notes: "Đúng động tác" });
    await realOneTapApi.markNotificationRead("n-1");
    await realOneTapApi.createMedicalReviewRequest("f-1", { reason: "Chấn thương mới" });
    const calls = mockFetch.mock.calls.map(([path, init]) => [path, init.method, init.body ? JSON.parse(init.body) : undefined]);
    expect(calls).toEqual([
      ["/coaching/videos/v%201/reanalyze", "POST", { fighterId: "f-1" }],
      ["/coaching/findings/review", "POST", { analysisId: "a", actionId: "b", findingId: "c", status: "approved" }],
      ["/coaching/references/revoke", "POST", { coachId: "coach-1", referenceId: "r", reason: "Chọn nhầm video" }],
      ["/movement-evidence/jobs/j-1/reviews", "POST", { requestId: "q", windowId: "w", expectedRevision: 0, decision: "confirmed", notes: "Đúng động tác" }],
      ["/notifications/n-1/read", "PATCH", undefined],
      ["/fighters/f-1/medical-review-requests", "POST", { reason: "Chấn thương mới" }],
    ]);
  });

  it("mọi endpoint ghi có trong swagger và thân đủ trường bắt buộc", () => {
    const bodies: [string, string, Record<string, unknown>][] = [
      ["/coaching/videos/{videoId}/reanalyze", "post", { fighterId: "f" }],
      ["/coaching/findings/review", "post", { analysisId: "a", actionId: "b", findingId: "c", status: "approved" }],
      ["/coaching/references/revoke", "post", { coachId: "c", referenceId: "r", reason: "x" }],
      ["/movement-evidence/jobs/{jobId}/reviews", "post", { requestId: "q", windowId: "w", expectedRevision: 0, decision: "confirmed", notes: "n" }],
      ["/notifications/{id}/read", "patch", {}],
      ["/fighters/{id}/medical-review-requests", "post", { reason: "x" }],
    ];
    for (const [path, method, body] of bodies) {
      const op = swagger.paths[path]?.[method];
      expect([path, Boolean(op)]).toEqual([path, true]);
      const ref = op?.requestBody?.content?.["application/json"]?.schema?.$ref;
      if (!ref) continue;
      const schema = swagger.components.schemas[ref.split("/").pop()!];
      for (const k of schema.required ?? []) expect([path, k, k in body]).toEqual([path, k, true]);
      for (const [k, v] of Object.entries(body)) {
        const en = schema.properties?.[k]?.enum;
        if (en) expect(en).toContain(v);
      }
    }
  });
});

describe("Yêu cầu khám lại", () => {
  const { MedicalReviewAction } = jest.requireActual("./medical-review-action") as typeof import("./medical-review-action");

  it("chọn chip → gửi đúng nhãn → chip Đã gửi yêu cầu", async () => {
    const onSent = jest.fn();
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={0} onSent={onSent} />);
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    expect(ui.getByText(ot.examTitle)).toBeTruthy();
    expect(ui.getByText(ot.examBody)).toBeTruthy();
    expect(ui.getByTestId("sheet-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByText("Chấn thương mới"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(ui.getByText(ot.examSent)).toBeTruthy());
    expect(mockFetch).toHaveBeenCalledWith("/fighters/f-1/medical-review-requests", expect.objectContaining({ body: JSON.stringify({ reason: "Chấn thương mới" }) }));
    expect(onSent).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("Khác: 1 dòng, tối đa 100 ký tự, gửi chữ đã nhập", async () => {
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={0} onSent={jest.fn()} />);
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    await fireEvent.press(ui.getByText(ot.other));
    expect(ui.getByTestId("sheet-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(ui.getByTestId("reason-other"), `  ${"a".repeat(120)}\nb`);
    expect(ui.getByTestId("reason-other").props.value).toHaveLength(100);
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).reason).toBe("a".repeat(98));
  });

  it("đã có yêu cầu đang mở → ẩn nút, chỉ hiện chip", async () => {
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={1} onSent={jest.fn()} />);
    expect(ui.queryByTestId("exam-request-btn")).toBeNull();
    expect(ui.getByText(ot.examSent)).toBeTruthy();
  });

  it("403 → báo không có quyền ngay trong sheet; mất mạng → toast Thử lại", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "x"));
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={0} onSent={jest.fn()} />);
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    await fireEvent.press(ui.getByText("Chấn thương mới"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(ui.getByText(ot.examForbidden)).toBeTruthy());

    mockFetch.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "x"));
    await fireEvent.press(ui.getByText(ot.cancel));
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    await fireEvent.press(ui.getByText("Cảm thấy không khoẻ"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: ot.offline, text2: ot.retry })));
    const retry = (Toast.show as jest.Mock).mock.calls[0][0].onPress as () => void;
    await act(async () => retry());
    await waitFor(() => expect(ui.getByText(ot.examSent)).toBeTruthy());
  });

  it("409 (đã có yêu cầu mở) → hiện chip, không báo lỗi", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(409, "MEDICAL_REVIEW_REQUEST_OPEN", "x"));
    const onSent = jest.fn();
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={0} onSent={onSent} />);
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    await fireEvent.press(ui.getByText("Chấn thương mới"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(ui.getByText(ot.examSent)).toBeTruthy());
    expect(Toast.show).not.toHaveBeenCalled();
    expect(ui.queryByTestId("forbidden-line")).toBeNull();
    expect(onSent).toHaveBeenCalled();
  });

  it("thân thể võ sĩ: openReviewRequests từ GET /fighters/:id/medical ẩn nút", async () => {
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={2} onSent={jest.fn()} />);
    expect(ui.queryByTestId("exam-request-btn")).toBeNull();
    expect(ui.getByTestId("exam-sent")).toBeTruthy();
  });

  it("đang gửi: nút khóa + Đang gửi…", async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => undefined));
    const ui = await wrap(<MedicalReviewAction fighterId="f-1" openCount={0} onSent={jest.fn()} />);
    await fireEvent.press(ui.getByTestId("exam-request-btn"));
    await fireEvent.press(ui.getByText("Chấn thương mới"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(ui.getByTestId("sheet-confirm").props.accessibilityState.busy).toBe(true));
    expect(ui.getByText(ot.sending)).toBeTruthy();
  });
});

describe("Duyệt phát hiện AI + gỡ chuẩn", () => {
  const va = jest.requireActual("./video-actions") as typeof import("./video-actions");
  const finding = { id: "f-1", actionId: "a-3", title: "Tay trước hạ thấp", description: "", severity: "warning" as const, confidence: 0.8, timeMs: 21000, recommendation: "" };

  it("Đúng → chip HLV đã xác nhận + Đổi; Sai → HLV đã bác", async () => {
    const ui = await wrap(<va.FindingRow finding={finding} analysisId="an-1" initial={null} />);
    await fireEvent.press(ui.getByTestId("finding-approved"));
    await waitFor(() => expect(ui.getByText(ot.findingApproved)).toBeTruthy());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ analysisId: "an-1", actionId: "a-3", findingId: "f-1", status: "approved" });
    await fireEvent.press(ui.getByText(ot.change));
    await fireEvent.press(ui.getByTestId("finding-rejected"));
    await waitFor(() => expect(ui.getByText(ot.findingRejected)).toBeTruthy());
  });

  it("gỡ chuẩn: lý do bắt buộc, gửi coachId của HLV", async () => {
    const ref = { id: "ref-1", fighterId: "cf-4", technique: "jab", actionId: "a-3", videoId: "cv-4", sessionId: null, status: "active", createdAt: "" };
    const onDone = jest.fn();
    function Host() {
      const r = va.useRevokeReference(ref as never, onDone);
      return (
        <>
          <va.ReanalyzeButton onPress={r.open} />
          {r.sheet}
        </>
      );
    }
    const ui = await wrap(<Host />);
    await fireEvent.press(ui.getByTestId("reanalyze-btn"));
    expect(ui.getByTestId("sheet-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByText("Chọn nhầm video"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ coachId: "coach-1", referenceId: "ref-1", reason: "Chọn nhầm video" });
  });

  it("expectedRevision = lần duyệt mới nhất của chính mình", () => {
    const moves = { jobId: "j", canReview: true, exerciseName: null, reviews: [
      { id: "1", windowId: "w", reviewerId: "me", reviewerRole: "COACH", revision: 2, decision: "confirmed", notes: "", startMs: null, endMs: null, createdAt: "" },
      { id: "2", windowId: "w", reviewerId: "other", reviewerRole: "DOCTOR", revision: 5, decision: "rejected", notes: "", startMs: null, endMs: null, createdAt: "" },
    ] } as never;
    expect(va.myLatest(moves, "w", "me")).toEqual({ revision: 2, decision: "confirmed" });
    expect(va.myLatest(moves, "x", "me")).toEqual({ revision: 0, decision: null });
  });
});

describe("đánh dấu đã đọc (dùng chung 4 hộp thư)", () => {
  const { useMarkRead } = jest.requireActual("./notification-read") as typeof import("./notification-read");
  const { Text, Pressable } = jest.requireActual("react-native") as typeof import("react-native");
  function Host() {
    const r = useMarkRead();
    const row = { id: "n-1", isRead: false };
    return (
      <Pressable testID="row" onPress={() => r.mark(row.id)}>
        <Text>{r.isRead(row) ? "đã đọc" : "chưa đọc"}</Text>
      </Pressable>
    );
  }
  it("lạc quan; lỗi → trả lại chưa đọc", async () => {
    let fail: (e: unknown) => void = () => undefined;
    mockFetch.mockReturnValueOnce(new Promise((_, rej) => (fail = rej)));
    const ui = await wrap(<Host />);
    await fireEvent.press(ui.getByTestId("row"));
    expect(ui.getByText("đã đọc")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith("/notifications/n-1/read", { method: "PATCH" });
    await act(async () => fail(new ApiError(403, "FORBIDDEN", "x")));
    expect(ui.getByText("chưa đọc")).toBeTruthy();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: ot.notifForbidden }));
  });
});
