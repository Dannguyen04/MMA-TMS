/**
 * A fighter's care team: the coaches and sports doctors currently assigned to them. Shared by the admin page, its
 * actions and both service implementations. Safe for Server and Client Components.
 */

export type CareRole = "coach" | "doctor";

export const CARE_ROLES = ["coach", "doctor"] as const satisfies readonly CareRole[];

export const CARE_ROLE_LABELS: Record<CareRole, string> = { coach: "coach", doctor: "sports doctor" };

export interface CareTeamMember {
    /** The assignment period's id, which ending it refers to. */
    assignmentId: string;
    /** The coach's or doctor's profile id. */
    staffId: string;
    name: string;
    /** When the assignment started; null where the demo doesn't record it. */
    since: string | null;
    /** The coach who leads the fighter's planning. Only the demo records one. */
    primary: boolean;
}

export type CareTeam = Record<CareRole, CareTeamMember[]>;

/** A coach or doctor account with a profile. Only active ones can be assigned. */
export interface StaffOption {
    /** Their coach or doctor profile id, which an assignment refers to. */
    staffId: string;
    userId: string;
    name: string;
    title: string;
    active: boolean;
}

/** Limit on the reason for ending an assignment, as both services enforce it. */
export const END_REASON_MAX = 500;

export const ALREADY_ASSIGNED: Record<CareRole, string> = {
    coach: "This coach is already assigned to the fighter.",
    doctor: "This sports doctor is already assigned to the fighter.",
};

export const STAFF_UNAVAILABLE: Record<CareRole, string> = {
    coach: "That coach's account is no longer active. Reload the page and choose another.",
    doctor: "That sports doctor's account is no longer active. Reload the page and choose another.",
};

export const ASSIGNMENT_ALREADY_ENDED = "This assignment has already ended. Reload the page.";
