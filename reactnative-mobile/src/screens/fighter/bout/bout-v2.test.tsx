/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { campApi } from "@/features/fight-camp/api";
import { createFighterMeasurement, listFighterMeasurements, supersedeFighterMeasurement } from "@/api/fighters/fighters";
import { loadAllSuspensions } from "@/features/fight-camp/components/fighter-suspension";
import { gateView, overBy, splitSuspensions, suspensionRow, weighedLine, weightWord } from "./bout-model";
import { FighterBoutV2 } from "./bout-screen";
import { FighterWeighV2 } from "./weigh-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }), useFocusEffect: () => undefined, usePathname: () => "/tran" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/session/session-context", () => ({ useSession: () => ({ user: { id: "u1", role: "FIGHTER", profile: { id: "f1" } }, isDemo: false }) }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/features/fight-camp/api", () => ({ campApi: { list: jest.fn(), detail: jest.fn(), weightTrack: jest.fn() } }));
jest.mock("@/api/fighters/fighters", () => ({ listFighterMeasurements: jest.fn(), createFighterMeasurement: jest.fn(), supersedeFighterMeasurement: jest.fn() }));
jest.mock("@/features/fight-camp/components/fighter-suspension", () => ({ loadAllSuspensions: jest.fn() }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));

const today = new Date().toISOString();
const clearStorage = () => { const m = require("@react-native-async-storage/async-storage"); return (m.default ?? m).clear(); };
const req = (code: string, status: string, label = code) => ({ code, label, required: true, status, validUntil: "2026-12-31" });
const bout = (over: object = {}) => ({
  id: "b1", fighterId: "f1", eventName: "Lotus Fight Night 12", opponentName: "Lê Hoàng Phúc", venue: "Phú Thọ", weightLimitKg: 77, catchweightKg: null,
  weighInAt: "2099-11-22T02:00:00.000Z", boutAt: "2099-11-23T12:30:00.000Z", status: "CAMP",
  requirements: [req("CONTRACT", "CONFIRMED", "Hợp đồng"), req("MEDICAL", "CONFIRMED", "Giấy khám")], ...over,
}) as never;
const track = (over: object = {}) => ({ limitKg: 77, latestKg: 77.6, latestOn: "2026-11-01", status: "ON_TRACK", remainingPct: 1, points: [{ date: "2026-10-30", kg: 78.2 }, { date: "2026-11-01", kg: 77.6 }], referencePath: [], ...over }) as never;
const susp = (over: object = {}) => ({ id: "s1", reason: "KO", status: "ACTIVE", startsOn: "2026-11-06", endsOn: "2026-12-06", blockedSessionTypes: ["SPARRING"], requiresClearance: true, clearedAt: null, clearanceNote: null, maxAllowedTier: 3, gradedReturn: null, ...over }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(campApi.list).mockResolvedValue({ data: [{ id: "b1", status: "CAMP" }], hasNextPage: false, nextCursor: null } as never);
  jest.mocked(campApi.detail).mockResolvedValue(bout());
  jest.mocked(campApi.weightTrack).mockResolvedValue(track());
  jest.mocked(loadAllSuspensions).mockResolvedValue([]);
  jest.mocked(listFighterMeasurements).mockResolvedValue({ data: [] } as never);
});

describe("Trận model", () => {
  it("words the weight and the kg over the limit", () => {
    expect(weightWord(track())).toEqual({ word: "Đang theo lộ trình", tone: "ok" });
    expect(overBy(track({ status: "OVER_LIMIT", latestKg: 77.9 }))).toBe("0,9");
    expect(overBy(track())).toBeNull();
    expect(weighedLine(today)).toBe("Hôm nay");
    expect(weighedLine("2026-11-01T05:00:00.000Z", new Date("2026-11-03T05:00:00.000Z"))).toBe("01/11 · chưa ghi hôm nay");
  });

  it("blocks the bout while a paper is missing, only before fight week", () => {
    const missing = bout({ requirements: [req("MEDICAL", "MISSING", "Giấy khám")] });
    expect(gateView(missing).lines).toEqual(["Chưa vào được tuần thi đấu.", "Còn thiếu: Giấy khám."]);
    expect(gateView(missing).count).toBe(1);
    expect(gateView(bout({ status: "FIGHT_WEEK", requirements: [req("MEDICAL", "MISSING")] })).lines).toEqual([]);
  });

  it("sums up suspensions for the row and splits the page", () => {
    expect(suspensionRow(null)).toEqual({ line: "Không tải được đình chỉ", warn: true });
    expect(suspensionRow([])).toEqual({ line: "Không có đình chỉ", warn: false });
    expect(suspensionRow([susp()])).toEqual({ line: "Đang đình chỉ đến 06/12", warn: true });
    const s = splitSuspensions([susp({ id: "old", status: "ENDED", endsOn: "2026-08-16" }), susp()]);
    expect(s.live.map(x => x.id)).toEqual(["s1"]);
    expect(s.past.map(x => x.id)).toEqual(["old"]);
  });
});

