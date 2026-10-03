import type { Role, Stance, WeightClass } from "./types";

/**
 * Accounts as the user service creates and edits them: each role's profile, and the request bodies built from
 * input a form has already validated. Pure, so the body's shape is tested here. Safe for Server and Client Components.
 */

export interface FighterProfileFields {
    firstName: string;
    lastName: string;
    /** YYYY-MM-DD. */
    dateOfBirth: string;
    weightClass: WeightClass;
    dominantStance: Stance | null;
    nationality: string | null;
}

export interface CoachProfileFields {
    firstName: string;
    lastName: string;
    specialization: string | null;
    isHeadCoach: boolean;
}

export interface DoctorProfileFields {
    firstName: string;
    lastName: string;
    licenseNumber: string;
    specialization: string | null;
}

/** An account's role with the profile that role carries. Administrators have none. */
export type AccountProfile =
    | { role: "fighter"; profile: FighterProfileFields }
    | { role: "coach"; profile: CoachProfileFields }
    | { role: "doctor"; profile: DoctorProfileFields }
    | { role: "admin"; profile: null };

/** Limits the user service enforces, mirrored on the forms. */
export const ACCOUNT_LIMITS = { name: 100, nationality: 100, specialization: 200, licenseNumber: 100, passwordMin: 8, passwordMax: 128 } as const;

type ApiRole = "FIGHTER" | "COACH" | "DOCTOR" | "ADMIN";

const apiRole = (role: Role): ApiRole => role.toUpperCase() as ApiRole;

/** The profile as the service takes it: enums upper case, names trimmed, empty optional text as null. */
function profileBody(account: AccountProfile): Record<string, unknown> | null {
    if (account.role === "admin") return null;
    const { profile } = account;
    const names = { firstName: profile.firstName.trim(), lastName: profile.lastName.trim() };
    const text = (value: string | null) => value?.trim() || null;
    switch (account.role) {
        case "fighter":
            return {
                ...names,
                dateOfBirth: account.profile.dateOfBirth,
                weightClass: account.profile.weightClass.toUpperCase(),
                dominantStance: account.profile.dominantStance?.toUpperCase() ?? null,
                nationality: text(account.profile.nationality),
            };
        case "coach":
            return { ...names, specialization: text(account.profile.specialization), isHeadCoach: account.profile.isHeadCoach };
        case "doctor":
            return { ...names, licenseNumber: account.profile.licenseNumber.trim(), specialization: text(account.profile.specialization) };
    }
}

/** `POST /users`: a new account with its first password and, except for administrators, its profile. */
export function createAccountBody(input: { email: string; password: string; account: AccountProfile }) {
    const profile = profileBody(input.account);
    return { user: { email: input.email.trim().toLowerCase(), password: input.password, role: apiRole(input.account.role), ...(profile ? { profile } : {}) } };
}

/** `PATCH /users/:id`: the whole profile of an account whose role stays the same. Administrators have nothing to edit. */
export function updateAccountBody(account: Exclude<AccountProfile, { role: "admin" }>) {
    return { user: { role: apiRole(account.role), profile: profileBody(account) } };
}
