import "server-only";

import { z } from "zod";

import { cache } from "react";

import { accessibleFighterIds } from "@/lib/auth/access";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, HealthStatus, Sex, Stance, TrainingLevel, User, WeightClass } from "@/lib/domain/types";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { drainNumberedPages, isNotFound, nullIfNotFound, nullIfUnreadable } from "./api-helpers";

export interface FighterFilter {
    search?: string;
    weightClass?: WeightClass;
    healthStatus?: HealthStatus;
    level?: TrainingLevel;
    coachId?: string;
}

export interface OwnProfilePatch {
    name?: string;
    phone?: string | null;
}

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

const weightClassSchema = z.enum([
    "STRAWWEIGHT",
    "FLYWEIGHT",
    "BANTAMWEIGHT",
    "FEATHERWEIGHT",
    "LIGHTWEIGHT",
    "WELTERWEIGHT",
    "MIDDLEWEIGHT",
    "LIGHT_HEAVYWEIGHT",
    "HEAVYWEIGHT",
]);
const stanceSchema = z.enum(["ORTHODOX", "SOUTHPAW", "SWITCH"]);
const medicalStatusSchema = z.enum(["HEALTHY", "MONITORING", "RECOVERY", "INJURED", "NOT_CLEARED"]);

const backendUpcomingBoutSchema = z.object({
    date: z.string(),
    event: z.string(),
    opponent: z.string(),
    weightClass: weightClassSchema,
});

/**
 * The backend fighter profile. The optional fields are ones the interface can show but the API doesn't return yet;
 * when they're missing the profile keeps them null instead of failing or guessing.
 */
export const backendFighterSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string(),
    nationality: z.string().nullable(),
    weightClass: weightClassSchema,
    heightCm: z.number().nullable(),
    reachCm: z.number().nullable(),
    dominantStance: stanceSchema.nullable(),
    currentMedicalStatus: medicalStatusSchema,
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    // Not in the API yet.
    nickname: z.string().nullable().optional(),
    sex: z.enum(["MALE", "FEMALE"]).optional(),
    weightKg: z.number().optional(),
    bodyFatPct: z.number().optional(),
    restingHeartRate: z.number().int().optional(),
    level: z.enum(["AMATEUR", "SEMI_PRO", "PROFESSIONAL", "ELITE"]).optional(),
    primaryDiscipline: z.string().optional(),
    record: z.object({ wins: z.number().int(), losses: z.number().int(), draws: z.number().int() }).optional(),
    coachIds: z.array(z.string().uuid()).optional(),
    primaryCoachId: z.string().uuid().nullable().optional(),
    doctorIds: z.array(z.string().uuid()).optional(),
    upcomingBout: backendUpcomingBoutSchema.nullable().optional(),
});

/** `GET /fighters/:id/measurements`: body measurements, the current (not superseded) ones by default. */
const measurementSchema = z.object({
    measuredAt: z.string(),
    weightKg: z.number(),
    heightCm: z.number().nullable(),
    reachCm: z.number().nullable(),
});

const backendProfileSchema = z
    .object({
        id: z.string().uuid(),
        firstName: z.string(),
        lastName: z.string(),
        specialization: z.string().nullable().optional(),
        licenseNumber: z.string().optional(),
    })
    .passthrough();

/** `GET /fighters/:id/coaches`: every coach assignment period, as a plain array. */
const coachAssignmentSchema = z.object({
    id: z.string().uuid(),
    coachId: z.string().uuid(),
    fighterId: z.string().uuid(),
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    coachName: z.string().optional(),
    coachGym: z.string().nullable().optional(),
});

/** `GET /fighters/:id/doctors`: every doctor assignment period, paginated. */
const doctorAssignmentSchema = z.object({
    id: z.string().uuid(),
    doctorId: z.string().uuid(),
    fighterId: z.string().uuid(),
    assignedById: z.string().uuid(),
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    endedById: z.string().uuid().nullable(),
    endReason: z.string().nullable(),
    createdAt: z.string(),
    doctorName: z.string().optional(),
});

type DoctorAssignment = z.output<typeof doctorAssignmentSchema>;

export const backendUserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
    profile: backendProfileSchema.nullable(),
    phone: z.string().nullable().optional(),
    status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
    displayName: z.string().optional(),
    lastActiveAt: z.string().nullable().optional(),
    title: z.string().optional(),
    effectiveCapabilities: z.array(z.string()).optional(),
    assignmentScope: z.object({ fighterIds: z.array(z.string().uuid()) }).optional(),
});

