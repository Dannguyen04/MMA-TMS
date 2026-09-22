import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { drainAuthenticatedCursorPages } from "@/lib/api/client";
import type { AuditLog, AuditResourceType, Role, User } from "@/lib/domain/types";

const actorRoleSchema = z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN", "SYSTEM"]);
const resourceTypeSchema = z.enum([
    "AUTH",
    "USER",
    "ROLE",
    "FIGHTER",
    "TRAINING_PLAN",
    "TRAINING_SESSION",
    "GOAL",
    "VIDEO",
    "AI_JOB",
    "AI_MODEL",
    "AI_FINDING",
    "AI_ALERT",
    "MEDICAL_RECORD",
    "EXAMINATION",
    "INJURY",
    "TREATMENT",
    "RECOVERY_PLAN",
    "CLEARANCE",
    "NOTIFICATION",
    "SETTINGS",
]);
export const backendAuditLogSchema = z.object({
    id: z.string(),
    actorId: z.string().nullable(),
    actorName: z.string(),
    actorRole: actorRoleSchema,
    action: z.string(),
    resourceType: resourceTypeSchema,
    resourceId: z.string(),
    resourceLabel: z.string(),
    timestamp: z.string(),
    ipAddress: z.string(),
    status: z.enum(["SUCCESS", "FAILURE"]),
    details: z.string().nullable(),
});

type BackendAuditLog = z.infer<typeof backendAuditLogSchema>;

const roleFromApi: Record<z.infer<typeof actorRoleSchema>, Role | "system"> = {
    FIGHTER: "fighter",
    COACH: "coach",
    DOCTOR: "doctor",
    ADMIN: "admin",
    SYSTEM: "system",
};
const roleToApi: Record<Role | "system", keyof typeof roleFromApi> = {
    fighter: "FIGHTER",
    coach: "COACH",
    doctor: "DOCTOR",
    admin: "ADMIN",
    system: "SYSTEM",
};
const resourceTypeToApi: Record<AuditResourceType, z.infer<typeof resourceTypeSchema>> = {
    auth: "AUTH",
    user: "USER",
    role: "ROLE",
    fighter: "FIGHTER",
    training_plan: "TRAINING_PLAN",
    training_session: "TRAINING_SESSION",
    goal: "GOAL",
    video: "VIDEO",
    ai_job: "AI_JOB",
    ai_model: "AI_MODEL",
    ai_finding: "AI_FINDING",
    ai_alert: "AI_ALERT",
    medical_record: "MEDICAL_RECORD",
    examination: "EXAMINATION",
    injury: "INJURY",
    treatment: "TREATMENT",
    recovery_plan: "RECOVERY_PLAN",
    clearance: "CLEARANCE",
    notification: "NOTIFICATION",
    settings: "SETTINGS",
};
const resourceTypeFromApi = Object.fromEntries(
    Object.entries(resourceTypeToApi).map(([uiValue, apiValue]) => [apiValue, uiValue]),
) as Record<z.infer<typeof resourceTypeSchema>, AuditResourceType>;

export function adaptBackendAuditLog(log: BackendAuditLog): AuditLog {
    return {
        ...log,
        actorRole: roleFromApi[log.actorRole],
        resourceType: resourceTypeFromApi[log.resourceType],
        status: log.status === "SUCCESS" ? "success" : "failure",
    };
}

async function demoService(): Promise<typeof import("./audit.demo")> {
    return import("./audit.demo");
}

export interface AuditLogQuery {
    search?: string;
    actorId?: string;
    actorRole?: AuditLog["actorRole"];
    resourceType?: AuditResourceType;
    status?: AuditLog["status"];
    from?: string;
    to?: string;
}

export async function listAuditLogs(query: AuditLogQuery = {}, viewer?: User | null): Promise<AuditLog[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listAuditLogs(query, viewer);
    const params = new URLSearchParams();
    if (query.search) params.set("search", query.search);
    if (query.actorId) params.set("actorId", query.actorId);
    if (query.actorRole) params.set("actorRole", roleToApi[query.actorRole]);
    if (query.resourceType) params.set("resourceType", resourceTypeToApi[query.resourceType]);
    if (query.status) params.set("status", query.status.toUpperCase());
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    const value = params.toString();
    return (await drainAuthenticatedCursorPages(`/audit-logs${value ? `?${value}` : ""}`, backendAuditLogSchema)).map(
        adaptBackendAuditLog,
    );
}
