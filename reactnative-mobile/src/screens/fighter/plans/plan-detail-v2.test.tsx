/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { getExercise, getTrainingPlan, listTrainingPlanExercises } from "@/screens/fighter/shared/api";
import { FighterPlanDetailV2 } from "./plan-detail-v2";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), useLocalSearchParams: () => ({ id: "p1" }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/screens/fighter/shared/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", canFetch: true, isDemo: false }) }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/screens/fighter/shared/api", () => ({ getTrainingPlan: jest.fn(), listTrainingPlanExercises: jest.fn(), getExercise: jest.fn() }));

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getTrainingPlan).mockResolvedValue({
    id: "p1", title: "Trại thi đấu", phase: "fight_camp", status: "ACTIVE", startDate: day(-3), endDate: day(52),
    goals: null, description: "Giữ nhịp. Nghỉ đủ.", progress: { completedSessions: 0, totalSessions: 0 },
    milestones: [{ id: "m1", title: "Đạt cân", isCompleted: false }],
  } as never);
  jest.mocked(listTrainingPlanExercises).mockResolvedValue([
    { id: "r2", exerciseId: "e2", orderIndex: 2, sets: 4, reps: 6, durationSeconds: null, targetRpe: 8, coachNotes: null },
    { id: "r1", exerciseId: "e1", orderIndex: 1, sets: 5, reps: null, durationSeconds: 1500, targetRpe: 8, coachNotes: "Hiệp 5 phút" },
  ] as never);
  jest.mocked(getExercise).mockImplementation(async id => ({ id, name: id === "e1" ? "Sparring" : "Squat" }) as never);
});

describe("fighter plan detail (redesign)", () => {
  it("shows the phase and week on top, without a 0/0 sessions count", async () => {
    const ui = await render(<FighterPlanDetailV2/>);
    expect(await ui.findByText("Trại thi đấu")).toBeTruthy();
    expect(ui.getByText(/tuần 1\/8/)).toBeTruthy();
    expect(ui.queryByText(/0\/0 buổi/)).toBeNull();
  });

  it("lists exercises in order with their dose and the coach's note", async () => {
    const ui = await render(<FighterPlanDetailV2/>);
    const first = await ui.findByLabelText("1. Sparring. 5 hiệp · 25 phút · RPE 8. HLV: Hiệp 5 phút");
    expect(ui.getByLabelText("2. Squat. 4 × 6 · RPE 8")).toBeTruthy();
    fireEvent.press(first);
    expect(mockPush).toHaveBeenCalledWith("/giao-an/bai-tap/e1");
  });

  it("switches to goals and notes, one sentence per line", async () => {
    const ui = await render(<FighterPlanDetailV2/>);
    await ui.findByText("Trại thi đấu");
    fireEvent.press(ui.getByText("Mục tiêu"));
    const goals = await ui.findByTestId("plan-tab-goals");
    expect(within(goals).getByLabelText("Đạt cân, chưa xong")).toBeTruthy();
    fireEvent.press(ui.getByText("Ghi chú"));
    const notes = await ui.findByTestId("plan-tab-notes");
    expect(within(notes).getByText("Giữ nhịp.")).toBeTruthy();
    expect(within(notes).getByText("Nghỉ đủ.")).toBeTruthy();
  });
});
