import { assignDoctorHref, fighterIdFromActivatedUser } from "./assign-doctor-link";

describe("assignDoctorHref", () => {
  it("includes fighterId and does not link without one", () => {
    expect(assignDoctorHref("fighter-1")).toBe(
      "/quan-tri/phan-cong-bac-si?fighterId=fighter-1",
    );
    expect(assignDoctorHref("")).toBeNull();
    expect(assignDoctorHref(null)).toBeNull();
  });

  it("reads the fighter profile id only after the account is a fighter", () => {
    expect(
      fighterIdFromActivatedUser({ role: "FIGHTER", profile: { id: "fighter-9" } }),
    ).toBe("fighter-9");
    expect(fighterIdFromActivatedUser({ role: "GUEST", profile: { id: "guest" } })).toBeNull();
  });
});
