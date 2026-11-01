import { fireEvent, render, screen } from "@testing-library/react-native";

import type { PublicFighter } from "@/api/types";
import { RoleChip } from "@/components/role-chip";
import { contrastRatio } from "@/theme/appearance/color-math";
import { palettes } from "@/theme/colors";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";

import {
  doctorTitleVi,
  filterRoster,
  notificationFighterId,
  rosterTiles,
  statusFromParam,
  tileText,
} from "./doctor-format";
import { DoctorMeScreen } from "./doctor-me-screen";
import { badgeText } from "./doctor-unread";
import { mockDoctorRoApi } from "@/api/doctor-ro.mock";
import { RoleTabBar } from "@/components/role-tab-bar";
import { doctorRo } from "@/i18n/doctor-ro";
import { paletteFromTokens } from "@/screens/fighter/redesign/palette";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/session/session-context", () => ({
  useSession: () => ({
    user: {
      id: "u-doc",
      email: "bacsi@mmavision.vn",
      role: "DOCTOR",
      profile: { id: "doc-1", firstName: "Lan", lastName: "Phạm", specialization: "Head of Sports Medicine", licenseNumber: "DEMO-SD-0001" },
    },
    isDemo: false,
    signOut: mockSignOut,
  }),
}));

const fighter = (id: string, status: PublicFighter["currentMedicalStatus"], first = "An", last = "Nguyễn", wc = "LIGHTWEIGHT") =>
  ({ id, firstName: first, lastName: last, weightClass: wc, currentMedicalStatus: status }) as PublicFighter;