type BackendFighter = z.output<typeof backendFighterSchema>;
type BackendUser = z.output<typeof backendUserSchema>;

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

function unsupported(message: string, details?: unknown): never {
    throw new ApiError({ message, kind: "invalid_response", code: "PEOPLE_API_CONTRACT_UNSUPPORTED", details });
}

function requirePresent<T>(value: T | undefined | null, field: string): T {
    if (value === undefined || value === null) unsupported(`The people API does not provide the required ${field} field.`, { field });
    return value;
}

/** Chuyển giá trị enum viết hoa của backend sang mô hình giao diện viết thường. Missing profile fields stay null. */
export function adaptBackendFighter(input: BackendFighter): Fighter {
    const weightClass = input.weightClass.toLowerCase() as WeightClass;
    return {
        id: input.id,
        userId: input.userId,
        name: `${input.firstName} ${input.lastName}`.trim(),
        nickname: input.nickname ?? null,
        sex: input.sex ? (input.sex.toLowerCase() as Sex) : null,
        dateOfBirth: input.dateOfBirth,
        nationality: input.nationality,
        heightCm: input.heightCm,
        reachCm: input.reachCm,
        weightKg: input.weightKg ?? null,
        targetWeightKg: WEIGHT_CLASS_LIMIT_KG[weightClass],
        bodyFatPct: input.bodyFatPct ?? null,
        restingHeartRate: input.restingHeartRate ?? null,
        weightClass,
        stance: input.dominantStance ? (input.dominantStance.toLowerCase() as Stance) : null,
        level: input.level ? (input.level.toLowerCase() as TrainingLevel) : null,
        primaryDiscipline: input.primaryDiscipline ?? null,
        record: input.record ?? null,
        coachIds: input.coachIds ?? [],
        primaryCoachId: input.primaryCoachId ?? null,
        doctorIds: input.doctorIds ?? [],
        healthStatus: input.currentMedicalStatus.toLowerCase() as HealthStatus,
        joinedAt: input.createdAt,
        upcomingBout: input.upcomingBout
            ? { ...input.upcomingBout, weightClass: input.upcomingBout.weightClass.toLowerCase() as WeightClass }
            : null,
    };
}

export function adaptBackendUser(input: BackendUser): User {
    const phone = input.phone === undefined ? unsupported("The user API does not provide the required phone field.", { field: "phone" }) : input.phone;
    const status = requirePresent(input.status, "status");
    const lastActiveAt = input.lastActiveAt === undefined ? unsupported("The user API does not provide lastActiveAt.", { field: "lastActiveAt" }) : input.lastActiveAt;
    const title = requirePresent(input.title, "title");
    return {
        id: input.id,
        email: input.email,
        name: input.displayName || (input.profile ? `${input.profile.firstName} ${input.profile.lastName}`.trim() : input.email),
        role: input.role.toLowerCase() as User["role"],
        title,
        phone,
        status: status.toLowerCase() as User["status"],
        createdAt: input.createdAt,
        lastActiveAt,
        profileId: input.profile?.id ?? null,
        effectiveCapabilities: input.effectiveCapabilities as User["effectiveCapabilities"],
        assignmentScope: input.assignmentScope,
    };
}

async function listApiFighters(filter: FighterFilter): Promise<Fighter[]> {
    if (filter.level) unsupported("Filtering fighters by training level is not supported by the current API.", { field: "level" });
    if (filter.coachId) unsupported("Filtering fighters by coach is not supported by the current API.", { field: "coachId" });
    const fighters = await drainNumberedPages("/fighters", backendFighterSchema, {
        search: filter.search,
        weightClass: filter.weightClass?.toUpperCase(),
        medicalStatus: filter.healthStatus?.toUpperCase(),
    });
    return fighters.map(adaptBackendFighter).sort(byName);
}

/** The demo store after the simulated latency. Loaded lazily so API mode never evaluates it. */
async function demoDb() {
    const { db, simulateLatency } = await import("@/lib/mocks/db");
    await simulateLatency();
    return db();
}

