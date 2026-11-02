import { fireEvent, render, within } from "@testing-library/react-native";
import type { Suspension } from "@/api/fight-camp";
import { FighterSuspensionCard, loadAllSuspensions } from "./fighter-suspension";
import { gradedSteps, liveSuspensions, strictestSuspension, suspensionHeadline } from "./camp-rules";
import { previewSuspensionCases } from "./camp-preview";
import { fighter } from "@/i18n/fighter";
import { SESSION_STATUSES } from "@/api/types";
import { NEXT_SESSION } from "@/api/one-tap.types";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "u1" } }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/api/fight-camp", () => ({ campApi: { suspensions: jest.fn() } }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());
const { campApi } = jest.requireMock("@/api/fight-camp") as { campApi: { suspensions: jest.Mock } };

const base: Suspension = { id: "s", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING", "STRENGTH_CONDITIONING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null };
const ui = (items: Suspension[] | null, error = false) => render(<FighterSuspensionCard items={items} error={error} onRetry={() => undefined}/>);
const allText = (r: Awaited<ReturnType<typeof ui>>) => JSON.stringify(r.toJSON());

describe("T-048 fighter suspension card", () => {
  it("F1: PENDING is a session status with no next action, labelled Chờ xếp lại", () => {
    expect(SESSION_STATUSES).toContain("PENDING");
    expect(NEXT_SESSION.PENDING).toBeUndefined();
    expect(fighter.sessionStatus.PENDING).toBe("Chờ xếp lại");
    expect(fighter.pendingLine).toBe("HLV sẽ xếp lại buổi này");
  });
  it("F3: MANDATORY_REST tier 1 shows the headline, reason, allowed line and a ladder of 5 with 1 allowed", async () => {
    const r = await ui([base]);
    expect(r.getByText("Đang đình chỉ đến 01/11")).toBeTruthy();
    expect(r.getByText("Lý do: Nghỉ bắt buộc")).toBeTruthy();
    expect(r.getByText("Hôm nay được tập: phục hồi, vật lý trị liệu")).toBeTruthy();
    const rows = within(r.getByTestId("suspension-ladder")).getAllByLabelText(/^Bậc \d/);
    expect(rows).toHaveLength(5);
    expect(rows.filter(x => /Được tập$/.test(x.props.accessibilityLabel))).toHaveLength(1);
    expect(rows[2].props.accessibilityLabel).toBe("Bậc 3, Kỹ thuật không va chạm: Đánh gió, Đánh bao, Đánh đích. Chưa được tập");
  });
  it("F4: graded return day 0 and day 1 highlight the current step", async () => {
    const g = previewSuspensionCases.graded[0];
    const r = await ui([g]);
    expect(r.getByText("Đang tập lại theo bậc, tập đầy đủ từ 02/11")).toBeTruthy();
    expect(r.getByText("Lý do: Hạ đo ván (KO)")).toBeTruthy();
    expect(within(r.getByTestId("graded-steps")).getByLabelText("31/10: Tập đến nhóm kỹ thuật không va chạm, hôm nay")).toBeTruthy();
    expect(gradedSteps({ ceiling: 4, fullReturnOn: "2026-11-02" }).map(s => s.current)).toEqual([false, true, false]);
    expect(gradedSteps({ ceiling: 4, fullReturnOn: "2026-11-02" }).map(s => s.date)).toEqual(["31/10", "01/11", "02/11"]);
  });
  it("F5: awaiting clearance", async () => {
    const r = await ui(previewSuspensionCases.awaiting);
    expect(r.getByText("Chờ bác sĩ xác nhận được tập lại")).toBeTruthy();
  });
  it("F6: nothing in force renders nothing; ENDED without gradedReturn is dropped", async () => {
    const r = await ui([{ ...base, status: "ENDED" }]);
    expect(r.queryByTestId("suspension-card")).toBeNull();
    expect(liveSuspensions([{ ...base, status: "ENDED" }])).toEqual([]);
  });
  it("F7: KO with gradedReturn and OTHER without -> OTHER card plus và 1 đình chỉ khác", async () => {
    const r = await ui(previewSuspensionCases.multiple);
    expect(r.getByText("Lý do: Khác")).toBeTruthy();
    expect(r.getByText("và 1 đình chỉ khác")).toBeTruthy();
    fireEvent.press(r.getByText("Xem lịch sử đình chỉ"));
    expect(mockPush).toHaveBeenCalledWith("/(fighter)/tran/dinh-chi");
  });
  it("F7 order: latest endsOn among suspensions without gradedReturn; UPCOMING after anything in force", () => {
    const a = { ...base, id: "a", endsOn: "2026-11-03" }, b = { ...base, id: "b", endsOn: "2026-11-09" }, u = { ...base, id: "u", status: "UPCOMING" as const, startsOn: "2026-11-10", endsOn: "2026-12-01" };
    expect(strictestSuspension([a, u, b])).toEqual({ main: b, others: 2 });
  });
  it("6B: UPCOMING shows only a small line without the ladder", async () => {
    const r = await ui([{ ...base, status: "UPCOMING", startsOn: "2026-11-10" }]);
    expect(r.getByText(/Sắp đình chỉ từ 10\/11/)).toBeTruthy();
    expect(r.queryByTestId("suspension-ladder")).toBeNull();
  });
  it("F8: no English, raw codes or YYYY-MM-DD on any preview card", async () => {
    for (const items of Object.values(previewSuspensionCases)) {
      const text = allText(await ui(items));
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(text).not.toMatch(/MANDATORY_REST|AWAITING_CLEARANCE|SPARRING|"KO"|OTHER|UPCOMING|Suspension|active/);
    }
    expect(suspensionHeadline({ ...base, status: "ENDED" })).toBe("Trạng thái đình chỉ: Chưa rõ");
    const r = await ui([{ ...base, reason: "NEW_REASON" }]);
    expect(r.getByText("Lý do: Chưa rõ")).toBeTruthy();
  });
  it("a load error shows a retry line, never throws", async () => {
    const r = await ui(null, true);
    expect(r.getByLabelText("Chưa tải được trạng thái đình chỉ. Thử lại")).toBeTruthy();
  });
  it("1A: reads every page without the active filter", async () => {
    campApi.suspensions.mockResolvedValueOnce({ data: [base], hasNextPage: true, nextCursor: "c2" }).mockResolvedValueOnce({ data: [{ ...base, id: "s2" }], hasNextPage: false, nextCursor: null });
    expect((await loadAllSuspensions()).map(s => s.id)).toEqual(["s", "s2"]);
    expect(campApi.suspensions).toHaveBeenNthCalledWith(2, { cursor: "c2", fighterId: undefined });
    expect(JSON.stringify(campApi.suspensions.mock.calls)).not.toMatch(/active/);
  });
});
