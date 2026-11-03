/// <reference types="jest" />
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { campApi } from "@/api/fight-camp";
import { createFighterMeasurement, listFighterMeasurements, supersedeFighterMeasurement } from "@/api/fighters";
import { dayKey } from "./camp-rules";
import { previewBout } from "./camp-preview";
import { FighterCampScreen, FighterDailyWeightScreen } from "./fighter-camp-screen";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useFocusEffect: () => undefined }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "u1", profile: { id: "f1" } } }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/api/fighters", () => ({ createFighterMeasurement: jest.fn(), listFighterMeasurements: jest.fn(), supersedeFighterMeasurement: jest.fn() }));
jest.mock("@/api/fight-camp", () => ({ campApi: { list: jest.fn(), detail: jest.fn(), weightTrack: jest.fn(), suspensions: jest.fn() } }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());

const api = campApi as jest.Mocked<typeof campApi>;
const today = dayKey(new Date());
const bout = { ...previewBout, id: "b1", status: "FIGHT_WEEK" as const };
const track = (latestOn: string | null) => ({ limitKg: 60, points: [{ date: today, kg: 60.4 }], latestKg: 60.4, latestOn, remainingPct: 0.7, status: "ON_TRACK" as const, referencePath: [] });
beforeEach(() => {
  jest.clearAllMocks();
  api.list.mockResolvedValue({ data: [bout], hasNextPage: false, nextCursor: null });
  api.detail.mockResolvedValue(bout);
  api.suspensions.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
});

describe("Fighter home", () => {
  it("puts an active suspension and what it still allows on Trận của tôi", async () => {
    api.weightTrack.mockResolvedValue(track("2026-10-20"));
    api.suspensions.mockResolvedValue({ data: [{ id: "s1", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING", "STRENGTH_CONDITIONING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null }], hasNextPage: false, nextCursor: null });
    const ui = await render(<FighterCampScreen/>);
    await ui.findByText("Đang đình chỉ đến 01/11");
    expect(ui.getByText("Lý do: Nghỉ bắt buộc")).toBeTruthy();
    expect(ui.getByText("Hôm nay được tập: phục hồi, vật lý trị liệu")).toBeTruthy();
    expect(ui.getByText("Xem lịch sử đình chỉ")).toBeTruthy();
    expect(ui.getByLabelText("Ghi cân hôm nay")).toBeTruthy();
  });
  it("offers Sửa cân hôm nay once today's weight is logged, and flags over-limit with the limit", async () => {
    api.weightTrack.mockResolvedValue({ ...track(today), status: "OVER_LIMIT" });
    const ui = await render(<FighterCampScreen/>);
    await ui.findByLabelText("Sửa cân hôm nay");
    expect(ui.queryByLabelText("Ghi cân hôm nay")).toBeNull();
    expect(ui.getByText("Vượt giới hạn · giới hạn 60,0 kg")).toBeTruthy();
    expect(ui.getByText(/Báo HLV/)).toBeTruthy();
  });
});
describe("Daily weight: one entry per day", () => {
  it("supersedes today's entry instead of adding a second one", async () => {
    api.weightTrack.mockResolvedValue(track(today));
    (listFighterMeasurements as jest.Mock).mockResolvedValue({ data: [{ id: "m1", weightKg: 60.4, measuredAt: new Date().toISOString() }] });
    (supersedeFighterMeasurement as jest.Mock).mockResolvedValue({ id: "m2", weightKg: 60.1 });
    const ui = await render(<FighterDailyWeightScreen/>);
    await ui.findByText("Sửa cân hôm nay");
    expect(ui.getByText("Hôm nay đã ghi 60,4 kg")).toBeTruthy();
    await fireEvent.changeText(ui.getByLabelText("Cân nặng hôm nay"), "60,1");
    await fireEvent.press(ui.getByLabelText("Lưu số cân đã sửa"));
    await ui.findByText("Đã lưu số cân hôm nay");
    expect(supersedeFighterMeasurement).toHaveBeenCalledWith("f1", "m1", { weightKg: 60.1, measurementContext: "SELF_REPORTED" });
    expect(createFighterMeasurement).not.toHaveBeenCalled();
  });
  it("creates the first entry of the day, and blocks saving until today's check can load", async () => {
    api.weightTrack.mockResolvedValue(track("2026-10-20"));
    (listFighterMeasurements as jest.Mock).mockRejectedValueOnce(new Error("Mất mạng")).mockResolvedValueOnce({ data: [{ id: "old", weightKg: 61, measuredAt: "2026-10-20T07:00:00+07:00" }] });
    (createFighterMeasurement as jest.Mock).mockResolvedValue({ id: "m3", weightKg: 60.2 });
    const ui = await render(<FighterDailyWeightScreen/>);
    await ui.findByText("Chưa kiểm tra được số cân hôm nay");
    expect(ui.getByLabelText("Lưu cân hôm nay").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getAllByLabelText("Thử tải lại").at(-1)!);
    await waitFor(() => expect(ui.queryByText("Chưa kiểm tra được số cân hôm nay")).toBeNull());
    await fireEvent.changeText(ui.getByLabelText("Cân nặng hôm nay"), "60,2");
    await fireEvent.press(ui.getByLabelText("Lưu cân hôm nay"));
    await ui.findByText("Đã ghi cân hôm nay");
    expect(createFighterMeasurement).toHaveBeenCalledWith("f1", { weightKg: 60.2, measurementContext: "SELF_REPORTED" });
  });
});
