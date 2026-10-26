import { validateRegisterStep1, validateRegisterStep2 } from "@/auth/register-steps";
import { vi } from "@/i18n/vi";

describe("register step validators", () => {
  it("step 1 accepts only an email", () => {
    expect(validateRegisterStep1({ email: "" }).email).toBe(vi.field.required);
    expect(validateRegisterStep1({ email: "not-an-email" }).email).toBe(vi.field.invalidEmail);
    expect(validateRegisterStep1({ email: "fighter@example.com" })).toEqual({});
  });

  it("step 2 requires the numeric email code", () => {
    expect(validateRegisterStep2({ token: "" }).token).toBe(vi.field.required);
    expect(validateRegisterStep2({ token: "12ab" }).token).toBe(vi.register.codeInvalid);
    expect(validateRegisterStep2({ token: "123456" })).toEqual({});
  });
});
