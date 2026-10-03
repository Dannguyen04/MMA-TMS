import "server-only";

import { z } from "zod";

import { authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { ALREADY_ASSIGNED, ASSIGNMENT_ALREADY_ENDED, STAFF_UNAVAILABLE, type CareRole, type CareTeam, type StaffOption } from "@/lib/domain/care-team";
import type { User } from "@/lib/domain/types";
import type { WriteResult } from "@/lib/domain/write-result";
import { listUsers } from "./admin";
import { settleWrite, type ServiceErrorMessages } from "./api-write-errors";
import { currentAssignments } from "./people";

/*
 * Who looks after a fighter. Coaches are assigned through the fighter service (`/fighters/:id/coaches`) and doctors
 * through the medical service (`/fighters/:id/doctors`); both keep every assignment as a period that ends with a
 * reason instead of being deleted.
 */

async function demoService(): Promise<typeof import("./care-team.demo")> {
    return import("./care-team.demo");
}

const ASSIGNMENTS_PATH: Record<CareRole, string> = { coach: "coaches", doctor: "doctors" };

const CARE_TEAM_ERRORS: Record<CareRole, ServiceErrorMessages> = {
    coach: {
        service: "fighter service",
        forbidden: "Your account can no longer assign coaches. Ask another administrator to check your role.",
        notFound: "This fighter or assignment no longer exists. Reload the page.",
        codes: {
            FIGHTER_NOT_FOUND: "This fighter's profile no longer exists. Reload the page.",
            FIGHTER_INACTIVE: "This fighter's profile is no longer active, so their coaches can't change.",
            COACH_NOT_FOUND: STAFF_UNAVAILABLE.coach,
            COACH_ASSIGNMENT_ALREADY_ACTIVE: ALREADY_ASSIGNED.coach,
            COACH_ASSIGNMENT_NOT_FOUND: ASSIGNMENT_ALREADY_ENDED,
            COACH_ASSIGNMENT_ALREADY_CLOSED: ASSIGNMENT_ALREADY_ENDED,
        },
    },
    doctor: {
        service: "medical service",
        forbidden: "Only administrators can change a fighter's sports doctors.",
        notFound: "This fighter or assignment no longer exists. Reload the page.",
        codes: {
            FIGHTER_NOT_FOUND: "This fighter's profile no longer exists. Reload the page.",
            DOCTOR_NOT_FOUND: STAFF_UNAVAILABLE.doctor,
            DOCTOR_ASSIGNMENT_ALREADY_ACTIVE: ALREADY_ASSIGNED.doctor,
            DOCTOR_ASSIGNMENT_NOT_FOUND: ASSIGNMENT_ALREADY_ENDED,
            DOCTOR_ASSIGNMENT_ALREADY_CLOSED: ASSIGNMENT_ALREADY_ENDED,
            DOCTOR_ASSIGNMENT_PERIOD_CONFLICT: "This doctor's assignment changed at the same time. Reload the page and try again.",
        },
    },
};

/** Service field names → the care team forms' field names. */
const CARE_TEAM_FIELDS = {
    fields: { coachId: "staffId", doctorId: "staffId", endReason: "reason" },
    conflictFields: {
        COACH_NOT_FOUND: "staffId",
        COACH_ASSIGNMENT_ALREADY_ACTIVE: "staffId",
        DOCTOR_NOT_FOUND: "staffId",
        DOCTOR_ASSIGNMENT_ALREADY_ACTIVE: "staffId",
    },
};

/** The new or ended assignment: only its id is read, since the page reads the care team again afterwards. */
const assignmentReplySchema = z.object({ id: z.string() });

function careTeamWrite(role: CareRole, path: string, body: Record<string, string>): Promise<WriteResult> {
    return settleWrite(authenticatedMutableApiRequest(path, assignmentReplySchema, { method: "POST", body: JSON.stringify(body) }), CARE_TEAM_ERRORS[role], CARE_TEAM_FIELDS);
}

/** Coach or doctor accounts with a profile, whatever their status, so earlier staff can still be named. */
export async function listStaffAccounts(role: CareRole): Promise<StaffOption[]> {
    const options = (users: User[]) =>
        users.flatMap((user) => (user.profileId ? [{ staffId: user.profileId, userId: user.id, name: user.name, title: user.title, active: user.status === "active" }] : []));
    return options(await listUsers({ role }));
}

/** Active coach and doctor accounts, to choose from when assigning. */
export async function listAssignableStaff(): Promise<Record<CareRole, StaffOption[]>> {
    const [coaches, doctors] = await Promise.all([listStaffAccounts("coach"), listStaffAccounts("doctor")]);
    const active = (options: StaffOption[]) => options.filter((option) => option.active);
    return { coach: active(coaches), doctor: active(doctors) };
}

/** The fighter's current coaches and sports doctors. */
export async function getCareTeam(fighterId: string): Promise<CareTeam> {
    if (isDemoAuthEnabled()) return (await demoService()).getCareTeam(fighterId);
    const { coaches, doctors } = await currentAssignments(fighterId);
    return {
        coach: coaches.map((a) => ({ assignmentId: a.id, staffId: a.coachId, name: a.coachName ?? "Coach", since: a.startsAt, primary: false })),
        doctor: doctors.map((a) => ({ assignmentId: a.id, staffId: a.doctorId, name: a.doctorName ?? "Sports doctor", since: a.startsAt, primary: false })),
    };
}

/** Starts an assignment from now. */
export async function assignStaff(fighterId: string, role: CareRole, staffId: string, actor: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).assignStaff(fighterId, role, staffId, actor);
    return careTeamWrite(role, `/fighters/${encodeURIComponent(fighterId)}/${ASSIGNMENTS_PATH[role]}`, role === "coach" ? { coachId: staffId } : { doctorId: staffId });
}

/** Ends an assignment now, keeping it in the fighter's history with the reason. */
export async function endAssignment(fighterId: string, role: CareRole, assignmentId: string, reason: string, actor: User): Promise<WriteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).endAssignment(fighterId, role, assignmentId, reason, actor);
    return careTeamWrite(role, `/fighters/${encodeURIComponent(fighterId)}/${ASSIGNMENTS_PATH[role]}/${encodeURIComponent(assignmentId)}/end`, { endReason: reason.trim() });
}
