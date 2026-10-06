import { vi } from "@/i18n/vi";
import { isValidEmail } from "@/utils/is-valid-email";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type RegisterStep = 1 | 2;

export type RegisterFormValues = {
  email: string;
  token: string;
};

/** Step 1 — email only. No password on a new admission. */
export function validateRegisterStep1(form: Pick<RegisterFormValues, "email">): Record<string, string> {
  const next: Record<string, string> = {};
  const trimmedEmail = form.email.trim();
  if (!trimmedEmail) next.email = vi.field.required;
  else if (!isValidEmail(trimmedEmail)) next.email = vi.field.invalidEmail;
  return next;
}

/** Step 2 — numeric email code. */
export function validateRegisterStep2(form: Pick<RegisterFormValues, "token">): Record<string, string> {
  const next: Record<string, string> = {};
  const token = form.token.trim();
  if (!token) next.token = vi.field.required;
  else if (!/^\d{6,10}$/.test(token)) next.token = vi.register.codeInvalid;
  return next;
}

export function validateRegisterStep(step: RegisterStep, form: RegisterFormValues): Record<string, string> {
  if (step === 1) return validateRegisterStep1(form);
  return validateRegisterStep2(form);
}

export function applyRegisterFieldErrors(next: Record<string, string>): string {
  if (next.email === vi.field.required || next.token === vi.field.required) return vi.register.required;
  if (next.email === vi.field.invalidEmail) return vi.field.invalidEmail;
  if (next.token) return next.token;
  const first = Object.values(next).find(Boolean);
  return first ?? vi.api.validation;
}
