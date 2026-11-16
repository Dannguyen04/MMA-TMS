/// <reference types="jest" />
import { render, within } from "@testing-library/react-native";
import { getFighterMedical } from "@/api";
import { campApi } from "@/api/fight-camp";
import { listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { videoAiApi } from "@/api/video-ai";
import { previewBout } from "@/screens/fight-camp/camp-preview";
import { FighterHomeV2 } from "./fighter-home-v2";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), usePathname: () => "/" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0, useNavRail: () => false }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/tab-icon", () => ({ TabIcon: () => null }));
jest.mock("@/screens/fighter/redesign/palette", () => ({ useFighterPalette: () => ({ bg: "#000", line: "#111", activeInk: "#C23A22", muted: "#666", accentSoft: "#fee" }) }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "u1" } }) }));
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", profile: { firstName: "Minh" }, canFetch: true, isDemo: false }) }));
jest.mock("@/screens/fight-camp/camp-ui", () => require("@/screens/fight-camp/camp-test-ui").campUiMock());
jest.mock("@/screens/fight-camp/fighter-suspension", () => ({ useFighterSuspensions: () => ({ items: [], error: false, reload: jest.fn(async () => undefined) }) }));
jest.mock("@/api", () => ({ getFighterMedical: jest.fn() }));
jest.mock("@/api/fight-camp", () => ({ campApi: { list: jest.fn(), detail: jest.fn() } }));
jest.mock("@/api/notifications", () => ({ getUnreadNotificationCount: jest.fn(async () => 0) }));
jest.mock("@/api/video-ai", () => ({ videoAiApi: { listJobs: jest.fn() } }));
jest.mock("@/screens/fighter/api", () => ({ listPlansForFighter: jest.fn(), listSessionsForFighter: jest.fn() }));

const medical = (eligible: boolean) => ({ eligibility: { training: { scope: "TRAINING", eligible, reasons: [] } } }) as never;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(campApi.list).mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
  jest.mocked(listSessionsForFighter).mockResolvedValue({ data: [], total: 0, page: 1, limit: 30 } as never);
  jest.mocked(listPlansForFighter).mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 } as never);
  jest.mocked(videoAiApi.listJobs).mockResolvedValue([] as never);
  jest.mocked(getFighterMedical).mockResolvedValue(medical(true));
});

describe("fighter home (redesign)", () => {
  it("keeps the fighter tab bar under the home screen", async () => {
    const ui = await render(<FighterHomeV2/>);
    const bar = await ui.findByTestId("tab-bar");
    expect(within(bar).getByLabelText("Tôi")).toBeTruthy();
    expect(within(bar).getByLabelText("Tập")).toBeTruthy();
  });

  it("leads with the doctor's block instead of the rest day when training is not cleared", async () => {
    jest.mocked(getFighterMedical).mockResolvedValue(medical(false));
    const ui = await render(<FighterHomeV2/>);
    const card = await ui.findByTestId("home-blocked");
    expect(within(card).getByText("Bác sĩ chưa cho phép tập lại.")).toBeTruthy();
    expect(ui.queryByTestId("home-rest")).toBeNull();
    expect(within(card).getByText("Xem lý do")).toBeTruthy();
  });

  it("shows the rest day when cleared and nothing is scheduled today", async () => {
    const ui = await render(<FighterHomeV2/>);
    expect(await ui.findByTestId("home-rest")).toBeTruthy();
    expect(ui.queryByTestId("home-blocked")).toBeNull();
  });

  it("shows the bout card with the countdown and limit while in a fight camp, even when not cleared", async () => {
    jest.mocked(getFighterMedical).mockResolvedValue(medical(false));
    const bout = { ...previewBout, status: "CAMP", weighInAt: inDays(5), boutAt: inDays(6), catchweightKg: null, weightLimitKg: 70.3 } as never;
    jest.mocked(campApi.list).mockResolvedValue({ data: [bout], hasNextPage: false, nextCursor: null });
    jest.mocked(campApi.detail).mockResolvedValue(bout);
    const ui = await render(<FighterHomeV2/>);
    const card = await ui.findByTestId("home-bout");
    expect(within(card).getByText("70,3 kg")).toBeTruthy();
    expect(within(card).getByLabelText(/^Còn \d ngày tới cân chính thức$/)).toBeTruthy();
    expect(ui.queryByTestId("home-blocked")).toBeNull();
  });
});
