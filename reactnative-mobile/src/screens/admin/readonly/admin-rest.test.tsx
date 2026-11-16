import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { assignmentLine } from "./admin-fighter-doctors-screen";
import { userInitials } from "./admin-users-screen";

const mockPush = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());
let mockParams: Record<string, string> = {};

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({ isDemo: false, user: { id: "u-a", role: "ADMIN", email: "admin@lotus-combat.test", profile: null }, signOut: mockSignOut }),
}));
const users = [
  { id: "u1", email: "thu.le@lotus-combat.test", role: "DOCTOR", isActive: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z", profile: { id: "d1", firstName: "Thu", lastName: "Lê", specialization: "Sports Medicine" } },
  { id: "u2", email: "kenji@lotus-combat.test", role: "FIGHTER", isActive: false, createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-11-10T00:00:00Z",
    profile: { id: "f2", firstName: "Kenji", lastName: "Morita", weightClass: "FEATHERWEIGHT", dateOfBirth: "1999-03-14", gym: "Lotus Combat Academy" } },
];
jest.mock("@/api/admin", () => ({
  adminApi: {
    listUsers: () => Promise.resolve({ items: mockUsers, total: 2, page: 1, limit: 20 }),
    getUser: (id: string) => Promise.resolve(mockUsers.find((u: { id: string }) => u.id === id)),
    listFighterDoctors: () => Promise.resolve({ data: [
      { id: "a1", doctorId: "d1", doctorName: "Thu Lê", startsAt: "2026-09-21T00:00:00Z", endsAt: null },
      { id: "a2", doctorId: "d9", doctorName: "Nguyễn An", startsAt: "2026-03-02T00:00:00Z", endsAt: "2026-09-20T00:00:00Z" },
    ], total: 2, hasNextPage: false }),
    listFighterCoaches: () => Promise.resolve([{ id: "c1", coachName: "Lê Hùng", startsAt: "2026-09-01T00:00:00Z", endsAt: null }]),
  },
}));
jest.mock("@/api/coach", () => ({ coachApi: { getFighter: () => Promise.resolve({ id: "f2", firstName: "Kenji", lastName: "Morita", weightClass: "FEATHERWEIGHT", gym: "Lotus Combat Academy" }) } }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUsers: any = users;

const wrap = (el: React.ReactElement) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <ThemePreferenceProvider>{el}</ThemePreferenceProvider>
  </SafeAreaProvider>,
);

beforeEach(() => {
  mockPush.mockClear();
  mockParams = {};
});

describe("admin rows (step 22)", () => {
  it("initials and assignment lines", () => {
    expect(userInitials("Thu Lê")).toBe("TL");
    expect(userInitials("admin")).toBe("AD");
    expect(userInitials("quang.vu")).toBe("QV");
    expect(userInitials("Master coach_870247")).toBe("MC");
    expect(userInitials("Thu Lê")).toBe("TL");
    expect(assignmentLine({ from: "2026-09-21T00:00:00Z", to: null })).toBe("từ 21/09/2026");
    expect(assignmentLine({ from: "2026-03-02T00:00:00Z", to: "2026-09-20T00:00:00Z" })).toBe("02/03/2026 – 20/09/2026");
  });

  it("Người dùng: one row per account, locked shows Đã khóa, a row opens the user page", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdminUsersListScreen } = require("./admin-users-screen");
    await wrap(<AdminUsersListScreen/>);
    expect(await screen.findByTestId("admin-user-u1")).toBeTruthy();
    expect(screen.getByLabelText(/^Kenji Morita, Đã khóa, Võ sĩ/)).toBeTruthy();
    expect(screen.getByLabelText(/^Thu Lê, Bác sĩ · thu\.le/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("admin-user-u2"));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/(admin)/nguoi-dung/chi-tiet", params: { id: "u2" } });
  });

  it("user page: facts, red status, row to the fighter page", async () => {
    mockParams = { id: "u2" };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdminUserDetailScreen } = require("./admin-user-detail-screen");
    await wrap(<AdminUserDetailScreen/>);
    expect(await screen.findByLabelText("Trạng thái: Đã khóa")).toBeTruthy();
    expect(screen.getByLabelText("Email: kenji@lotus-combat.test")).toBeTruthy();
    expect(screen.getByLabelText("Phòng tập: Lotus Combat Academy")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("admin-user-fighter"));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/(admin)/vo-si/chi-tiet", params: { id: "f2" } });
  });

  it("Bác sĩ phụ trách: doctors and coaches as rows; ended rows say Đã kết thúc", async () => {
    mockParams = { id: "f2" };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdminFighterDoctorsScreen } = require("./admin-fighter-doctors-screen");
    await wrap(<AdminFighterDoctorsScreen/>);
    expect(await screen.findByLabelText("Thu Lê, từ 21/09/2026")).toBeTruthy();
    expect(screen.getByLabelText("Nguyễn An, Đã kết thúc, 02/03/2026 – 20/09/2026")).toBeTruthy();
    expect(await screen.findByLabelText("Lê Hùng, từ 01/09/2026")).toBeTruthy();
    expect(await screen.findByText("Kenji Morita")).toBeTruthy();
  });

  it("Tôi: email line, sign-out asks first", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdminMeScreen } = require("./admin-me-screen");
    await wrap(<AdminMeScreen/>);
    expect(screen.getByText("admin@lotus-combat.test")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("admin-logout"));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("Đăng xuất khỏi tài khoản?")).toBeTruthy();
  });
});
