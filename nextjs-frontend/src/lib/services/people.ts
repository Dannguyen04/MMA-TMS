import "server-only";

import { cache } from "react";

import { accessibleFighterIds } from "@/lib/auth/access";
import { WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, HealthStatus, TrainingLevel, User, WeightClass } from "@/lib/domain/types";
import { db, simulateLatency } from "@/lib/mocks/db";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { recordAudit } from "./audit";
import { notifyUsers } from "./notifications";

/**
 * People directory: fighters, coaches, sports doctors and user accounts.
 * Record-level scoping for fighter lists comes from `accessibleFighterIds`; single-record
 * reads don't authorize — pages call `requireFighterAccess()` before rendering.
 */

export interface FighterFilter {
    /** Matches name, nickname, discipline and nationality. */
    search?: string;
    weightClass?: WeightClass;
    healthStatus?: HealthStatus;
    level?: TrainingLevel;
    coachId?: string;
}

export interface OwnProfilePatch {
    name?: string;
    /** Empty string clears the phone number. */
    phone?: string | null;
}

/** Fields a coach, doctor or the fighter may change. The target weight follows the weight class. */
export type FighterProfilePatch = Partial<
    Pick<
        Fighter,
        | "nickname"
        | "weightKg"
        | "heightCm"
        | "reachCm"
        | "bodyFatPct"
        | "restingHeartRate"
        | "weightClass"
        | "stance"
        | "level"
        | "primaryDiscipline"
        | "upcomingBout"
    >
>;

type NotFoundFailure = { ok: false; code: "not_found"; message: string };

export type UpdateOwnProfileResult = { ok: true; user: User } | NotFoundFailure;

export type UpdateFighterProfileResult = { ok: true; fighter: Fighter } | NotFoundFailure;

const FIGHTER_FIELD_LABELS: Record<keyof FighterProfilePatch, string> = {
    nickname: "nickname",
    weightKg: "weight",
    heightCm: "height",
    reachCm: "reach",
    bodyFatPct: "body fat",
    restingHeartRate: "resting heart rate",
    weightClass: "weight class",
    stance: "stance",
    level: "training level",
    primaryDiscipline: "primary discipline",
    upcomingBout: "upcoming bout",
};

/* ─── Fighters ────────────────────────────────────────────────────────────── */

/** Fighters the user may see, filtered and sorted by name. */
export async function listFighters(user: User, filter: FighterFilter = {}): Promise<Fighter[]> {
    await simulateLatency();
    const scope = accessibleFighterIds(user);
    return db()
        .fighters.filter((fighter) => {
            if (scope !== "all" && !scope.includes(fighter.id)) return false;
            if (filter.weightClass && fighter.weightClass !== filter.weightClass) return false;
            if (filter.healthStatus && fighter.healthStatus !== filter.healthStatus) return false;
            if (filter.level && fighter.level !== filter.level) return false;
            if (filter.coachId && !fighter.coachIds.includes(filter.coachId)) return false;
            return matchesSearch(filter.search, fighter.name, fighter.nickname, fighter.primaryDiscipline, fighter.nationality);
        })
        .sort(byName);
}

/** A fighter by profile id, or null. Callers must check record access. */
export async function getFighter(id: string): Promise<Fighter | null> {
    await simulateLatency();
    return db().fighters.find((f) => f.id === id) ?? null;
}

/* ─── Coaches & doctors ───────────────────────────────────────────────────── */

/** All coaches, sorted by name. Reference data (names for lookups), read once per request. */
export const listCoaches = cache(async (): Promise<Coach[]> => {
    await simulateLatency();
    return [...db().coaches].sort(byName);
});

/** The coach profile linked to a user account, or null. */
export async function getCoachByUserId(userId: string): Promise<Coach | null> {
    await simulateLatency();
    return db().coaches.find((c) => c.userId === userId) ?? null;
}

/** All sports doctors, sorted by name. Reference data (names for lookups), read once per request. */
export const listDoctors = cache(async (): Promise<Doctor[]> => {
    await simulateLatency();
    return [...db().doctors].sort(byName);
});

/** A doctor by profile id, or null. */
export async function getDoctor(id: string): Promise<Doctor | null> {
    await simulateLatency();
    return db().doctors.find((d) => d.id === id) ?? null;
}

/** The doctor profile linked to a user account, or null. */
export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
    await simulateLatency();
    return db().doctors.find((d) => d.userId === userId) ?? null;
}

/** Coaches assigned to a fighter, primary coach first. Empty when the fighter doesn't exist. */
export async function coachesForFighter(fighterId: string): Promise<Coach[]> {
    await simulateLatency();
    const store = db();
    const fighter = store.fighters.find((f) => f.id === fighterId);
    if (!fighter) return [];
    const ordered = [fighter.primaryCoachId, ...fighter.coachIds.filter((id) => id !== fighter.primaryCoachId)];
    return ordered.map((id) => store.coaches.find((c) => c.id === id)).filter((c): c is Coach => c !== undefined);
}