describe("Trận screen", () => {
  it("shows the bout, the weight, the facts, and opens Ghi cân", async () => {
    const ui = await render(<FighterBoutV2/>);
    expect(await ui.findByTestId("fighter-bout-v2")).toBeTruthy();
    expect(ui.getByText("Lotus Fight Night 12")).toBeTruthy();
    expect(ui.getByLabelText(/^77,6 kg\. Đang theo lộ trình\./)).toBeTruthy();
    expect(within(ui.getByTestId("bout-facts")).getByLabelText("Giới hạn: 77,0 kg")).toBeTruthy();
    expect(ui.getByLabelText("Đình chỉ. Không có đình chỉ")).toBeTruthy();
    await fireEvent.press(ui.getByText("Ghi cân hôm nay"));
    expect(mockPush).toHaveBeenCalledWith("/tran/can-nang");
  });

  it("says how far over the limit, and counts missing papers on the tab", async () => {
    jest.mocked(campApi.weightTrack).mockResolvedValue(track({ status: "OVER_LIMIT", latestKg: 77.9 }));
    jest.mocked(campApi.detail).mockResolvedValue(bout({ requirements: [req("MEDICAL", "MISSING", "Giấy khám")] }));
    const ui = await render(<FighterBoutV2/>);
    expect(await ui.findByText("Hơn giới hạn 0,9 kg.")).toBeTruthy();
    await fireEvent.press(ui.getByText("Hồ sơ thi đấu · 1"));
    expect(ui.getByText("Còn thiếu: Giấy khám.")).toBeTruthy();
    expect(ui.getByLabelText("Giấy khám. Còn thiếu")).toBeTruthy();
  });

  it("still offers Ghi cân without a bout, and never lists measurements as a fighter", async () => {
    jest.mocked(campApi.list).mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null } as never);
    const ui = await render(<FighterBoutV2/>);
    expect(await ui.findByText("Chưa có trận sắp tới")).toBeTruthy();
    expect(ui.getByText("Ghi cân hôm nay")).toBeTruthy();
    expect(listFighterMeasurements).not.toHaveBeenCalled();
  });
});

describe("Ghi cân", () => {
  it("creates today's weight and remembers it on this phone", async () => {
    await clearStorage();
    jest.mocked(createFighterMeasurement).mockResolvedValue({ id: "m2", weightKg: 77.4 } as never);
    const ui = await render(<FighterWeighV2/>);
    await fireEvent.changeText(await ui.findByTestId("weigh-input"), "77,4");
    await fireEvent.press(ui.getByText("Lưu cân hôm nay"));
    expect(createFighterMeasurement).toHaveBeenCalledWith("f1", { weightKg: 77.4, measurementContext: "SELF_REPORTED" });
    expect(await ui.findByText("Đã ghi cân hôm nay")).toBeTruthy();
    const m = require("@react-native-async-storage/async-storage");
    expect(JSON.parse(await (m.default ?? m).getItem("mma.weigh.today.f1"))).toMatchObject({ id: "m2", kg: 77.4 });
    expect(listFighterMeasurements).not.toHaveBeenCalled();
  });

  it("replaces the weight this phone saved today", async () => {
    const m = require("@react-native-async-storage/async-storage");
    await (m.default ?? m).setItem("mma.weigh.today.f1", JSON.stringify({ id: "m2", kg: 77.4, on: today }));
    jest.mocked(supersedeFighterMeasurement).mockResolvedValue({ id: "m3", weightKg: 77.2 } as never);
    const ui = await render(<FighterWeighV2/>);
    expect(await ui.findByText("Hôm nay đã ghi 77,4 kg.")).toBeTruthy();
    await fireEvent.changeText(ui.getByTestId("weigh-input"), "77,2");
    await fireEvent.press(ui.getByText("Lưu số cân đã sửa"));
    expect(supersedeFighterMeasurement).toHaveBeenCalledWith("f1", "m2", { weightKg: 77.2, measurementContext: "SELF_REPORTED" });
  });

  it("knows today's weight from the bout track on another phone, and adds a new entry", async () => {
    jest.mocked(campApi.weightTrack).mockResolvedValue(track({ latestOn: today, latestKg: 77.5 }));
    jest.mocked(createFighterMeasurement).mockResolvedValue({ id: "m9", weightKg: 77.1 } as never);
    await clearStorage();
    const ui = await render(<FighterWeighV2/>);
    expect(await ui.findByText("Hôm nay đã ghi 77,5 kg.")).toBeTruthy();
    await fireEvent.changeText(ui.getByTestId("weigh-input"), "77,1");
    await fireEvent.press(ui.getByText("Lưu số cân đã sửa"));
    expect(createFighterMeasurement).toHaveBeenCalledWith("f1", { weightKg: 77.1, measurementContext: "SELF_REPORTED" });
  });

  it("rejects a weight it cannot read", async () => {
    await clearStorage();
    const ui = await render(<FighterWeighV2/>);
    await fireEvent.changeText(await ui.findByTestId("weigh-input"), "abc");
    await fireEvent.press(ui.getByText("Lưu cân hôm nay"));
    expect(await ui.findByTestId("weigh-error")).toBeTruthy();
    expect(createFighterMeasurement).not.toHaveBeenCalled();
  });
});