/** Liệt kê võ sĩ theo phạm vi do backend xác thực. */
export async function listFighters(user: User, filter: FighterFilter = {}): Promise<Fighter[]> {
    if (!isDemoAuthEnabled()) return listApiFighters(filter);
    const scope = accessibleFighterIds(user);
    return (await demoDb())
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

/** Đọc một hồ sơ võ sĩ; lỗi 404 được giữ tương thích dưới dạng null. */
export async function getFighter(id: string): Promise<Fighter | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).fighters.find((fighter) => fighter.id === id) ?? null;
    const [profile, measurement, coaches, doctors] = await Promise.all([
        nullIfNotFound(authenticatedApiRequest(`/fighters/${encodeURIComponent(id)}`, backendFighterSchema)),
        latestMeasurement(id),
        coachAssignmentsFor(id),
        doctorAssignmentsFor(id),
    ]);
    if (!profile) return null;
    const fighter = adaptBackendFighter(profile);
    // One profile read is worth the extra requests: the latest weigh-in and the current care team fill fields
    // the profile itself doesn't carry.
    return {
        ...fighter,
        weightKg: fighter.weightKg ?? measurement?.weightKg ?? null,
        heightCm: fighter.heightCm ?? measurement?.heightCm ?? null,
        reachCm: fighter.reachCm ?? measurement?.reachCm ?? null,
        coachIds: fighter.coachIds.length > 0 ? fighter.coachIds : [...new Set(coaches.filter(isCurrent).map((a) => a.coachId))],
        doctorIds: fighter.doctorIds.length > 0 ? fighter.doctorIds : [...new Set(doctors.filter(isCurrent).map((a) => a.doctorId))],
    };
}

/** The most recent current body measurement, or null when there is none or the caller may not read it. */
async function latestMeasurement(fighterId: string): Promise<z.output<typeof measurementSchema> | null> {
    const measurements = await readableOrEmpty(drainNumberedPages(`/fighters/${encodeURIComponent(fighterId)}/measurements`, measurementSchema));
    return measurements.reduce<z.output<typeof measurementSchema> | null>((latest, m) => (!latest || m.measuredAt > latest.measuredAt ? m : latest), null);
}

/*
 * The API has no coach or doctor directory. In API mode staff come from the assignment periods of the fighters the
 * caller can see: that gives each person's profile id, name and current fighters, and nothing more. Fields the
 * assignments don't carry stay empty or null instead of being guessed.
 */

const scopedFighterIdsSchema = z.object({ id: z.string().uuid() }).passthrough();

/** Ids of the fighters the caller may see, read once per request. API mode only. */
export const listScopedFighterIds = cache(async (): Promise<string[]> => {
    const user = await getCurrentUser();
    if (!user) return [];
    const scope = accessibleFighterIds(user);
    if (scope !== "all") return scope;
    return (await drainNumberedPages("/fighters", scopedFighterIdsSchema)).map((fighter) => fighter.id);
});

/** An assignment list the caller may not read (403) or that no longer exists (404) counts as empty. */
async function readableOrEmpty<T>(request: Promise<T[]>): Promise<T[]> {
    return (await nullIfUnreadable(request)) ?? [];
}

const coachAssignmentsFor = cache((fighterId: string) =>
    readableOrEmpty(authenticatedApiRequest(`/fighters/${encodeURIComponent(fighterId)}/coaches`, z.array(coachAssignmentSchema))),
);

const doctorAssignmentsFor = cache((fighterId: string) =>
    readableOrEmpty(drainNumberedPages(`/fighters/${encodeURIComponent(fighterId)}/doctors`, doctorAssignmentSchema)),
);

const isCurrent = (assignment: { endsAt: string | null }) => assignment.endsAt === null;

function coachFromAssignments(coachId: string, assignments: z.output<typeof coachAssignmentSchema>[]): Coach {
    const named = assignments.find((assignment) => assignment.coachName);
    return {
        id: coachId,
        userId: null,
        name: named?.coachName ?? "Coach",
        specialty: "",
        certifications: [],
        yearsExperience: null,
        fighterIds: [...new Set(assignments.map((assignment) => assignment.fighterId))],
    };
}

function doctorFromAssignments(doctorId: string, assignments: DoctorAssignment[]): Doctor {
    const named = assignments.find((assignment) => assignment.doctorName);
    return {
        id: doctorId,
        userId: null,
        name: named?.doctorName ?? "Sports doctor",
        specialty: "",
        licenseNumber: null,
        fighterIds: [...new Set(assignments.map((assignment) => assignment.fighterId))],
    };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
    return groups;
}

