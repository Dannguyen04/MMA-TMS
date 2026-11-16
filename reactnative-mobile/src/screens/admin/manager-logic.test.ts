import { countActionable } from "./admin-actionable";
import { notificationHref } from "./admin-inbox";

describe("manager logic", () => {
  it("đếm hồ sơ cần xử lý phía client", () => {
    expect(countActionable([{ status: "SUBMITTED" }, { status: "PASSED" }, { status: "FAILED" }, { status: "APPROVED" }])).toBe(3);
  });

  it("mở đích thông báo theo payload.target", () => {
    expect(notificationHref({ payload: { target: { type: "FIGHTER_APPLICATION", id: "a1" } } })).toBe("/quan-tri/nhap-hoc/a1");
    expect(notificationHref({ payload: { target: { type: "FIGHTER", id: "f1" } } })).toBe("/quan-tri/phan-cong-bac-si?fighterId=f1");
    expect(notificationHref({ payload: { target: { type: "TRAINING_PLAN", id: "p" } } })).toBeNull();
    expect(notificationHref({ payload: {} })).toBeNull();
  });
});
