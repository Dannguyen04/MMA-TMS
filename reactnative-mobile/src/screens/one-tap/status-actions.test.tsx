import type { ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ApiError } from "@/api/errors";
import type { PlanStatusValue, SessionStatusValue } from "@/api/one-tap.types";
import { ot } from "@/i18n/one-tap";
import { ThemePreferenceProvider } from "@/theme";

import { MoreMenu } from "./video-actions";

const mockFetch = jest.fn();
jest.mock("@/api/client", () => ({ apiFetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = jest.requireActual("fs") as typeof import("fs");
const swagger = JSON.parse(fs.readFileSync(`${__dirname}/../../../docs/api-docs.json`, "utf8")) as {
  paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> } }>>;
  components: { schemas: Record<string, { required?: string[]; properties?: Record<string, { enum?: string[]; maxLength?: number }> }> };
};
const sa = jest.requireActual("./status-actions") as typeof import("./status-actions");

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}
const body = (i = 0) => JSON.parse(mockFetch.mock.calls[i][1].body);

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue({});
  (Toast.show as jest.Mock).mockClear();
});

describe("lớp ghi batch42", () => {
  const { realOneTapApi } = jest.requireActual("@/api/one-tap") as typeof import("@/api/one-tap");
  it("đúng endpoint + thân", async () => {
    await realOneTapApi.updateSessionStatus("s-1", { status: "CANCELLED", cancellationReason: "Võ sĩ vắng mặt" });
    await realOneTapApi.updatePlanStatus("p-1", { status: "ACTIVE" });
    await realOneTapApi.revokeClearance("c-1", { revokedReason: "Cấp nhầm" });
    await realOneTapApi.endCoachAssignment("f-1", "ca-1", { endReason: "Phân công nhầm" });
    await realOneTapApi.endDoctorAssignment("f-1", "da-1", { endReason: "Hoàn tất đợt điều trị" });
    expect(mockFetch.mock.calls.map(([p, i]) => [p, i.method])).toEqual([
      ["/training-sessions/s-1/status", "PATCH"],
      ["/training-plans/p-1/status", "PATCH"],
      ["/medical-clearances/c-1/revoke", "POST"],
      ["/fighters/f-1/coaches/ca-1/end", "POST"],
      ["/fighters/f-1/doctors/da-1/end", "POST"],
    ]);
    expect(body(0)).toEqual({ status: "CANCELLED", cancellationReason: "Võ sĩ vắng mặt" });
  });

  it("swagger: endpoint có thật, trường bắt buộc, enum và giới hạn ký tự khớp", () => {
    const schema = (path: string, m: string) => {
      const ref = swagger.paths[path]?.[m]?.requestBody?.content?.["application/json"]?.schema?.$ref ?? "";
      return swagger.components.schemas[ref.split("/").pop()!];
    };
    const ses = schema("/training-sessions/{id}/status", "patch");
    expect(ses.properties?.status?.enum).toEqual(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED", "ABANDONED"]);
    expect(ses.properties?.cancellationReason?.maxLength).toBe(sa.CANCEL_MAX);
    expect(schema("/training-plans/{id}/status", "patch").properties?.status?.enum).toEqual(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]);
    const rv = schema("/medical-clearances/{id}/revoke", "post");
    expect(rv.required).toEqual(["revokedReason"]);
    expect(rv.properties?.revokedReason?.maxLength).toBe(sa.REVOKE_MAX);
    for (const k of ["coaches", "doctors"]) {
      const e = schema(`/fighters/{id}/${k}/{assignmentId}/end`, "post");
      expect(e.required).toContain("endReason");
      expect(e.properties?.endReason?.maxLength).toBe(sa.END_MAX);
    }
  });
});

function SessionHost({ status, onChanged = jest.fn(), onReload = jest.fn(), onOpenMedical = jest.fn() }: { status: SessionStatusValue; onChanged?: jest.Mock; onReload?: jest.Mock; onOpenMedical?: jest.Mock }) {
  const a = sa.useSessionActions({ sessionId: "s-1", status, onChanged, onReload, onOpenMedical });
  return (
    <>
      <MoreMenu items={a.more} />
      {a.primary}
      {a.sheets}
    </>
  );
}