/** Coaches and doctors currently assigned to the fighters the caller can see, read once per request. */
const scopedStaff = cache(async (): Promise<{ coaches: Coach[]; doctors: Doctor[] }> => {
    const ids = await listScopedFighterIds();
    const [coachLists, doctorLists] = await Promise.all([Promise.all(ids.map(coachAssignmentsFor)), Promise.all(ids.map(doctorAssignmentsFor))]);
    const coaches = [...groupBy(coachLists.flat().filter(isCurrent), (a) => a.coachId)].map(([id, list]) => coachFromAssignments(id, list));
    const doctors = [...groupBy(doctorLists.flat().filter(isCurrent), (a) => a.doctorId)].map(([id, list]) => doctorFromAssignments(id, list));
    return { coaches: coaches.sort(byName), doctors: doctors.sort(byName) };
});

/** The signed-in coach or doctor as a staff record, built from `/users/me` and their assignment scope. */
async function selfAsStaff(userId: string, role: "coach" | "doctor"): Promise<{ id: string; name: string; specialty: string; fighterIds: string[] } | null> {
    const user = await getCurrentUser();
    if (!user || user.id !== userId || user.role !== role || !user.profileId) return null;
    return { id: user.profileId, name: user.name, specialty: user.title, fighterIds: user.assignmentScope?.fighterIds ?? [] };
}

export async function listCoaches(): Promise<Coach[]> {
    if (isDemoAuthEnabled()) return [...(await demoDb()).coaches].sort(byName);
    return (await scopedStaff()).coaches;
}

export async function getCoachByUserId(userId: string): Promise<Coach | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).coaches.find((coach) => coach.userId === userId) ?? null;
    const self = await selfAsStaff(userId, "coach");
    return self && { ...self, userId, certifications: [], yearsExperience: null };
}

export async function listDoctors(): Promise<Doctor[]> {
    if (isDemoAuthEnabled()) return [...(await demoDb()).doctors].sort(byName);
    return (await scopedStaff()).doctors;
}

export async function getDoctor(id: string): Promise<Doctor | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).doctors.find((doctor) => doctor.id === id) ?? null;
    return (await listDoctors()).find((doctor) => doctor.id === id) ?? null;
}

export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).doctors.find((doctor) => doctor.userId === userId) ?? null;
    const self = await selfAsStaff(userId, "doctor");
    return self && { ...self, userId, licenseNumber: null };
}

export async function coachesForFighter(fighterId: string): Promise<Coach[]> {
    if (isDemoAuthEnabled()) {
        const store = await demoDb();
        const fighter = store.fighters.find((item) => item.id === fighterId);
        if (!fighter) return [];
        const ordered = [fighter.primaryCoachId, ...fighter.coachIds.filter((id) => id !== fighter.primaryCoachId)];
        return ordered.map((id) => store.coaches.find((coach) => coach.id === id)).filter((coach): coach is Coach => coach !== undefined);
    }
    const current = (await coachAssignmentsFor(fighterId)).filter(isCurrent);
    return [...groupBy(current, (a) => a.coachId)].map(([id, list]) => coachFromAssignments(id, list)).sort(byName);
}

export async function doctorsForFighter(fighterId: string): Promise<Doctor[]> {
    if (isDemoAuthEnabled()) {
        const store = await demoDb();
        const fighter = store.fighters.find((item) => item.id === fighterId);
        if (!fighter) return [];
        return fighter.doctorIds.map((id) => store.doctors.find((doctor) => doctor.id === id)).filter((doctor): doctor is Doctor => doctor !== undefined);
    }
    const current = (await doctorAssignmentsFor(fighterId)).filter(isCurrent);
    return [...groupBy(current, (a) => a.doctorId)].map(([id, list]) => doctorFromAssignments(id, list)).sort(byName);
}

export async function getUser(id: string): Promise<User | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).users.find((user) => user.id === id) ?? null;
    const user = await nullIfNotFound(authenticatedApiRequest(`/users/${encodeURIComponent(id)}`, backendUserSchema));
    return user && adaptBackendUser(user);
}

