import type { PublicUser } from "@/api/types";
import { coachRo } from "@/i18n/coach-ro";
import { coach as coachLegacy } from "@/i18n/coach";
import { THEME_PALETTES, SYNTHETIC_LIGHT } from "@/theme/appearance/theme-palettes";
import { paletteFromTokens } from "@/screens/fighter/redesign/palette";
import { ADMIN_FIGHTER_DOCTORS_ENABLED } from "./admin-flags";
import { countText } from "./admin-overview-screen";
import { doctorRows, fighterIdOf, roleLabel, statusChip, toPaginated, userDisplayName } from "./admin-format";

const user = (over: Partial<PublicUser> = {}): PublicUser => ({
  id: "u", email: "an.ho@example.com", role: "GUEST", isActive: true, createdAt: "", updatedAt: "", deletedAt: null, profile: null, ...over,
});

describe("người dùng Admin", () => {
  it("tên hiển thị: hồ sơ, nếu không có thì phần trước @ của email", () => {
    expect(userDisplayName(user({ profile: { id: "p", firstName: "Lê", lastName: "Hùng" } }))).toBe("Lê Hùng");
    expect(userDisplayName(user())).toBe("an.ho");
    expect(userDisplayName(user({ email: "@x" }))).toBe("Chưa có tên");
  });

  it("nhãn vai trò tiếng Việt, không lộ mã thô", () => {
    expect(roleLabel("COACH")).toBe("Huấn luyện viên");
    expect(roleLabel("ADMIN")).toBe("Quản trị viên");
    expect(roleLabel("FIGHTER")).toBe("Võ sĩ");
    expect(roleLabel("DOCTOR")).toBe("Bác sĩ");
    expect(roleLabel("GUEST")).toBe("Khách");
    expect(roleLabel("???")).not.toMatch(/\?/);
  });

  it("chip trạng thái luôn có icon + chữ", () => {
    expect(statusChip({ isActive: true })).toMatchObject({ label: "Đang hoạt động", icon: "success" });
    expect(statusChip({ isActive: false })).toMatchObject({ label: "Ngừng hoạt động", icon: "ban" });
  });

  it("gộp trang /users → hasNextPage theo page*limit < total", () => {
    expect(toPaginated({ items: [user()], total: 41, page: 2, limit: 20 }).hasNextPage).toBe(true);
    expect(toPaginated({ items: [user()], total: 40, page: 2, limit: 20 }).hasNextPage).toBe(false);
    expect(toPaginated({ items: [], total: 0, page: 1, limit: 20 })).toEqual({ data: [], total: 0, hasNextPage: false });
  });

  it("id hồ sơ võ sĩ chỉ có với tài khoản FIGHTER có hồ sơ võ sĩ", () => {
    const profile = { id: "cf-1", firstName: "A", lastName: "B", dateOfBirth: "2000-01-01", weightClass: "FLYWEIGHT" as const };
    expect(fighterIdOf(user({ role: "FIGHTER", profile }))).toBe("cf-1");
    expect(fighterIdOf(user({ role: "COACH", profile }))).toBeNull();
    expect(fighterIdOf(user({ role: "FIGHTER" }))).toBeNull();
  });
});

describe("bác sĩ phụ trách", () => {
  const rows = [
    { id: "old", doctorId: "d1", doctorName: "BS. A", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" },
    { id: "cur", doctorId: "d2", startsAt: "2026-03-01T00:00:00Z", endsAt: null },
    { id: "cur2", doctorId: "d3", doctorName: " ", startsAt: "2026-05-01T00:00:00Z", endsAt: null },
  ];
  it("đang phụ trách trước, mới nhất trước; tên lấy từ API, rồi bản đồ tên, rồi chữ chung", () => {
    const out = doctorRows(rows, { d2: "BS. Lan" });
    expect(out.map((r) => r.id)).toEqual(["cur2", "cur", "old"]);
    expect(out.map((r) => r.name)).toEqual(["Bác sĩ", "BS. Lan", "BS. A"]);
    expect(out.map((r) => r.current)).toEqual([true, true, false]);
    expect(doctorRows([])).toEqual([]);
  });
});

describe("ô số tổng quan", () => {
  it("định dạng hàng nghìn kiểu Việt Nam, không âm", () => {
    expect(countText(0)).toBe("0");
    expect(countText(1234)).toBe("1.234");
    expect(countText(1234567)).toBe("1.234.567");
    expect(countText(-3)).toBe("0");
  });
});

describe("batch28", () => {
  it("ô tìm võ sĩ đúng chữ \"Tìm theo tên\" (Coach C-1, Admin võ sĩ dùng chung, màn Coach cũ)", () => {
    expect(coachRo.fighters.search).toBe("Tìm theo tên");
    expect(coachLegacy.search).toBe("Tìm theo tên");
  });
  it("cờ A-4 bật mặc định", () => {
    expect(ADMIN_FIGHTER_DOCTORS_ENABLED).toBe(true);
  });
  it("nút Đăng xuất viền ngoài dùng màu viền focus, không dùng màu lỗi/cảnh báo", () => {
    for (const t of [THEME_PALETTES.synthetic, SYNTHETIC_LIGHT]) {
      const p = paletteFromTokens(t);
      expect(p.ring).not.toBe(p.danger);
      expect(p.ring).not.toBe(p.attention);
    }
  });
});
