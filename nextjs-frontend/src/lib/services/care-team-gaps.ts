import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { CARE_ROLES, type CareRole } from "@/lib/domain/care-team";
import type { Fighter, User } from "@/lib/domain/types";
import { drainNumberedPages, nullIfNotFound, nullIfServiceFails } from "./api-helpers";
import { listAssignableStaff } from "./care-team";
import { listFighters } from "./people";

/*
 * Fighters still waiting for part of their care team: a new fighter (activated from an application or created by an
 * administrator) can't train until a sports doctor runs the baseline examination, and nobody plans their training
 * until a coach is assigned. The services have no "unassigned" filter, so API mode reads each active coach's and
 * doctor's current roster (one list per staff member, instead of two per fighter) and compares it with the fighters.
 */

export interface CareTeamGap {
    fighterId: string;
    /** The fighter's account, which the administrator's care team page belongs to. */
    userId: string;
    name: string;
    /** When the fighter profile was created (ISO). */
    joinedAt: string;
    /** Roles with no current assignment, coach before doctor. */
    missing: CareRole[];
}

type GapFighter = Pick<Fighter, "id" | "userId" | "name" | "joinedAt">;

/** Fighters missing a role, given the fighters each role currently covers; the longest-waiting come first. */
export function findCareTeamGaps(fighters: GapFighter[], covered: Record<CareRole, ReadonlySet<string>>): CareTeamGap[] {
    return fighters
        .flatMap((fighter) => {
            const missing = CARE_ROLES.filter((role) => !covered[role].has(fighter.id));
            return missing.length === 0 ? [] : [{ fighterId: fighter.id, userId: fighter.userId, name: fighter.name, joinedAt: fighter.joinedAt, missing }];
        })
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.name.localeCompare(b.name));
}

const ROSTER_PATH: Record<CareRole, (staffId: string) => string> = {
    coach: (staffId) => `/coaches/${encodeURIComponent(staffId)}/fighters`,
    doctor: (staffId) => `/doctors/${encodeURIComponent(staffId)}/fighters`,
};

const rosterFighterSchema = z.object({ id: z.string() }).passthrough();

/** Fighter ids on one coach's or doctor's current roster. A profile deactivated since the staff list was read has none (404). */
async function rosterIds(role: CareRole, staffId: string): Promise<string[]> {
    const roster = await nullIfNotFound(drainNumberedPages(ROSTER_PATH[role](staffId), rosterFighterSchema));
    return (roster ?? []).map((fighter) => fighter.id);
}

async function readApiGaps(user: User): Promise<CareTeamGap[]> {
    const [fighters, staff] = await Promise.all([listFighters(user), listAssignableStaff()]);
    if (fighters.length === 0) return [];
    const coveredBy = async (role: CareRole) => new Set((await Promise.all(staff[role].map((member) => rosterIds(role, member.staffId)))).flat());
    const [coach, doctor] = await Promise.all([coveredBy("coach"), coveredBy("doctor")]);
    return findCareTeamGaps(fighters, { coach, doctor });
}

/**
 * Fighters with no current coach and/or sports doctor, longest-waiting first. Null when the assignments couldn't be
 * read, so a page says it couldn't check instead of listing every fighter as unassigned.
 */
export async function listCareTeamGaps(user: User): Promise<CareTeamGap[] | null> {
    if (isDemoAuthEnabled()) {
        // The demo keeps each fighter's care team on the fighter itself.
        const fighters = await listFighters(user);
        const covering = (role: CareRole) => new Set(fighters.filter((fighter) => (role === "coach" ? fighter.coachIds : fighter.doctorIds).length > 0).map((fighter) => fighter.id));
        return findCareTeamGaps(fighters, { coach: covering("coach"), doctor: covering("doctor") });
    }
    return nullIfServiceFails(readApiGaps(user));
}