describe("buổi tập (HLV)", () => {
  it("Đã lên lịch: Bắt đầu buổi gửi IN_PROGRESS; ⋯ có Bỏ buổi + Hủy buổi, không có Kết thúc dở", async () => {
    const onChanged = jest.fn();
    const ui = await wrap(<SessionHost status="SCHEDULED" onChanged={onChanged} />);
    expect(ui.getByText(ot.sessionStart)).toBeTruthy();
    await fireEvent.press(ui.getByTestId("session-primary"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("IN_PROGRESS"));
    expect(body()).toEqual({ status: "IN_PROGRESS" });
    expect(Toast.show).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByTestId("more-btn"));
    expect(ui.getByText(ot.sessionSkip)).toBeTruthy();
    expect(ui.getByText(ot.sessionCancel)).toBeTruthy();
    expect(ui.queryByText(ot.sessionAbandon)).toBeNull();
  });

  it("Đang tập: Hoàn thành buổi; ⋯ Kết thúc dở + Hủy buổi", async () => {
    const ui = await wrap(<SessionHost status="IN_PROGRESS" />);
    expect(ui.getByText(ot.sessionComplete)).toBeTruthy();
    await fireEvent.press(ui.getByTestId("more-btn"));
    expect(ui.getByText(ot.sessionAbandon)).toBeTruthy();
    expect(ui.queryByText(ot.sessionSkip)).toBeNull();
  });

  it("trạng thái cuối: không có nút, không có ⋯", async () => {
    const ui = await wrap(<SessionHost status="COMPLETED" />);
    expect(ui.queryByTestId("session-primary")).toBeNull();
    expect(ui.queryByTestId("more-btn")).toBeNull();
  });

  it("Hủy buổi: danger, lý do bắt buộc, Khác ≤500, gửi cancellationReason", async () => {
    const onChanged = jest.fn();
    const ui = await wrap(<SessionHost status="SCHEDULED" onChanged={onChanged} />);
    await fireEvent.press(ui.getByTestId("more-btn"));
    await fireEvent.press(ui.getByText(ot.sessionCancel));
    expect(ui.getByText(ot.sessionCancelTitle)).toBeTruthy();
    expect(ui.getByTestId("sheet-confirm").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByText(ot.other));
    await fireEvent.changeText(ui.getByTestId("reason-other"), "x".repeat(600));
    expect(ui.getByTestId("reason-other").props.value).toHaveLength(500);
    await fireEvent.press(ui.getByText("Võ sĩ vắng mặt"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("CANCELLED"));
    expect(body()).toEqual({ status: "CANCELLED", cancellationReason: "Võ sĩ vắng mặt" });
  });

  it("409 y tế khi bắt đầu → sheet 'Chưa thể bắt đầu buổi' với lý do tiếng Việt, không mã thô", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", "x", { reasons: ["REVIEW_REQUEST_PENDING", "CLEARANCE_EXPIRED"] }));
    const onOpenMedical = jest.fn();
    const ui = await wrap(<SessionHost status="SCHEDULED" onOpenMedical={onOpenMedical} />);
    await fireEvent.press(ui.getByTestId("session-primary"));
    await waitFor(() => expect(ui.getByText(ot.medicalTitle)).toBeTruthy());
    expect(ui.getByText("Còn yêu cầu khám lại chưa được xử lý.")).toBeTruthy();
    expect(ui.queryByText(/REVIEW_REQUEST_PENDING|CLEARANCE_EXPIRED/)).toBeNull();
    await fireEvent.press(ui.getByText(ot.medicalOpen));
    expect(onOpenMedical).toHaveBeenCalled();
  });

  it("409 xung đột → toast + tải lại; 403 → dòng đỏ không có quyền", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(409, "SESSION_STATE_CONFLICT", "x"));
    const onReload = jest.fn();
    const ui = await wrap(<SessionHost status="IN_PROGRESS" onReload={onReload} />);
    await fireEvent.press(ui.getByTestId("session-primary"));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: ot.sessionConflict }));
    mockFetch.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "x"));
    await fireEvent.press(ui.getByTestId("session-primary"));
    await waitFor(() => expect(ui.getByText(ot.sessionForbidden)).toBeTruthy());
  });

  it("mất mạng → toast Thử lại", async () => {
    mockFetch.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "x"));
    const ui = await wrap(<SessionHost status="SCHEDULED" />);
    await fireEvent.press(ui.getByTestId("session-primary"));
    await waitFor(() => expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: ot.offline, text2: ot.retry })));
  });
});

function PlanHost({ status, onChanged = jest.fn() }: { status: PlanStatusValue; onChanged?: jest.Mock }) {
  const a = sa.usePlanActions({ planId: "p-1", status, onChanged, onReload: jest.fn() });
  return (
    <>
      <MoreMenu items={a.more} />
      {a.sheets}
    </>
  );
}

describe("giáo án", () => {
  it.each([
    ["DRAFT", [ot.planActivate, ot.planCancel]],
    ["ACTIVE", [ot.planComplete, ot.planDraft, ot.planCancel]],
    ["COMPLETED", [ot.planReopen]],
    ["CANCELLED", [ot.planReopen]],
  ] as const)("%s → chỉ chuyển tiếp hợp lệ", async (status, labels) => {
    const ui = await wrap(<PlanHost status={status} />);
    await fireEvent.press(ui.getByTestId("more-btn"));
    for (const l of [ot.planActivate, ot.planComplete, ot.planDraft, ot.planCancel, ot.planReopen]) {
      expect([l, ui.queryAllByText(l).length > 0]).toEqual([l, (labels as readonly string[]).includes(l)]);
    }
  });

  it("Mở lại giáo án → gửi ACTIVE sau xác nhận", async () => {
    const onChanged = jest.fn();
    const ui = await wrap(<PlanHost status="COMPLETED" onChanged={onChanged} />);
    await fireEvent.press(ui.getByTestId("more-btn"));
    await fireEvent.press(ui.getByText(ot.planReopen));
    expect(ui.getByText(ot.planReopenTitle)).toBeTruthy();
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("ACTIVE"));
    expect(body()).toEqual({ status: "ACTIVE" });
  });
});

