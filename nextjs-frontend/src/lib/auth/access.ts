import "server-only";

import { notFound } from "next/navigation";

import type { Fighter, User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";

/**
 * Record-level access. Fighters see only themselves; coaches and doctors see their
 * assigned fighters; admins can see fighter accounts (never clinical detail — that is
 * enforced by permissions, not here).
 */
export function accessibleFighterIds(user: User): string[] | "all" {
    const store = db();
    switch (user.role) {
        case "fighter":
            return user.profileId ? [user.profileId] : [];
        case "coach":
            return store.coaches.find((c) => c.id === user.profileId)?.fighterIds ?? [];
        case "doctor":
            return store.doctors.find((d) => d.id === user.profileId)?.fighterIds ?? [];
        case "admin":
            return "all";
    }
}

export function canAccessFighter(user: User, fighterId: string): boolean {
    const ids = accessibleFighterIds(user);
    return ids === "all" || ids.includes(fighterId);
}

/** Clinical access: only a sports doctor assigned to the fighter. Never "all", whatever the role's permissions. */
export function canAccessFighterClinically(user: User, fighterId: string): boolean {
    if (user.role !== "doctor" || !user.profileId) return false;
    return db().doctors.find((d) => d.id === user.profileId)?.fighterIds.includes(fighterId) ?? false;
}

/** Loads a fighter the user may access, or renders not-found. */
export function requireFighterAccess(user: User, fighterId: string): Fighter {
    const fighter = db().fighters.find((f) => f.id === fighterId);
    if (!fighter || !canAccessFighter(user, fighterId)) notFound();
    return fighter;
}
