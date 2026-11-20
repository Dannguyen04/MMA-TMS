/// <reference types="jest" />
import { act, fireEvent, render } from "@testing-library/react-native";
import { campApi, type CampDetail } from "@/features/fight-camp/api";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { CoachCampBout } from "./coach-camp-screen";

const listeners: Record<string, (e: { preventDefault: () => void }) => void> = {};
const mockTabs = { setOptions: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "b1", preview: "0" }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useNavigation: () => ({ addListener: (name: string, fn: (e: { preventDefault: () => void }) => void) => { listeners[name] = fn; return () => undefined; }, getParent: () => mockTabs }),
}));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "coach" } }) }));
jest.mock("@/theme/index", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/api/fighters/fighters", () => ({ getFighter: jest.fn(async () => ({ firstName: "Trần", lastName: "Minh Khôi" })) }));
jest.mock("@/features/fight-camp/api", () => ({ campApi: { detail: jest.fn(), suspensions: jest.fn(), weigh: jest.fn(), weightTrack: jest.fn(() => Promise.reject(new Error("n/a"))) } }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("./round-screens", () => ({ CornerScreen: () => null, RoundScreen: () => null, ReportScreen: () => null }));
jest.mock("@/features/fight-camp/components/opponent-editor", () => ({ OpponentEditor: () => null }));

const api = campApi as jest.Mocked<typeof campApi>;
const bout = (patch: Partial<CampDetail>): CampDetail => ({ ...previewBout, id: "b1", fighterId: "f1", ...patch });
const suspension = { id: "s1", reason: "KO", status: "ACTIVE" as const, startsOn: "2026-10-26", endsOn: "2026-11-20", blockedSessionTypes: ["SPARRING"], requiresClearance: true, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null };
beforeEach(() => { jest.clearAllMocks(); });
type UI = Awaited<ReturnType<typeof render>>;
/** Bout detail is tabbed (owner 2026-11-11): Tổng quan · Cân · Hồ sơ · Đối thủ. */
const tab = async (ui: UI, name: RegExp) => fireEvent.press(await ui.findByRole("tab", { name }));

describe("Coach bout: gates and suspension", () => {
  it("shows Gate 1 as blocking before fight week and loads the fighter's suspensions with fighterId", async () => {
    api.detail.mockResolvedValue(bout({ status: "CAMP", requirements: [{ code: "MEDICAL", label: "Hồ sơ y tế thi đấu", required: true, status: "MISSING", validUntil: null }] }));
    api.suspensions.mockResolvedValue({ data: [suspension], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampBout/>);
    await tab(ui, /Hồ sơ/);
    await ui.findByText("Chưa đủ hồ sơ để vào tuần thi đấu");
    expect(ui.getByText(/Còn thiếu: Hồ sơ y tế thi đấu/)).toBeTruthy();
    expect(api.suspensions).toHaveBeenCalledWith({ fighterId: "f1" });
    await tab(ui, /Tổng quan/);
    // Phone: one red row with the end date; the full cards open in a sheet.
    expect(ui.getByText("Đang đình chỉ đến 20/11/2026")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("suspension-row"));
    expect(ui.getByText("Võ sĩ đang có đình chỉ")).toBeTruthy();
    expect(ui.getByText("Đang đình chỉ")).toBeTruthy();
    // Phase 5 B: gate truth from blockedSessionTypes (only SPARRING here), not the stale maxAllowedTier 1.
    expect(ui.getByText("Hôm nay được tập: phục hồi, vật lý trị liệu, thể lực và sức mạnh, đánh gió, đánh bao, đánh đích, vật / khoá siết")).toBeTruthy();
    expect(ui.queryByText(/bản ghi/)).toBeNull();
    expect(ui.getAllByText(/Cần xác nhận cho tập lại/).length).toBeGreaterThanOrEqual(1);
  });
  it("keeps the bout readable when suspensions fail, and hides the gate once fight week started", async () => {
    api.detail.mockResolvedValue(bout({ status: "FIGHT_WEEK" }));
    api.suspensions.mockRejectedValue(new Error("Mất mạng"));
    const ui = await render(<CoachCampBout/>);
    await ui.findByText("Chưa tải được trạng thái đình chỉ");
    await tab(ui, /Hồ sơ/);
    expect(ui.queryByText("Chưa đủ hồ sơ để vào tuần thi đấu")).toBeNull();
    await tab(ui, /Cân/);
    expect(ui.getByText("Ghi cân chính thức")).toBeTruthy();
  });
});
describe("Coach bout: weigh-in flow", () => {
  it("a swipe-back during weigh-in returns to the bout detail and keeps the typed weight", async () => {
    api.detail.mockResolvedValue(bout({ status: "FIGHT_WEEK" }));
    api.suspensions.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampBout/>);
    await tab(ui, /Cân/);
    await fireEvent.press(await ui.findByLabelText("Ghi cân chính thức"));
    await fireEvent.changeText(ui.getByLabelText("Cân nặng chính thức"), "60,4");
    const preventDefault = jest.fn();
    await act(async () => listeners.beforeRemove({ preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(ui.getByText("Chi tiết trận")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("Ghi cân chính thức"));
    expect(ui.getByLabelText("Cân nặng chính thức").props.value).toBe("60,4");
  });
  it("shows the official weight against the limit and the coach's options after a miss", async () => {
    const b = bout({ status: "FIGHT_WEEK" });
    api.detail.mockResolvedValue(b);
    api.suspensions.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    api.weigh.mockResolvedValue({ ...b, officialWeightKg: 61.2, weighIn: { outcome: "FAILED", reason: "OVER_LIMIT", overByKg: 1.2, overByPct: 2, options: ["CATCHWEIGHT", "CANCEL"] } });
    const ui = await render(<CoachCampBout/>);
    await tab(ui, /Cân/);
    await fireEvent.press(await ui.findByLabelText("Ghi cân chính thức"));
    await fireEvent.changeText(ui.getByLabelText("Cân nặng chính thức"), "61,2");
    await fireEvent.press(ui.getByLabelText("Ghi cân chính thức"));
    await ui.findByText("Vượt 1,2 kg (2,0%)");
    expect(ui.getByText("Giới hạn: 60,0 kg")).toBeTruthy();
    // Grey-text sweep 2026-11-11: no state explanation under the options.
    expect(ui.queryByText(/Trận vẫn ở Tuần thi đấu/)).toBeNull();
    expect(ui.getByLabelText("Thoả thuận hạng cân")).toBeTruthy();
    expect(ui.getByLabelText("Huỷ trận")).toBeTruthy();
  });
});
describe("Coach bout: detail tabs (owner 2026-11-11)", () => {
  it("pins fighter vs opponent, flags the papers tab, lists untrained tactics, and links to cancel", async () => {
    api.detail.mockResolvedValue(bout({ status: "CAMP", tacticsWithoutSessions: [previewBout.opponentAnalysis.tactics![0].id], requirements: [{ code: "MEDICAL", label: "Hồ sơ y tế thi đấu", required: true, status: "MISSING", validUntil: null }] }));
    api.suspensions.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampBout/>);
    const who = await ui.findByTestId("bout-who");
    expect(who).toBeTruthy();
    expect(await ui.findByRole("tab", { name: "Hồ sơ, cần xử lý" })).toBeTruthy();
    await tab(ui, /Đối thủ/);
    expect(ui.getByText("Chưa có buổi tập")).toBeTruthy();
    await tab(ui, /Tổng quan/);
    await fireEvent.press(ui.getByText("Hủy trận"));
    expect(await ui.findByLabelText("Lý do huỷ trận")).toBeTruthy();
  });
});
describe("Coach bout: tab bar during the bout", () => {
  it("hides the coach tab bar on the corner card and shows it again back on the detail", async () => {
    api.detail.mockResolvedValue(bout({ status: "WEIGHED_IN" }));
    api.suspensions.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampBout/>);
    await fireEvent.press(await ui.findByLabelText("Mở thẻ góc đài"));
    expect(mockTabs.setOptions).toHaveBeenLastCalledWith({ tabBarStyle: { display: "none" } });
    await act(async () => listeners.beforeRemove({ preventDefault: jest.fn() }));
    expect(mockTabs.setOptions).toHaveBeenLastCalledWith({ tabBarStyle: undefined });
  });
});
