import { defaultTab } from "./admin-application-detail";
import { countActionable } from "./admin-home";
import { notificationHref } from "./admin-inbox";
import { buildCreate, buildUpdate, isActiveUser, validateDraft } from "./admin-users";
import { formatBytes, formatDuration } from "./admin-videos";

const draft = {
  firstName: "An",
  lastName: "Trần",
  dateOfBirth: "2000-01-31",
  weightClass: "LIGHTWEIGHT" as const,
  nationality: "",
  gym: "",
  specialization: "",
  licenseNumber: "",
  isHeadCoach: false,
};

describe("manager logic", () => {
  it("đếm hồ sơ cần xử lý phía client", () => {
    expect(countActionable([{ status: "SUBMITTED" }, { status: "PASSED" }, { status: "FAILED" }, { status: "APPROVED" }])).toBe(3);
  });

  it("chọn tab mặc định theo trạng thái", () => {
    expect(defaultTab("SUBMITTED")).toBe("overview");
    expect(defaultTab("PASSED")).toBe("decision");
    expect(defaultTab("ACTIVATED")).toBe("coach");
  });

  it("mở đích thông báo theo payload.target", () => {
    expect(notificationHref({ payload: { target: { type: "FIGHTER_APPLICATION", id: "a1" } } })).toBe("/quan-tri/nhap-hoc/a1");
    expect(notificationHref({ payload: { target: { type: "FIGHTER", id: "f1" } } })).toBe("/quan-tri/phan-cong-bac-si?fighterId=f1");
    expect(notificationHref({ payload: { target: { type: "TRAINING_PLAN", id: "p" } } })).toBeNull();
    expect(notificationHref({ payload: {} })).toBeNull();
  });

  it("chỉ gửi trường đã đổi khi sửa hồ sơ", () => {
    expect(buildUpdate("COACH", draft, draft)).toBeNull();
    expect(buildUpdate("COACH", draft, { ...draft, specialization: " Boxing ", isHeadCoach: true })).toEqual({
      role: "COACH",
      profile: { specialization: "Boxing", isHeadCoach: true },
    });
    expect(buildUpdate("FIGHTER", draft, { ...draft, gym: "" , nationality: "VN" })).toEqual({
      role: "FIGHTER",
      profile: { nationality: "VN" },
    });
  });

  it("kiểm tra trường bắt buộc theo vai trò", () => {
    expect(validateDraft("ADMIN", { ...draft, firstName: "" })).toBeNull();
    expect(validateDraft("FIGHTER", { ...draft, dateOfBirth: "31/01/2000" })).not.toBeNull();
    expect(validateDraft("DOCTOR", draft)).not.toBeNull();
    expect(validateDraft("DOCTOR", { ...draft, licenseNumber: "BS-1" })).toBeNull();
  });

  it("tạo body POST /users đúng discriminated union", () => {
    expect(buildCreate("ADMIN", " a@b.vn ", "12345678", draft)).toEqual({ email: "a@b.vn", password: "12345678", role: "ADMIN" });
    expect(buildCreate("FIGHTER", "f@b.vn", "12345678", draft)).toEqual({
      email: "f@b.vn",
      password: "12345678",
      role: "FIGHTER",
      profile: { firstName: "An", lastName: "Trần", dateOfBirth: "2000-01-31", weightClass: "LIGHTWEIGHT" },
    });
  });

  it("định dạng video và trạng thái người dùng", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(isActiveUser({ isActive: true, deletedAt: null })).toBe(true);
    expect(isActiveUser({ isActive: true, deletedAt: "2026-01-01T00:00:00Z" })).toBe(false);
  });
});
