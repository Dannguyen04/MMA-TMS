/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { campApi } from "@/features/fight-camp/api";
import { listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { FighterPlansTab } from "./plans-tab";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }), usePathname: () => "/giao-an" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0, useNavRail: () => false }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/tab-icon", () => ({ TabIcon: () => null }));
jest.mock("@/screens/fighter/redesign/palette", () => ({ useFighterPalette: () => ({ bg: "#000", line: "#111", activeInk: "#C23A22", muted: "#666", accentSoft: "#fee" }) }));
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", canFetch: true, isDemo: false }) }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/features/fight-camp/api", () => ({ campApi: { list: jest.fn() } }));
jest.mock("@/screens/fighter/api", () => ({ listPlansForFighter: jest.fn(), listSessionsForFighter: jest.fn() }));

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const plan = (over: object) => ({ id: "p", title: "Plan", phase: "base", status: "ACTIVE", startDate: day(-3), endDate: day(52), milestones: [], ...over });
const page = (data: unknown[]) => ({ data, total: data.length, page: 1, limit: 50 }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(campApi.list).mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
  jest.mocked(listSessionsForFighter).mockResolvedValue(page([]));
  jest.mocked(listPlansForFighter).mockResolvedValue(page([]));
});

describe("fighter Giáo án tab", () => {
  it("spotlights the bout's plan with the bout date, and lists the rest as rows", async () => {
    const bout = { ...previewBout, status: "CAMP", boutAt: `${day(20)}T12:00:00.000Z` } as never;
    jest.mocked(campApi.list).mockResolvedValue({ data: [bout], hasNextPage: false, nextCursor: null });
    jest.mocked(listPlansForFighter).mockResolvedValue(page([
      plan({ id: "base", title: "Nền tảng", startDate: day(-1) }),
      plan({ id: "camp", title: "Trại thi đấu", phase: "fight_camp", startDate: day(-10) }),
      plan({ id: "old", title: "Cũ", status: "COMPLETED", startDate: day(-90), endDate: day(-30) }),
      plan({ id: "draft", title: "Nháp", status: "DRAFT" }),
    ]));
    const ui = await render(<FighterPlansTab/>);
    const spot = await ui.findByTestId("plans-current");
    expect(within(spot).getByText("Trại thi đấu")).toBeTruthy();
    expect(within(spot).getByText(new RegExp(`cho trận ${day(20).slice(8, 10)}/${day(20).slice(5, 7)}`))).toBeTruthy();
    expect(within(spot).getByLabelText("Tuần 2 trên 9")).toBeTruthy();
    expect(ui.getByTestId("plan-base")).toBeTruthy();
    expect(ui.getByTestId("plan-old")).toBeTruthy();
    expect(ui.queryByTestId("plan-draft")).toBeNull();
    fireEvent.press(within(spot).getByText("Xem giáo án"));
    expect(mockPush).toHaveBeenCalledWith("/giao-an/camp");
  });

  it("hides the sessions count when the plan has no sessions, and says when nothing is booked", async () => {
    jest.mocked(listPlansForFighter).mockResolvedValue(page([plan({ progress: { completedSessions: 0, totalSessions: 0 } })]));
    const ui = await render(<FighterPlansTab/>);
    const spot = await ui.findByTestId("plans-current");
    expect(within(spot).queryByText("Buổi đã tập")).toBeNull();
    expect(within(spot).getByText("Chưa có buổi nào")).toBeTruthy();
  });

  it("says so when no plan is running, and keeps the library row", async () => {
    const ui = await render(<FighterPlansTab/>);
    expect(await ui.findByTestId("plans-none")).toBeTruthy();
    fireEvent.press(ui.getByTestId("plans-library"));
    expect(mockPush).toHaveBeenCalledWith("/giao-an/bai-tap");
  });

  it("retries every source from the error state", async () => {
    jest.mocked(listPlansForFighter).mockRejectedValueOnce(new Error("down"));
    const ui = await render(<FighterPlansTab/>);
    const failed = await ui.findByTestId("plans-failed");
    fireEvent.press(within(failed).getByText("Thử lại"));
    expect(await ui.findByTestId("plans-none")).toBeTruthy();
    expect(listPlansForFighter).toHaveBeenCalledTimes(2);
    expect(campApi.list).toHaveBeenCalledTimes(2);
    expect(listSessionsForFighter).toHaveBeenCalledTimes(2);
  });
});