describe("thu hồi giấy phép + kết thúc phân công", () => {
  it("thu hồi: chip v3, gửi revokedReason đúng nhãn", async () => {
    const onDone = jest.fn();
    const ui = await wrap(<sa.RevokeClearanceButton clearanceId="c-1" training={false} onDone={onDone} />);
    await fireEvent.press(ui.getByTestId("revoke-c-1"));
    expect(ui.getByText("Võ sĩ sẽ không còn được phép thi đấu.")).toBeTruthy();
    for (const r of ot.clearanceReasons) expect(ui.getByText(r)).toBeTruthy();
    await fireEvent.press(ui.getByText("Kết quả khám không đạt"));
    await fireEvent.press(ui.getByTestId("sheet-confirm"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(body()).toEqual({ revokedReason: "Kết quả khám không đạt" });
  });

  function EndHost({ kind, own }: { kind: "coach" | "doctor"; own?: boolean }) {
    const e = sa.useEndAssignment({ kind, fighterId: "f-1", own, onDone: jest.fn() });
    return (
      <>
        <MoreMenu items={[{ key: "x", label: "mở", icon: "ban", onPress: () => e.open("a-1", "Lan Phạm") }]} />
        {e.sheet}
      </>
    );
  }
  it("bác sĩ tự kết thúc: có 'Hoàn tất đợt điều trị'; HLV (admin) thì không", async () => {
    const doc = await wrap(<EndHost kind="doctor" own />);
    await fireEvent.press(doc.getByTestId("more-btn"));
    await fireEvent.press(doc.getByText("mở"));
    expect(doc.getByText(ot.endOwnTitle)).toBeTruthy();
    expect(doc.getByText("Hoàn tất đợt điều trị")).toBeTruthy();
    await fireEvent.press(doc.getByText("Phân công nhầm"));
    await fireEvent.press(doc.getByTestId("sheet-confirm"));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/fighters/f-1/doctors/a-1/end", expect.anything()));
    await doc.unmount();
    const coach = await wrap(<EndHost kind="coach" />);
    await fireEvent.press(coach.getByTestId("more-btn"));
    await fireEvent.press(coach.getByText("mở"));
    expect(coach.getByText(ot.endAssignTitle("Lan Phạm"))).toBeTruthy();
    expect(coach.queryByText("Hoàn tất đợt điều trị")).toBeNull();
  });

  it("phân công của chính mình", () => {
    const { ownAssignment } = jest.requireActual("@/screens/doctor/redesign/doctor-fighter-detail-screen") as typeof import("@/screens/doctor/redesign/doctor-fighter-detail-screen");
    const rows = [
      { id: "1", doctorId: "other", endsAt: null },
      { id: "2", doctorId: "me", endsAt: "2026-01-01" },
      { id: "3", doctorId: "me", endsAt: null },
    ];
    expect(ownAssignment(rows, "me", false)?.id).toBe("3");
    expect(ownAssignment(rows.slice(0, 2), "me", false)).toBeNull();
  });
});

describe("batch42 tinh chỉnh nhãn", () => {
  it("nhãn nút ngắn, không bị cắt ở 375; chip giáo án và tiêu đề Người phụ trách", () => {
    expect([ot.sessionSkip, ot.planDraft, ot.endAssign]).toEqual(["Bỏ buổi", "Về nháp", "Kết thúc"]);
    expect([ot.planCompleteShort, ot.clearanceRevokeShort, ot.endOwnShort]).toEqual(["Hoàn thành", "Thu hồi", "Kết thúc"]);
    for (const l of [ot.sessionSkip, ot.sessionAbandon, ot.sessionCancel, ot.planActivate, ot.planCompleteShort, ot.planDraft, ot.planCancel, ot.planReopen, ot.clearanceRevokeShort, ot.endOwnShort, ot.endAssign])
      expect(l.length).toBeLessThanOrEqual(15);
    const { coachRo } = jest.requireActual("@/i18n/coach-ro") as { coachRo: { planStatus: Record<string, string> } };
    expect(coachRo.planStatus.ACTIVE).toBe("Đang áp dụng");
    const { adminRo } = jest.requireActual("@/i18n/admin-ro") as { adminRo: { doctors: { title: string } } };
    expect(adminRo.doctors.title).toBe("Người phụ trách");
  });
});
