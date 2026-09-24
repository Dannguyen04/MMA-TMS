import "server-only";

import { z } from "zod";

import { accessibleFighterIds } from "@/lib/auth/access";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter, HealthStatus, TrainingLevel, User, WeightClass } from "@/lib/domain/types";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { drainNumberedPages, isNotFound, nullIfNotFound } from "./api-helpers";

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

/** Hợp đồng gồm trường hiện có và các trường hồ sơ mà giao diện bắt buộc phải nhận. */
export const backendFighterSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    nickname: z.string().nullable(),
    sex: z.enum(["MALE", "FEMALE"]),
    dateOfBirth: z.string(),
    nationality: z.string().nullable(),
    weightClass: weightClassSchema,
    heightCm: z.number().nullable(),
    reachCm: z.number().nullable(),
    weightKg: z.number(),
    bodyFatPct: z.number(),
    restingHeartRate: z.number().int(),
    dominantStance: stanceSchema.nullable(),
    level: z.enum(["AMATEUR", "SEMI_PRO", "PROFESSIONAL", "ELITE"]),
    primaryDiscipline: z.string(),
    record: z.object({ wins: z.number().int(), losses: z.number().int(), draws: z.number().int() }),
    coachIds: z.array(z.string().uuid()),
    primaryCoachId: z.string().uuid().nullable(),
    doctorIds: z.array(z.string().uuid()),
    upcomingBout: backendUpcomingBoutSchema.nullable(),
    currentMedicalStatus: medicalStatusSchema,
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
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

const doctorAssignmentSchema = z.object({
    id: z.string().uuid(),
    doctorId: z.string().uuid(),
    doctorUserId: z.string().uuid(),
    fighterId: z.string().uuid(),
    assignedById: z.string().uuid(),
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    endedById: z.string().uuid().nullable(),
    endReason: z.string().nullable(),
    createdAt: z.string(),
    doctorName: z.string(),
    doctorSpecialization: z.string().nullable(),
    doctorLicenseNumber: z.string(),
});

const backendCoachSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    specialization: z.string().nullable(),
    certifications: z.array(z.string()),
    yearsExperience: z.number().int().nonnegative(),
    fighterIds: z.array(z.string().uuid()),
});

const backendDoctorSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    specialization: z.string().nullable(),
    licenseNumber: z.string(),
    fighterIds: z.array(z.string().uuid()),
});

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

/** Chuyển giá trị enum viết hoa của backend sang mô hình giao diện viết thường. */
export function adaptBackendFighter(input: BackendFighter): Fighter {
    const nationality = requirePresent(input.nationality, "nationality");
    const heightCm = requirePresent(input.heightCm, "heightCm");
    const reachCm = requirePresent(input.reachCm, "reachCm");
    const stance = requirePresent(input.dominantStance, "dominantStance");
    const primaryCoachId = requirePresent(input.primaryCoachId, "primaryCoachId");

    return {
        id: input.id,
        userId: input.userId,
        name: `${input.firstName} ${input.lastName}`.trim(),
        nickname: input.nickname,
        sex: input.sex.toLowerCase() as Fighter["sex"],
        dateOfBirth: input.dateOfBirth,
        nationality,
        heightCm,
        reachCm,
        weightKg: input.weightKg,
        targetWeightKg: WEIGHT_CLASS_LIMIT_KG[input.weightClass.toLowerCase() as WeightClass],
        bodyFatPct: input.bodyFatPct,
        restingHeartRate: input.restingHeartRate,
        weightClass: input.weightClass.toLowerCase() as WeightClass,
        stance: stance.toLowerCase() as Fighter["stance"],
        level: input.level.toLowerCase() as TrainingLevel,
        primaryDiscipline: input.primaryDiscipline,
        record: input.record,
        coachIds: input.coachIds,
        primaryCoachId,
        doctorIds: input.doctorIds,
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
    const fighter = await nullIfNotFound(authenticatedApiRequest(`/fighters/${encodeURIComponent(id)}`, backendFighterSchema));
    return fighter && adaptBackendFighter(fighter);
}

function adaptCoach(input: z.output<typeof backendCoachSchema>): Coach {
    return {
        id: input.id,
        userId: input.userId,
        name: `${input.firstName} ${input.lastName}`.trim(),
        specialty: input.specialization ?? "",
        certifications: input.certifications,
        yearsExperience: input.yearsExperience,
        fighterIds: input.fighterIds,
    };
}

function adaptDoctor(input: z.output<typeof backendDoctorSchema>): Doctor {
    return {
        id: input.id,
        userId: input.userId,
        name: `${input.firstName} ${input.lastName}`.trim(),
        specialty: input.specialization ?? "",
        licenseNumber: input.licenseNumber,
        fighterIds: input.fighterIds,
    };
}

export async function listCoaches(): Promise<Coach[]> {
    if (isDemoAuthEnabled()) return [...(await demoDb()).coaches].sort(byName);
    return (await drainNumberedPages("/coaches", backendCoachSchema)).map(adaptCoach).sort(byName);
}

export async function getCoachByUserId(userId: string): Promise<Coach | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).coaches.find((coach) => coach.userId === userId) ?? null;
    return (await listCoaches()).find((coach) => coach.userId === userId) ?? null;
}

