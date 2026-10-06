/** Nest `registerBodySchema` payload (strict: `email` + `password` only; no `confirmPassword`). */
export type FighterRegisterBody = {
  email: string;
  password: string;
};

export function toFighterRegisterBody(input: {
  email: string;
  password: string;
}): FighterRegisterBody {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
}
