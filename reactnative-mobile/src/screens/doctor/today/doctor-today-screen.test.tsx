/// <reference types="jest" />
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { campApi, type Suspension } from "@/features/fight-camp/api";
import { doctorRoApi } from "@/api/doctor/doctor-ro";
import { scheduleApi } from "@/api/doctor/schedule";
import { previewSuspension } from "@/features/fight-camp/state/camp-preview";
import { DoctorTodayScreen } from "./doctor-today-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0 }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false }) }));
jest.mock("./doctor-bell", () => ({ DoctorBell: () => null }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/screens/doctor/redesign/doctor-roster", () => ({
  useDoctorRoster: () => ({ loaded: true, error: "", reload: jest.fn(), items: [
    { id: "f1", firstName: "Kenji", lastName: "Morita", currentMedicalStatus: "MONITORING" },
    { id: "f2", firstName: "Anh", lastName: "Le", currentMedicalStatus: "NOT_CLEARED" },
  ] }),
}));
jest.mock("@/features/fight-camp/api", () => ({ campApi: { suspensions: jest.fn(), clear: jest.fn() } }));
jest.mock("@/api/doctor/doctor-ro", () => ({ doctorRoApi: { listImpairments: jest.fn() } }));
jest.mock("@/api/doctor/schedule", () => ({ scheduleApi: { doctor: jest.fn(), doctorReviews: jest.fn() } }));

const camp = campApi as jest.Mocked<typeof campApi>;
const awaiting: Suspension = { ...previewSuspension, id: "s1", fighterId: "f1", reason: "KO", endsOn: "2020-01-01", status: "AWAITING_CLEARANCE", requiresClearance: true, clearedAt: null };
beforeEach(() => {
  jest.clearAllMocks();
  camp.suspensions.mockResolvedValue({ data: [awaiting], hasNextPage: false, nextCursor: null });
  camp.clear.mockResolvedValue({ ...awaiting, clearedAt: "2026-11-11T00:00:00Z" });
  jest.mocked(scheduleApi.doctor).mockResolvedValue({ from: "", to: "", items: [] });
  jest.mocked(scheduleApi.doctorReviews).mockResolvedValue({ items: [{ id: "r1", fighterId: "f2", fighterName: "Anh Le", reason: "Đau đầu", requestedAt: "2026-11-10T03:00:00Z", requesterRole: "COACH", requesterName: "Rafael Costa" }], truncated: false });
  jest.mocked(doctorRoApi.listImpairments).mockResolvedValue([]);
});

describe("doctor Hôm nay", () => {
  it("leads with clearances waiting, flags a long wait, and shows sections with words for zero", async () => {
    const ui = await render(<DoctorTodayScreen/>);
    const row = await ui.findByTestId("pending-s1");
    expect(within(row).getByText("Kenji Morita")).toBeTruthy();
    expect(within(row).getByText(/^Chờ \d+ ngày$/)).toBeTruthy();
    expect(within(row).getByText("KO · hết 01/01")).toBeTruthy();
    expect(within(await ui.findByTestId("doctor-ai")).getByText("Không có cảnh báo mới")).toBeTruthy();
    expect(within(ui.getByTestId("doctor-watch")).getByText("Anh Le · Chưa cho phép tập")).toBeTruthy();
    await within(ui.getByTestId("doctor-review")).findByText("Anh Le · Đau đầu · Rafael Costa · 10/11");
    expect(ui.getByLabelText("Tái khám: không có").props.accessibilityState.disabled).toBe(true);
  });

  it("confirms only with a 3+ character note, using a quick pick, then says so and reloads", async () => {
    const ui = await render(<DoctorTodayScreen/>);
    await fireEvent.press(within(await ui.findByTestId("pending-s1")).getByLabelText("Xác nhận"));
    const sheet = ui.getByTestId("confirm-clearance");
    const go = within(sheet).getByLabelText("Xác nhận được tập lại");
    expect(go.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(within(sheet).getByText("Đã khám, đủ điều kiện tập lại."));
    expect(ui.getByTestId("clearance-note").props.value).toBe("Đã khám, đủ điều kiện tập lại.");
    await fireEvent.press(within(ui.getByTestId("confirm-clearance")).getByLabelText("Xác nhận được tập lại"));
    await waitFor(() => expect(camp.clear).toHaveBeenCalledWith("s1", "Đã khám, đủ điều kiện tập lại."));
    await ui.findByText("Đã xác nhận Kenji Morita được tập lại.");
    expect(camp.suspensions).toHaveBeenCalledTimes(2);
    // The confirmed row leaves at once even if the reload still returns it, and the count drops to 0.
    expect(ui.queryByTestId("pending-s1")).toBeNull();
    expect(ui.getByTestId("pending-count").props.accessibilityLabel).toBe("0");
  });

  it("keeps a failed section on its own row with one-line retry", async () => {
    jest.mocked(scheduleApi.doctorReviews).mockRejectedValueOnce(new Error("down"));
    const ui = await render(<DoctorTodayScreen/>);
    const review = await ui.findByTestId("doctor-review");
    await within(review).findByText("Không tải được");
    await fireEvent.press(within(review).getByText("Thử lại"));
    await within(await ui.findByTestId("doctor-review")).findByText(/Rafael Costa/);
    expect(await ui.findByTestId("pending-s1")).toBeTruthy();
  });
});