export async function listDoctors(): Promise<Doctor[]> {
    if (isDemoAuthEnabled()) return [...(await demoDb()).doctors].sort(byName);
    return (await drainNumberedPages("/doctors", backendDoctorSchema)).map(adaptDoctor).sort(byName);
}

export async function getDoctor(id: string): Promise<Doctor | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).doctors.find((doctor) => doctor.id === id) ?? null;
    const doctor = await nullIfNotFound(authenticatedApiRequest(`/doctors/${encodeURIComponent(id)}`, backendDoctorSchema));
    return doctor && adaptDoctor(doctor);
}

export async function getDoctorByUserId(userId: string): Promise<Doctor | null> {
    if (isDemoAuthEnabled()) return (await demoDb()).doctors.find((doctor) => doctor.userId === userId) ?? null;
    return (await listDoctors()).find((doctor) => doctor.userId === userId) ?? null;
}

export async function coachesForFighter(fighterId: string): Promise<Coach[]> {
    if (isDemoAuthEnabled()) {
        const store = await demoDb();
        const fighter = store.fighters.find((item) => item.id === fighterId);
        if (!fighter) return [];
        const ordered = [fighter.primaryCoachId, ...fighter.coachIds.filter((id) => id !== fighter.primaryCoachId)];
        return ordered.map((id) => store.coaches.find((coach) => coach.id === id)).filter((coach): coach is Coach => coach !== undefined);
    }
    return (await listCoaches()).filter((coach) => coach.fighterIds.includes(fighterId));
}

export async function doctorsForFighter(fighterId: string): Promise<Doctor[]> {
    if (isDemoAuthEnabled()) {
        const store = await demoDb();
        const fighter = store.fighters.find((item) => item.id === fighterId);
        if (!fighter) return [];
        return fighter.doctorIds.map((id) => store.doctors.find((doctor) => doctor.id === id)).filter((doctor): doctor is Doctor => doctor !== undefined);
    }
    const assignments = await authenticatedApiRequest(
        `/fighters/${encodeURIComponent(fighterId)}/doctors`,
        z.array(doctorAssignmentSchema),
    );
    return assignments
        .filter((assignment) => assignment.endsAt === null)
        .map((assignment) => ({
            id: assignment.doctorId,
            userId: assignment.doctorUserId,
            name: assignment.doctorName,
            specialty: assignment.doctorSpecialization ?? "",
            licenseNumber: assignment.doctorLicenseNumber,
            fighterIds: [assignment.fighterId],
        }))
        .sort(byName);
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
        if (patch.stance !== undefined) body.dominantStance = patch.stance.toUpperCase();
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
