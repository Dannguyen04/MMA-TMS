import { toFighterRegisterBody } from "@/auth/fighter-register-body";

const required = {
  email: "Fighter@Example.com",
  password: "strong-password",
};

describe("toFighterRegisterBody", () => {
  it("matches the Nest strict register body", () => {
    expect(toFighterRegisterBody(required)).toEqual({
      email: "fighter@example.com",
      password: "strong-password",
    });
  });

  it("lowercases email", () => {
    expect(toFighterRegisterBody(required).email).toBe("fighter@example.com");
  });

  it("does not send confirmPassword or profile keys", () => {
    const body = toFighterRegisterBody(required) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["email", "password"]);
    expect(JSON.stringify(body)).not.toContain("confirmPassword");
    expect(body).not.toHaveProperty("profile");
  });
});
