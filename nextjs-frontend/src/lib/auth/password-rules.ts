/** The auth service's password length rule (`credentialPasswordSchema`), shared by every form that sets a password. */
export const PASSWORD_LENGTH = { min: 8, max: 128 } as const;