/** Sports doctors responsible for a fighter, in assignment order. */
export async function doctorsForFighter(fighterId: string): Promise<Doctor[]> {
    await simulateLatency();
    const store = db();
    const fighter = store.fighters.find((f) => f.id === fighterId);
    if (!fighter) return [];
    return fighter.doctorIds.map((id) => store.doctors.find((d) => d.id === id)).filter((d): d is Doctor => d !== undefined);
}

/* ─── Users ───────────────────────────────────────────────────────────────── */

/** A user account by id, or null. */
export async function getUser(id: string): Promise<User | null> {
    await simulateLatency();
    return db().users.find((u) => u.id === id) ?? null;
}

/**
 * Updates the signed-in user's own name and phone. A name change is mirrored on the linked
 * fighter, coach or doctor profile so lists and cards stay consistent.
 */
export async function updateOwnProfile(userId: string, patch: OwnProfilePatch, actor: User): Promise<UpdateOwnProfileResult> {
    const store = db();
    const user = store.users.find((u) => u.id === userId);
    if (!user) return { ok: false, code: "not_found", message: "That account no longer exists." };

    const changed: string[] = [];
    const name = patch.name?.trim();
    if (name && name !== user.name) {
        user.name = name;
        syncProfileName(user);
        changed.push("name");
    }
    if (patch.phone !== undefined) {
        const phone = patch.phone?.trim() || null;
        if (phone !== user.phone) {
            user.phone = phone;
            changed.push("phone");
        }
    }

    if (changed.length > 0) {
        recordAudit({
            actor,
            action: "user.update_profile",
            resourceType: "user",
            resourceId: user.id,
            resourceLabel: `${user.name} — Profile`,
            details: `Updated: ${changed.join(", ")}`,
        });
    }
    return { ok: true, user };
}

/**
 * Updates a fighter's physical and competition profile. Changing the weight class also moves
 * the target weight to that class's limit. The fighter is notified when someone else edits it.
 */
export async function updateFighterProfile(
    fighterId: string,
    patch: FighterProfilePatch,
    actor: User,
): Promise<UpdateFighterProfileResult> {
    const fighter = db().fighters.find((f) => f.id === fighterId);
    if (!fighter) return { ok: false, code: "not_found", message: "That fighter no longer exists." };

    const changed: (keyof FighterProfilePatch)[] = [];
    const apply = <K extends keyof FighterProfilePatch>(key: K, value: Fighter[K] | undefined) => {
        if (value === undefined || JSON.stringify(value) === JSON.stringify(fighter[key])) return;
        fighter[key] = value;
        changed.push(key);
    };

    apply("nickname", patch.nickname === undefined ? undefined : patch.nickname?.trim() || null);
    apply("weightKg", patch.weightKg);
    apply("heightCm", patch.heightCm);
    apply("reachCm", patch.reachCm);
    apply("bodyFatPct", patch.bodyFatPct);
    apply("restingHeartRate", patch.restingHeartRate);
    apply("weightClass", patch.weightClass);
    apply("stance", patch.stance);
    apply("level", patch.level);
    apply("primaryDiscipline", patch.primaryDiscipline?.trim() || undefined);
    apply("upcomingBout", patch.upcomingBout);
    if (changed.includes("weightClass")) fighter.targetWeightKg = WEIGHT_CLASS_LIMIT_KG[fighter.weightClass];

    if (changed.length === 0) return { ok: true, fighter };

    const fields = changed.map((key) => FIGHTER_FIELD_LABELS[key]).join(", ");
    recordAudit({
        actor,
        action: "fighter.update_profile",
        resourceType: "fighter",
        resourceId: fighter.id,
        resourceLabel: `${fighter.name} — Fighter profile`,
        details: `Updated: ${fields}`,
    });
    if (actor.id !== fighter.userId) {
        notifyUsers({
            userIds: [fighter.userId],
            category: "system",
            title: "Your fighter profile was updated",
            body: `${actor.name} updated your ${fields}.`,
            href: routes.profile,
        });
    }
    return { ok: true, fighter };
}

/**
 * Copies the account name onto the linked fighter, coach or doctor profile. Used by account
 * mutations here and in the admin service; it records no audit entry of its own.
 */
export function syncProfileName(user: User): void {
    if (!user.profileId) return;
    const store = db();
    const profile =
        user.role === "fighter"
            ? store.fighters.find((f) => f.id === user.profileId)
            : user.role === "coach"
              ? store.coaches.find((c) => c.id === user.profileId)
              : user.role === "doctor"
                ? store.doctors.find((d) => d.id === user.profileId)
                : undefined;
    if (profile) profile.name = user.name;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function byName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name, "en");
}