export async function updateOwnProfile(userId: string, patch: OwnProfilePatch, actor: User): Promise<UpdateOwnProfileResult> {
    if (!isDemoAuthEnabled()) {
        const body: { displayName?: string; phone?: string | null } = {};
        if (patch.name !== undefined) body.displayName = patch.name.trim();
        if (patch.phone !== undefined) body.phone = patch.phone?.trim() || null;
        try {
            const updated = await authenticatedMutableApiRequest("/users/me", backendUserSchema, {
                method: "PATCH",
                body: JSON.stringify(body),
            });
            return { ok: true, user: adaptBackendUser(updated) };
        } catch (error) {
            if (isNotFound(error)) return { ok: false, code: "not_found", message: "That account no longer exists." };
            throw error;
        }
    }
    const { db } = await import("@/lib/mocks/db");
    const user = db().users.find((item) => item.id === userId);
    if (!user) return { ok: false, code: "not_found", message: "That account no longer exists." };
    const changed: string[] = [];
    const name = patch.name?.trim();
    if (name && name !== user.name) {
        user.name = name;
        await syncProfileName(user);
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
        const { recordAudit } = await import("./audit.demo");
        recordAudit({ actor, action: "user.update_profile", resourceType: "user", resourceId: user.id, resourceLabel: `${user.name} — Profile`, details: `Updated: ${changed.join(", ")}` });
    }
    return { ok: true, user };
}

export async function updateFighterProfile(fighterId: string, patch: FighterProfilePatch, actor: User): Promise<UpdateFighterProfileResult> {
    if (!isDemoAuthEnabled()) {
        const supported = new Set(["heightCm", "reachCm", "weightClass", "stance"]);
        const unsupportedFields = Object.keys(patch).filter((field) => !supported.has(field));
        if (unsupportedFields.length > 0) unsupported("The fighter API cannot persist every requested profile field.", { fields: unsupportedFields });
        const body: Record<string, unknown> = {};
        if (patch.heightCm !== undefined) body.heightCm = patch.heightCm;
        if (patch.reachCm !== undefined) body.reachCm = patch.reachCm;
        if (patch.weightClass !== undefined) body.weightClass = patch.weightClass.toUpperCase();
        if (patch.stance !== undefined) body.dominantStance = patch.stance?.toUpperCase() ?? null;
        if (Object.keys(body).length === 0) unsupported("No API-supported fighter profile field was provided.");
        try {
            // Kiểm tra trước để không ghi một phần dữ liệu rồi mới phát hiện hợp đồng đọc chưa đầy đủ.
            const current = await getFighter(fighterId);
            if (!current) return { ok: false, code: "not_found", message: "That fighter no longer exists." };
            const updated = await authenticatedMutableApiRequest(`/fighters/${encodeURIComponent(fighterId)}`, backendFighterSchema, { method: "PATCH", body: JSON.stringify(body) });
            return { ok: true, fighter: adaptBackendFighter(updated) };
        } catch (error) {
            if (isNotFound(error)) return { ok: false, code: "not_found", message: "That fighter no longer exists." };
            throw error;
        }
    }

    const { db } = await import("@/lib/mocks/db");
    const fighter = db().fighters.find((item) => item.id === fighterId);
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
    const [{ recordAudit }, { notifyUsers }] = await Promise.all([import("./audit.demo"), import("./notifications.demo")]);
    recordAudit({ actor, action: "fighter.update_profile", resourceType: "fighter", resourceId: fighter.id, resourceLabel: `${fighter.name} — Fighter profile`, details: `Updated: ${fields}` });
    if (actor.id !== fighter.userId) {
        notifyUsers({ userIds: [fighter.userId], category: "system", title: "Your fighter profile was updated", body: `${actor.name} updated your ${fields}.`, href: routes.profile });
    }
    return { ok: true, fighter };
}

/** Đồng bộ tên chỉ tồn tại trong kho demo; chế độ API để backend sở hữu giao dịch này. */
export async function syncProfileName(user: User): Promise<void> {
    if (!isDemoAuthEnabled()) unsupported("Profile-name synchronization must be performed by the backend API.");
    if (!user.profileId) return;
    const { db } = await import("@/lib/mocks/db");
    const store = db();
    const profile =
        user.role === "fighter"
            ? store.fighters.find((item) => item.id === user.profileId)
            : user.role === "coach"
              ? store.coaches.find((item) => item.id === user.profileId)
              : user.role === "doctor"
                ? store.doctors.find((item) => item.id === user.profileId)
                : undefined;
    if (profile) profile.name = user.name;
}

function byName(a: { name: string }, b: { name: string }): number {
    return a.name.localeCompare(b.name, "en");
}
