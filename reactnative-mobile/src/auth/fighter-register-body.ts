import type { WeightClass } from "@/constants/weight-classes";

export const NAME_MAX = 100;

/** Nest `registerBodySchema` fighter payload (required fields only; no `confirmPassword`). */
export type FighterRegisterBody = {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    weightClass: WeightClass;
  };
};

export function toFighterRegisterBody(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
}): FighterRegisterBody {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    profile: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth,
      weightClass: input.weightClass,
    },
  };
}
