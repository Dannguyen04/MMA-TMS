import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { coachPlans as t } from "@/i18n/coach/coach-plans";
import { ThemePreferenceProvider } from "@/theme/theme-preference";
import { fromVnDate, planLead, toggledMilestones, toVnDate } from "./plan-model";

const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUpdatePlan = jest.fn();
const mockCreatePlan = jest.fn();
const mockUpdateRow = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = jest.requireActual("react"); useEffect(cb, [cb]); },
}));
jest.mock("@/api/coach/coach", () => ({ USE_MOCK_COACH: true, coachApi: jest.requireActual("@/api/coach/coach.mock").mockCoachApi }));
jest.mock("@/api/coach/coach-nav", () => ({ coachNavApi: { ...jest.requireActual("@/api/coach/coach-nav.mock").mockCoachNavApi } }));
jest.mock("@/api", () => ({
  ...jest.requireActual("@/api"),
  getExercise: jest.fn(() => Promise.reject(new Error("x"))),
  updateTrainingPlan: (...a: unknown[]) => mockUpdatePlan(...a),
  createTrainingPlan: (...a: unknown[]) => mockCreatePlan(...a),
  updateTrainingPlanExercise: (...a: unknown[]) => mockUpdateRow(...a),
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
const list = () => require("./plans-list") as typeof import("./plans-list");
const page = () => require("./plan-page") as typeof import("./plan-page");
const sub = () => require("./plan-subpages") as typeof import("./plan-subpages");

beforeEach(() => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockPush.mockClear(); mockReplace.mockClear();
  mockUpdatePlan.mockReset(); mockCreatePlan.mockReset(); mockUpdateRow.mockReset();
});

describe("plan model (redesign step 17)", () => {
  it("dates: dd/mm/yyyy ⇄ ISO; bad dates are null", () => {
    expect(fromVnDate("21/10/2026")).toBe("2026-10-21");
    expect(fromVnDate("1/2/2027")).toBe("2027-02-01");
    expect(fromVnDate("31/02/2026")).toBeNull();
    expect(fromVnDate("2026-10-21")).toBeNull();
    expect(toVnDate("2026-10-21")).toBe("21/10/2026");
  });
  it("row lead: %, ✓, ×, –", () => {
    expect(planLead({ status: "ACTIVE", progress: { completedSessions: 9, totalSessions: 24, completionPercentage: 38 } } as never)).toEqual({ lead: "38", sub: "%" });
    expect(planLead({ status: "COMPLETED" } as never).lead).toBe("✓");
    expect(planLead({ status: "CANCELLED" } as never).lead).toBe("×");
    expect(planLead({ status: "DRAFT" } as never).lead).toBe("–");
  });
  it("toggling a milestone keeps the others and drops completedAt when reopened", () => {
    const list = [{ id: "a", title: "A", isCompleted: true, completedAt: "2026-11-01T00:00:00Z" }, { id: "b", title: "B", isCompleted: false }];
    const on = toggledMilestones(list, 1, "2026-11-12T00:00:00Z");
    expect(on[1]).toMatchObject({ isCompleted: true, completedAt: "2026-11-12T00:00:00Z" });
    expect(on[0]).toMatchObject({ isCompleted: true, completedAt: "2026-11-01T00:00:00Z" });
    const off = toggledMilestones(list, 0, "2026-11-12T00:00:00Z");
    expect(off[0].isCompleted).toBe(false);
    expect("completedAt" in off[0]).toBe(false);
  });
});

describe("coach Giáo án (redesign step 17)", () => {
  it("list: Tạo giáo án first, one row per plan, a tap opens the one plan page", async () => {
    const { CoachPlansListScreen } = list();
    const ui = await wrap(<CoachPlansListScreen/>);
    await waitFor(() => expect(ui.getByTestId("plans-list")).toBeTruthy());
    expect(ui.getByRole("button", { name: t.create })).toBeTruthy();
    fireEvent.press(ui.getByTestId("plan-row-cp-1"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(coach)/plans/chi-tiet", params: { id: "cp-1" } });
  });

  it("list: an active plan without progress gets its % from the plan", async () => {
    const api = jest.requireMock("@/api/coach/coach").coachApi;
    const realList = api.listPlans, realGet = api.getPlan;
    const base = (await realList({ page: 1, limit: 20 })).data[0];
    api.listPlans = jest.fn(() => Promise.resolve({ data: [{ ...base, id: "np-1", status: "ACTIVE", progress: undefined }], total: 1, hasNextPage: false }));
    api.getPlan = jest.fn(() => Promise.resolve({ ...base, id: "np-1", status: "ACTIVE", progress: { completedSessions: 9, totalSessions: 24, completionPercentage: 38 } }));
    try {
      const { CoachPlansListScreen } = list();
      const ui = await wrap(<CoachPlansListScreen/>);
      await waitFor(() => expect(within(ui.getByTestId("plan-row-np-1")).getByText("38")).toBeTruthy());
      expect(api.getPlan).toHaveBeenCalledWith("np-1");
    } finally { api.listPlans = realList; api.getPlan = realGet; }
  });

  it("plan page: three tabs; a milestone saves on tap and offers undo", async () => {
    mockParams.id = "cp-1"; mockParams.tab = "goals";
    mockUpdatePlan.mockImplementation((_id: string, body: { milestones: unknown[] }) => Promise.resolve({ milestones: body.milestones }));
    const { CoachPlanPage } = page();
    const ui = await wrap(<CoachPlanPage/>);
    await waitFor(() => expect(ui.getByTestId("plan-milestones")).toBeTruthy());
    for (const label of Object.values(t.tabs)) expect(ui.getAllByText(label).length).toBeGreaterThan(0);
    expect(ui.getByTestId("plan-stats")).toBeTruthy();
    fireEvent.press(ui.getByTestId("milestone-2"));
    await waitFor(() => expect(mockUpdatePlan).toHaveBeenCalledTimes(1));
    const sent = mockUpdatePlan.mock.calls[0][1].milestones as { isCompleted: boolean }[];
    expect(sent.map(m => m.isCompleted)).toEqual([true, true, true]);
    await waitFor(() => expect(ui.getByTestId("milestone-undo")).toBeTruthy());
    fireEvent.press(within(ui.getByTestId("milestone-undo")).getByText(t.undo));
    await waitFor(() => expect(mockUpdatePlan).toHaveBeenCalledTimes(2));
    expect((mockUpdatePlan.mock.calls[1][1].milestones as { isCompleted: boolean }[]).map(m => m.isCompleted)).toEqual([true, true, false]);
  });

  it("new plan: asks for a fighter before sending", async () => {
    const { CoachPlanFormScreen } = sub();
    const ui = await wrap(<CoachPlanFormScreen/>);
    await waitFor(() => expect(ui.getByTestId("plan-pick-fighter")).toBeTruthy());
    fireEvent.press(within(ui.getByTestId("role-page-footer")).getByRole("button", { name: t.saveNew }));
    expect(await ui.findByText(t.needFighter)).toBeTruthy();
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it("plan exercise: RPE over 10 is refused before sending", async () => {
    mockParams.id = "cp-1";
    const rows = await jest.requireActual("@/api/coach/coach.mock").mockCoachApi.listPlanExercises("cp-1");
    mockParams.row = rows[0].id; mockParams.name = "Đấm đích";
    const { CoachPlanExerciseScreen } = sub();
    const ui = await wrap(<CoachPlanExerciseScreen/>);
    await waitFor(() => expect(ui.getByTestId("role-page-footer")).toBeTruthy());
    await waitFor(() => expect(ui.getByLabelText(t.order).props.value).toBe("0"));
    fireEvent.changeText(ui.getByLabelText(t.rpe), "11");
    await waitFor(() => expect(ui.getByLabelText(t.rpe).props.value).toBe("11"));
    fireEvent.press(within(ui.getByTestId("role-page-footer")).getByRole("button", { name: t.saveExercise }));
    await waitFor(() => expect(ui.getByTestId("form-error").props.children).toBe(t.badRpe));
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });
});
