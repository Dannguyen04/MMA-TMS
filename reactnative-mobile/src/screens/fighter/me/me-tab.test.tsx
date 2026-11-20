/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { listFighterDoctors } from "@/api";
import { getMe } from "@/screens/fighter/api";
import { activeDoctor, facts, initials, stats } from "./me-model";
import { FighterMeV2 } from "./me-tab";
import { FighterMyProfile } from "./my-profile";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }), usePathname: () => "/toi" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }),
  useAppearanceState: () => ({ applied: jest.requireActual("@/theme/appearance/settings").DEFAULT_APPEARANCE }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0, useNavRail: () => false }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/components/tab-icon", () => ({ TabIcon: () => null }));
jest.mock("@/screens/fighter/redesign/palette", () => ({ useFighterPalette: () => ({ bg: "#000", line: "#111", activeInk: "#C23A22", muted: "#666", accentSoft: "#fee", ink: "#111", danger: "#c00", surface: "#fff", surface2: "#eee" }) }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/session/session-context", () => ({ useSession: () => ({ signOut: mockSignOut }) }));
jest.mock("@/api", () => ({ ...jest.requireActual("@/api"), listFighterDoctors: jest.fn() }));
jest.mock("@/screens/fighter/api", () => ({ getMe: jest.fn() }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));

const base = { id: "f1", firstName: "An", lastName: "Nguyễn Văn", gym: "Lotus MMA", weightClass: "LIGHTWEIGHT", dominantStance: "ORTHODOX", heightCm: 175, reachCm: 180, dateOfBirth: "2001-03-14", nationality: "VN", bio: "Mạnh về vật. Đang chuẩn bị cho giải." };
let mockProfile: Record<string, unknown> = base;
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", canFetch: true, isDemo: false, profile: mockProfile, user: { email: "an@lotus.vn" } }) }));
const page = (data: unknown[]) => ({ data, total: data.length, page: 1, limit: 20, hasNextPage: false }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = base;
  jest.mocked(getMe).mockResolvedValue({ email: "an@lotus.vn", profile: { ...base, userId: "u1" } } as never);
  jest.mocked(listFighterDoctors).mockResolvedValue(page([
    { id: "a0", doctorName: "BS. Cũ", startsAt: "2026-01-02T03:00:00.000Z", endsAt: "2026-05-01T03:00:00.000Z" },
    { id: "a1", doctorName: "BS. Trần Thu Hà", startsAt: "2026-09-02T03:00:00.000Z", endsAt: null },
  ]));
});

describe("Tôi model", () => {
  it("builds initials, stats and personal facts, with a dash for what is missing", () => {
    const thin = { firstName: "minh", lastName: "lê", weightClass: "LIGHTWEIGHT", heightCm: null };
    expect(initials(thin)).toBe("ML");
    expect(stats(thin).map(s => s.value)).toEqual([expect.any(String), null, null, null]);
    expect(stats(base)[2]).toEqual({ label: "Chiều cao", value: "175", unit: "cm" });
    expect(facts(thin, null).map(f => f.value)).toEqual(["lê", "minh", "–", "–", "–"]);
  });

  it("picks the doctor in charge now", () => {
    expect(activeDoctor([{ endsAt: "x" }, { endsAt: null, id: "now" }] as never)?.id).toBe("now");
    expect(activeDoctor([])).toBeNull();
  });
});

describe("fighter Tôi tab", () => {
  it("shows the identity, the stats and the doctor, and every row opens its page", async () => {
    const ui = await render(<FighterMeV2/>);
    expect(ui.getByText("An Nguyễn Văn")).toBeTruthy();
    expect(within(ui.getByTestId("me-stats")).getByLabelText("Chiều cao: 175 cm")).toBeTruthy();
    expect(await ui.findByLabelText("BS. Trần Thu Hà. Bác sĩ phụ trách · từ 02/09")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("me-identity"));
    expect(mockPush).toHaveBeenLastCalledWith("/ca-nhan");
    // Giao diện lives in Cài đặt only; the row says what is in use.
    expect(ui.queryByTestId("me-appearance")).toBeNull();
    expect(ui.getByLabelText("Cài đặt. Thông báo · Giao diện: Theo máy, chữ 100%")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("me-settings"));
    expect(mockPush).toHaveBeenLastCalledWith("/cai-dat");
    await fireEvent.press(ui.getByTestId("me-admission"));
    expect(mockPush).toHaveBeenLastCalledWith("/ho-so-cua-toi");
  });

  it("says when no doctor is in charge, and retries the doctor alone when it fails", async () => {
    jest.mocked(listFighterDoctors).mockRejectedValueOnce(new Error("x")).mockResolvedValue(page([]));
    const ui = await render(<FighterMeV2/>);
    expect(await ui.findByText("Không tải được bác sĩ")).toBeTruthy();
    await fireEvent.press(ui.getByText("Thử lại"));
    expect(await ui.findByTestId("me-doctor-none")).toBeTruthy();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("asks before signing out", async () => {
    const ui = await render(<FighterMeV2/>);
    await fireEvent.press(ui.getByTestId("me-logout"));
    expect(mockSignOut).not.toHaveBeenCalled();
    await fireEvent.press(ui.getAllByText("Đăng xuất").at(-1)!);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});

describe("Hồ sơ của tôi", () => {
  it("lists the personal fields and the bio one sentence per line", async () => {
    const ui = await render(<FighterMyProfile/>);
    const p = await ui.findByTestId("my-profile");
    expect(within(p).getByLabelText("Họ: Nguyễn Văn")).toBeTruthy();
    expect(within(p).getByLabelText("Email: an@lotus.vn")).toBeTruthy();
    expect(within(p).getByText("Mạnh về vật.")).toBeTruthy();
    expect(within(p).getByText("Đang chuẩn bị cho giải.")).toBeTruthy();
  });
});
