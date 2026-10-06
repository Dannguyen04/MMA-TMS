import "server-only";

import { ALREADY_ASSIGNED, ASSIGNMENT_ALREADY_ENDED, CARE_ROLE_LABELS, STAFF_UNAVAILABLE, type CareRole, type CareTeam } from "@/lib/domain/care-team";
import type { Coach, Doctor, Fighter, User } from "@/lib/domain/types";
import type { WriteResult } from "@/lib/domain/write-result";
import { db, simulateLatency } from "@/lib/mocks/db";
import { recordAudit } from "./audit.demo";

/*
 * The demo keeps a fighter's care team as id lists on the fighter and on each coach and doctor, without assignment
 * periods: an assignment's id names the pair, and ending one removes it from both sides.
 */

const assignmentId = (role: CareRole, fighterId: string, staffId: string) => `${role}~${fighterId}~${staffId}`;

const FIGHTER_GONE: WriteResult = { ok: false, message: "This fighter's profile no longer exists. Reload the page." };

function staffFor(role: CareRole, staffId: string): Coach | Doctor | undefined {
    const store = db();
    return role === "coach" ? store.coaches.find((coach) => coach.id === staffId) : store.doctors.find((doctor) => doctor.id === staffId);
}

function teamIds(fighter: Fighter, role: CareRole): string[] {
    return role === "coach" ? fighter.coachIds : fighter.doctorIds;
}

function setTeamIds(fighter: Fighter, role: CareRole, ids: string[]) {
    if (role === "doctor") {
        fighter.doctorIds = ids;
        return;
    }
    fighter.coachIds = ids;
    // A fighter with coaches always has a primary one.
    if (!fighter.primaryCoachId || !ids.includes(fighter.primaryCoachId)) fighter.primaryCoachId = ids[0] ?? null;
}

export async function getCareTeam(fighterId: string): Promise<CareTeam> {
    await simulateLatency();
    const fighter = db().fighters.find((item) => item.id === fighterId);
    const members = (role: CareRole) =>
        (fighter ? teamIds(fighter, role) : []).flatMap((staffId) => {
            const staff = staffFor(role, staffId);
            return staff ? [{ assignmentId: assignmentId(role, fighterId, staffId), staffId, name: staff.name, since: null, primary: role === "coach" && fighter?.primaryCoachId === staffId }] : [];
        });
    return { coach: members("coach"), doctor: members("doctor") };
}

export async function assignStaff(fighterId: string, role: CareRole, staffId: string, actor: User): Promise<WriteResult> {
    await simulateLatency();
    const fighter = db().fighters.find((item) => item.id === fighterId);
    if (!fighter) return FIGHTER_GONE;
    const staff = staffFor(role, staffId);
    if (!staff) return { ok: false, message: STAFF_UNAVAILABLE[role], fieldErrors: { staffId: STAFF_UNAVAILABLE[role] } };
    if (teamIds(fighter, role).includes(staffId)) return { ok: false, message: ALREADY_ASSIGNED[role], fieldErrors: { staffId: ALREADY_ASSIGNED[role] } };

    setTeamIds(fighter, role, [...teamIds(fighter, role), staffId]);
    staff.fighterIds = [...staff.fighterIds, fighter.id];
    recordAudit({ actor, action: `fighter.${role}_assign`, resourceType: "fighter", resourceId: fighter.id, resourceLabel: fighter.name, details: `${staff.name} assigned as ${CARE_ROLE_LABELS[role]}` });
    return { ok: true };
}

export async function endAssignment(fighterId: string, role: CareRole, id: string, reason: string, actor: User): Promise<WriteResult> {
    await simulateLatency();
    const fighter = db().fighters.find((item) => item.id === fighterId);
    if (!fighter) return FIGHTER_GONE;
    const staffId = teamIds(fighter, role).find((candidate) => assignmentId(role, fighterId, candidate) === id);
    const staff = staffId ? staffFor(role, staffId) : undefined;
    if (!staffId || !staff) return { ok: false, message: ASSIGNMENT_ALREADY_ENDED };

    setTeamIds(fighter, role, teamIds(fighter, role).filter((candidate) => candidate !== staffId));
    staff.fighterIds = staff.fighterIds.filter((candidate) => candidate !== fighter.id);
    recordAudit({ actor, action: `fighter.${role}_end`, resourceType: "fighter", resourceId: fighter.id, resourceLabel: fighter.name, details: `${staff.name} no longer assigned: ${reason.trim()}` });
    return { ok: true };
}
