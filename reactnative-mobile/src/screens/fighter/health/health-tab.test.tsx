/// <reference types="jest" />
import { act, fireEvent, render, within } from "@testing-library/react-native";
import { getFighterMedical, listFighterReviewRequests } from "@/api/medical";
import { oneTapApi } from "@/api/one-tap";
import { FighterHealthTab } from "./health-tab";

const mockPush = jest.fn();
let mockSuspensions: unknown[] | null = [];
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), usePathname: () => "/co-the" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0, useNavRail: () => false }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/tab-icon", () => ({ TabIcon: () => null }));
jest.mock("@/screens/fighter/redesign/palette", () => ({ useFighterPalette: () => ({ bg: "#000", line: "#111", activeInk: "#C23A22", muted: "#666", accentSoft: "#fee" }) }));
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", canFetch: true, isDemo: false }) }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/features/fight-camp/components/fighter-suspension", () => ({ useFighterSuspensions: () => ({ items: mockSuspensions, error: false, reload: jest.fn() }) }));
jest.mock("@/api/medical", () => ({ getFighterMedical: jest.fn(), listFighterReviewRequests: jest.fn() }));
jest.mock("@/api/one-tap", () => ({ oneTapApi: { createMedicalReviewRequest: jest.fn() } }));
// Jest has no GL: the 3D canvas becomes a View that reports ready.
jest.mock("@/components/body3d/body-canvas", () => {
  const { useEffect } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: (p: { onReady: () => void }) => { useEffect(() => { p.onReady(); }, []); return <View testID="mock-canvas"/>; } };
});
jest.mock("@/components/body3d/reduced-motion", () => ({ useReducedMotion: () => false }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));

const ok = { eligible: true, reasons: [] };
const dossier = (over: object = {}) => ({
  fighterId: "f1", activeInjuries: [], activeRecoveryPlans: [], currentExaminations: { training: { id: "e1", decision: "ELIGIBLE", restrictions: null }, competition: null },
  activeClearances: [], openReviewRequests: [], eligibility: { training: ok, competition: ok }, ...over,
}) as never;
const page = (data: unknown[]) => ({ data, total: data.length, page: 1, limit: 20, hasNextPage: false }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockSuspensions = [];
  jest.mocked(getFighterMedical).mockResolvedValue(dossier());
  jest.mocked(listFighterReviewRequests).mockResolvedValue(page([]));
});

describe("fighter Cơ thể tab", () => {
  it("answers whether the fighter can train, and lists the records", async () => {
    const ui = await render(<FighterHealthTab/>);
    const v = await ui.findByTestId("health-verdict");
    expect(within(v).getByLabelText("Được tập")).toBeTruthy();
    expect(within(v).getByLabelText("Sơ đồ cơ thể. Không có chấn thương")).toBeTruthy();
    expect(within(v).getByText("Được tập luyện và thi đấu.")).toBeTruthy();
    expect(within(v).getByLabelText("Tập luyện: Được. Xem giới hạn của bác sĩ")).toBeTruthy();
    expect(ui.getByTestId("health-exam")).toBeTruthy();
    fireEvent.press(ui.getByTestId("health-history"));
    expect(mockPush).toHaveBeenCalledWith("/suc-khoe/lich-su");
  });

  it("links each injury to its page", async () => {
    jest.mocked(getFighterMedical).mockResolvedValue(dossier({ activeInjuries: [{ id: "i1", affectedJoint: "LEFT_SHOULDER", injuryType: "bong gân", status: "ACTIVE", occurredAt: "2026-11-02T03:00:00.000Z", severity: "MODERATE" }] }));
    const ui = await render(<FighterHealthTab/>);
    const v = await ui.findByTestId("health-verdict");
    expect(within(v).getByLabelText("Sơ đồ cơ thể. Chấn thương: Vai trái")).toBeTruthy();
    expect(within(v).getByText("Vai trái", { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(await ui.findByTestId("health-injury-i1"));
    expect(mockPush).toHaveBeenCalledWith("/suc-khoe/chan-thuong/i1");
  });

  it("shows the wait instead of the button while a request is open, and counts it on the tab", async () => {
    const open = { id: "r1", reason: "Chấn thương mới", status: "OPEN", requestedAt: "2026-11-10T07:20:00.000Z", resolvedAt: null };
    jest.mocked(getFighterMedical).mockResolvedValue(dossier({ openReviewRequests: [open], eligibility: { training: { eligible: false, reasons: ["REVIEW_REQUEST_PENDING"] }, competition: ok } }));
    jest.mocked(listFighterReviewRequests).mockResolvedValue(page([open]));
    const ui = await render(<FighterHealthTab/>);
    const v = await ui.findByTestId("health-verdict");
    expect(within(v).getByLabelText("Chưa được tập")).toBeTruthy();
    expect(within(v).getByLabelText("Đang chờ bác sĩ, gửi 10/11")).toBeTruthy();
    expect(within(v).queryByText("Gửi yêu cầu khám")).toBeNull();
    fireEvent.press(ui.getByText("Yêu cầu khám · 1"));
    expect(await ui.findByLabelText("Chấn thương mới. Đang chờ bác sĩ · gửi 10/11 14:20")).toBeTruthy();
  });

  it("sends one request from the sheet, with a written reason for Khác", async () => {
    jest.mocked(oneTapApi.createMedicalReviewRequest).mockResolvedValue({} as never);
    const ui = await render(<FighterHealthTab/>);
    const v = await ui.findByTestId("health-verdict");
    fireEvent.press(within(v).getByText("Gửi yêu cầu khám"));
    const sheet = await ui.findByTestId("request-sheet");
    expect(within(sheet).getByLabelText("Gửi yêu cầu").props.accessibilityState.disabled).toBe(true);
    await act(async () => { fireEvent.press(within(sheet).getByText("Khác")); });
    await fireEvent.changeText(await ui.findByLabelText("Lý do khác"), "Đau gối");
    await act(async () => { fireEvent.press(ui.getByLabelText("Gửi yêu cầu")); });
    expect(oneTapApi.createMedicalReviewRequest).toHaveBeenCalledWith("f1", { reason: "Đau gối" });
    expect(getFighterMedical).toHaveBeenCalledTimes(2);
  });

  it("reads a suspension in force and links to it", async () => {
    mockSuspensions = [{ id: "s1", reason: "KO", status: "ACTIVE", startsOn: "2026-11-01", endsOn: "2026-11-20", blockedSessionTypes: ["SPARRING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 2, gradedReturn: null }];
    const ui = await render(<FighterHealthTab/>);
    const v = await ui.findByTestId("health-verdict");
    expect(within(v).getByLabelText("Theo đình chỉ")).toBeTruthy();
    expect(within(v).getByLabelText(/Đình chỉ sau knock-out$/)).toBeTruthy();
    fireEvent.press(ui.getByTestId("health-suspension"));
    expect(mockPush).toHaveBeenCalledWith("/tran/dinh-chi");
  });

  it("retries the dossier from the error state", async () => {
    jest.mocked(getFighterMedical).mockRejectedValueOnce(new Error("down"));
    const ui = await render(<FighterHealthTab/>);
    const failed = await ui.findByTestId("health-failed");
    fireEvent.press(within(failed).getByText("Thử lại"));
    expect(await ui.findByTestId("health-verdict")).toBeTruthy();
  });
});
