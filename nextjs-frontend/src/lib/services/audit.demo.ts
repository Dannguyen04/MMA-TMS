import "server-only";

/** Trien khai nhat ky demo, chi duoc nap boi cac dich vu demo. */

import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import type { AuditLog, AuditResourceType, User } from "@/lib/domain/types";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import type { AuditLogQuery } from "./audit";

export interface AuditEntryInput {
    actor: User | null;
    action: string;
    resourceType: AuditResourceType;
    resourceId: string;
    resourceLabel: string;
    status?: AuditLog["status"];
    details?: string | null;
}

/** Appends an audit entry. Every mutating service call should record one. */
export function recordAudit(input: AuditEntryInput): AuditLog {
    const entry: AuditLog = {
        id: newId("log"),
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? "System",
        actorRole: input.actor?.role ?? "system",
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        resourceLabel: input.resourceLabel,
        timestamp: nowIso(),
        ipAddress: "10.20.4.18",
        status: input.status ?? "success",
        details: input.details ?? null,
    };
    db().auditLogs.unshift(entry);
    return entry;
}

/* ─── Reading ─────────────────────────────────────────────────────────────── */

const CLINICAL_RESOURCE_TYPES: ReadonlySet<AuditResourceType> = new Set<AuditResourceType>([
    "ai_alert",
    "medical_record",
    "examination",
    "injury",
    "treatment",
    "recovery_plan",
    "clearance",
]);

const RESTRICTED_LABEL = "Clinical record (restricted)";
const RESTRICTED_DETAILS = "Visible to the medical team only.";

function isClinicalEntry(log: AuditLog): boolean {
    return CLINICAL_RESOURCE_TYPES.has(log.resourceType) || log.action.startsWith("fighter.health_status");
}

/**
 * The audit entry as `viewer` may see it. Clinical entries keep who, when, where and the outcome,
 * but anyone without `medical:read` (administrators included) sees a neutral placeholder instead of
 * the action, record, label and details, so the audit trail can't be used to read clinical data.
 */
export function toAuditView(log: AuditLog, viewer: User | null): AuditLog {
    if (!isClinicalEntry(log) || (viewer && hasPermission(viewer, "medical:read"))) return log;
    return { ...log, action: "clinical.update", resourceType: "fighter", resourceId: "restricted", resourceLabel: RESTRICTED_LABEL, details: RESTRICTED_DETAILS };
}

/**
 * Audit entries matching the query, newest first, as `viewer` (default: the signed-in user) may see
 * them. Entries are projected before filtering, so filters and search never match hidden values.
 */
export async function listAuditLogs(query: AuditLogQuery = {}, viewer?: User | null): Promise<AuditLog[]> {
    const [reader] = await Promise.all([viewer === undefined ? getCurrentUser() : viewer, simulateLatency()]);
    const search = query.search?.trim().toLowerCase();
    return db()
        .auditLogs.map((log) => toAuditView(log, reader))
        .filter((log) => {
            if (query.actorId && log.actorId !== query.actorId) return false;
            if (query.actorRole && log.actorRole !== query.actorRole) return false;
            if (query.resourceType && log.resourceType !== query.resourceType) return false;
            if (query.status && log.status !== query.status) return false;
            if (query.from && log.timestamp < query.from) return false;
            if (query.to && log.timestamp > query.to) return false;
            if (search) {
                const haystack = `${log.actorName} ${log.action} ${log.resourceLabel} ${log.resourceId}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
