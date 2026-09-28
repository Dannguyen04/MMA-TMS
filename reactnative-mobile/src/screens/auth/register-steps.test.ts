import {
  validateRegisterStep1,
  validateRegisterStep2,
} from "@/auth/register-steps";
import { vi } from "@/i18n/vi";
import type { RegisterFormValues } from "@/auth/register-steps";

const base: RegisterFormValues = {
  lastName: "Nguyen",
  firstName: "An",
  dateOfBirth: "2000-01-01",
  email: "fighter@example.com",
  password: "strong-password",
  confirm: "strong-password",
  weightClass: "LIGHTWEIGHT",
};

describe("register step validators", () => {
  it("step 1 fails without a date of birth or weight class", () => {
    expect(validateRegisterStep1({ ...base, dateOfBirth: "" }).dateOfBirth).toBe(
      vi.field.required,
    );
    expect(validateRegisterStep1({ ...base, weightClass: "" }).weightClass).toBe(
      vi.field.required,
    );
    expect(validateRegisterStep1(base)).toEqual({});
  });

  it("step 2 fails on password mismatch", () => {
    const next = validateRegisterStep2({ ...base, confirm: "other-password" });
    expect(next.confirm).toBe(vi.register.mismatch);
  });
});
