import { NAME_MAX } from "@/auth/fighter-register-body";
import type { WeightClass } from "@/constants/weight-classes";
import { vi } from "@/i18n/vi";
import { isValidDateOnly } from "@/utils/is-valid-date-only";
import { isValidEmail } from "@/utils/is-valid-email";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type RegisterStep = 1 | 2;

export type RegisterFormValues = {
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  email: string;
  password: string;
  confirm: string;
  weightClass: WeightClass | "";
};

/** Step 1 — Bạn: identity + weight class. */
export function validateRegisterStep1(
  form: Pick<RegisterFormValues, "lastName" | "firstName" | "dateOfBirth" | "weightClass">,
): Record<string, string> {
  const next: Record<string, string> = {};
  const trimmedLast = form.lastName.trim();
  const trimmedFirst = form.firstName.trim();
  const dob = form.dateOfBirth.trim();

  if (!trimmedLast) next.lastName = vi.field.required;
  else if (trimmedLast.length > NAME_MAX) next.lastName = vi.field.tooLong;
  if (!trimmedFirst) next.firstName = vi.field.required;
  else if (trimmedFirst.length > NAME_MAX) next.firstName = vi.field.tooLong;
  if (!dob) next.dateOfBirth = vi.field.required;
  else if (!isValidDateOnly(dob)) next.dateOfBirth = vi.register.dateOfBirthInvalid;
  if (!form.weightClass) next.weightClass = vi.field.required;
  return next;
}

/** Step 2 — Tài khoản. */
export function validateRegisterStep2(
  form: Pick<RegisterFormValues, "email" | "password" | "confirm">,
): Record<string, string> {
  const next: Record<string, string> = {};
  const trimmedEmail = form.email.trim();
  if (!trimmedEmail) next.email = vi.field.required;
  else if (!isValidEmail(trimmedEmail)) next.email = vi.field.invalidEmail;
  if (!form.password) next.password = vi.field.required;
  else if (form.password.length < PASSWORD_MIN) next.password = vi.register.passwordHint;
  else if (form.password.length > PASSWORD_MAX) next.password = vi.register.passwordTooLong;
  if (!form.confirm) next.confirm = vi.field.required;
  else if (form.password !== form.confirm) next.confirm = vi.register.mismatch;
  return next;
}

export function validateRegisterStep(
  step: RegisterStep,
  form: RegisterFormValues,
): Record<string, string> {
  if (step === 1) return validateRegisterStep1(form);
  return validateRegisterStep2(form);
}

export function applyRegisterFieldErrors(next: Record<string, string>): string {
  const missing = Boolean(
    next.lastName === vi.field.required ||
      next.firstName === vi.field.required ||
      next.dateOfBirth === vi.field.required ||
      next.weightClass === vi.field.required ||
      next.email === vi.field.required ||
      next.password === vi.field.required ||
      next.confirm === vi.field.required,
  );
  if (missing) return vi.register.required;
  if (next.confirm === vi.register.mismatch) return vi.register.mismatch;
  if (next.email === vi.field.invalidEmail) return vi.field.invalidEmail;
  if (next.dateOfBirth) return next.dateOfBirth;
  if (next.password) return next.password;
  const first = Object.values(next).find(Boolean);
  return first ?? vi.api.validation;
}
