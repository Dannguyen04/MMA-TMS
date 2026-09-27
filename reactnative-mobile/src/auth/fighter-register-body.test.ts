import { toFighterRegisterBody } from "@/auth/fighter-register-body";

const required = {
  email: "Fighter@Example.com",
  password: "strong-password",
  firstName: "An",
  lastName: "Nguyen",
  dateOfBirth: "2000-01-01",
  weightClass: "LIGHTWEIGHT" as const,
};

describe("toFighterRegisterBody", () => {
  it("matches the Nest happy-path fighter register body", () => {
    expect(toFighterRegisterBody(required)).toEqual({
      email: "fighter@example.com",
      password: "strong-password",
      profile: {
        firstName: "An",
        lastName: "Nguyen",
        dateOfBirth: "2000-01-01",
        weightClass: "LIGHTWEIGHT",
      },
    });
  });

  it("lowercases email", () => {
    expect(toFighterRegisterBody(required).email).toBe("fighter@example.com");
  });

  it("does not send confirmPassword or optional profile keys", () => {
    const body = toFighterRegisterBody(required) as Record<string, unknown>;
    expect(body).not.toHaveProperty("confirmPassword");
    expect(JSON.stringify(body)).not.toContain("confirmPassword");
    expect(body.profile).toEqual({
      firstName: "An",
      lastName: "Nguyen",
      dateOfBirth: "2000-01-01",
      weightClass: "LIGHTWEIGHT",
    });
  });
});