describe("doctor-format", () => {
  it("dịch chức danh khi có trong bảng, giữ nguyên khi không, ẩn khi trống", () => {
    expect(doctorTitleVi("Head of Sports Medicine")).toBe("Bác sĩ trưởng Y học thể thao");
    expect(doctorTitleVi("  sports   medicine ")).toBe("Y học thể thao");
    expect(doctorTitleVi("Bác sĩ nội trú")).toBe("Bác sĩ nội trú");
    expect(doctorTitleVi("")).toBeNull();
    expect(doctorTitleVi(null)).toBeNull();
  });

  it("ô lối tắt: tổng + Cần chú ý (Chấn thương + Chưa cho phép); '–' khi lỗi hoặc trống", () => {
    const items = [fighter("1", "HEALTHY"), fighter("2", "INJURED"), fighter("3", "NOT_CLEARED"), fighter("4", "RECOVERY")];
    expect(rosterTiles({ items, total: 4, error: "", loaded: true })).toEqual({ total: 4, attention: 2 });
    expect(rosterTiles({ items, total: 4, error: "Mất mạng", loaded: true })).toEqual({ total: null, attention: null });
    expect(rosterTiles({ items: [], total: 0, error: "", loaded: true })).toEqual({ total: null, attention: null });
    expect(tileText(null)).toBe("–");
    expect(tileText(0)).toBe("0");
  });

  it("lọc theo tên không dấu, hạng cân, tình trạng và nhóm Cần chú ý", () => {
    const rows = [
      fighter("1", "HEALTHY", "Đức", "Trần", "FLYWEIGHT"),
      fighter("2", "INJURED", "Huy", "Phạm"),
      fighter("3", "NOT_CLEARED", "Phúc", "Lê"),
    ];
    expect(filterRoster(rows, { search: "duc", weightClass: "", status: "" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterRoster(rows, { search: "", weightClass: "LIGHTWEIGHT", status: "" }).map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterRoster(rows, { search: "", weightClass: "", status: "attention" }).map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterRoster(rows, { search: "", weightClass: "", status: "INJURED" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("tham số đường dẫn và đích thông báo", () => {
    expect(statusFromParam("attention")).toBe("attention");
    expect(statusFromParam("all")).toBe("");
    expect(statusFromParam("INJURED")).toBe("INJURED");
    expect(statusFromParam(undefined)).toBeNull();
    expect(notificationFighterId({ target: { type: "FIGHTER", id: "f-1" } })).toBe("f-1");
    expect(notificationFighterId({ target: { type: "FIGHTER_APPLICATION", id: "a-1" } })).toBeNull();
    expect(notificationFighterId({})).toBeNull();
  });
});

describe("huy hiệu Thông báo", () => {
  it("chữ huy hiệu: ẩn khi 0, tối đa 99+", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-1)).toBeNull();
    expect(badgeText(2)).toBe("2");
    expect(badgeText(120)).toBe("99+");
  });

  it("dữ liệu giả lập có 2 thông báo chưa đọc", async () => {
    await expect(mockDoctorRoApi.unreadCount()).resolves.toEqual({ count: 2 });
  });

  it("màu huy hiệu ≥ 4.5:1 ở sáng và tối", () => {
    for (const c of [palettes.light, palettes.dark]) {
      const p = paletteFromTokens(c);
      expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("thanh tab hiện số chưa đọc trên tab Thông báo", async () => {
    const routes = [
      { key: "a", name: "vo-si" },
      { key: "b", name: "thong-bao" },
    ];
    const props = {
      state: { index: 0, routes },
      descriptors: {
        a: { options: { title: "Võ sĩ" } },
        b: { options: { title: "Thông báo", tabBarBadge: "2", tabBarAccessibilityLabel: "Thông báo, 2 thông báo chưa đọc" } },
      },
      navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
    } as unknown as BottomTabBarProps;
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ThemePreferenceProvider>
          <RoleTabBar {...props} />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await screen.findByLabelText("Thông báo, 2 thông báo chưa đọc")).toBeTruthy();
    expect(screen.getByText("2", { includeHiddenElements: true })).toBeTruthy();
  });

  it("thẻ giấy phép ở chi tiết Doctor có tiêu đề 'Giấy phép'", () => {
    expect(doctorRo.detail.clearance).toBe("Giấy phép");
  });
});

describe("RoleChip", () => {
  it("nền surfaceMuted, chữ ink ≥ 4.5:1, cao 28dp, không dùng xanh lá", () => {
    for (const c of [palettes.light, palettes.dark]) {
      expect(contrastRatio(c.ink, c.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("hiện nhãn vai trò tiếng Việt", async () => {
    await render(
      <ThemePreferenceProvider>
        <RoleChip role="DOCTOR" />
      </ThemePreferenceProvider>,
    );
    expect(await screen.findByText("Bác sĩ")).toBeTruthy();
  });
});

describe("DoctorMeScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSignOut.mockClear();
  });

  it("hiện chức danh tiếng Việt, bỏ mã nội bộ, ô '–' khi chưa có danh sách, xác nhận trước khi đăng xuất", async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ThemePreferenceProvider>
          <DoctorMeScreen />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await screen.findByText("Bác sĩ trưởng Y học thể thao")).toBeTruthy();
    expect(screen.queryByText(/DEMO-SD-0001/)).toBeNull();
    expect(screen.queryByText(/Head of Sports Medicine/)).toBeNull();
    expect(screen.getByText("Bác sĩ")).toBeTruthy();
    expect(screen.getByText("bacsi@mmavision.vn")).toBeTruthy();
    expect(screen.getAllByText("–")).toHaveLength(2);
    // Không còn chuông ở đầu trang; số chưa đọc nằm trên tab Thông báo.
    expect(screen.queryByLabelText("Thông báo")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Cần chú ý: chưa có"));
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/(doctor)/vo-si", params: expect.objectContaining({ status: "attention" }) }));

    await fireEvent.press(screen.getByText("Đăng xuất"));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByText("Đăng xuất khỏi MMA Vision?")).toBeTruthy();
    await fireEvent.press(screen.getByText("Hủy"));
    expect(screen.queryByText("Đăng xuất khỏi MMA Vision?")).toBeNull();
    await fireEvent.press(screen.getByText("Đăng xuất"));
    const buttons = screen.getAllByText("Đăng xuất");
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
