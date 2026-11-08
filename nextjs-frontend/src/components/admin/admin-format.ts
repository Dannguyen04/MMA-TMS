import { ROLE_LABELS } from "@/lib/domain/labels";
import type { AuditLog, AuditResourceType, Permission, Role } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { MessageKey, Translator } from "@/lib/i18n/translate";

/** Presentation helpers shared by the administrator screens. */

export const ROLE_ORDER: Role[] = ["fighter", "coach", "doctor", "admin"];

export const ACTOR_ROLE_LABELS: Record<AuditLog["actorRole"], string> = { ...ROLE_LABELS, system: "System" };

/** Secondary label under an audit actor — "System" entries are automated, so the role would only repeat the name. */
export function actorCaption(actorRole: AuditLog["actorRole"], t?: Translator): string {
    if (actorRole === "system") return t ? t("adminBody.audit.automated") : "Automated process";
    return ACTOR_ROLE_LABELS[actorRole];
}

export function actorRoleLabel(t: Translator, role: AuditLog["actorRole"]): string {
    return role === "system" ? t("adminBody.audit.system") : ROLE_LABELS[role];
}

const AUDIT_RESOURCE_KEYS: Record<AuditResourceType, MessageKey> = {
    auth: "adminBody.audit.res.auth",
    user: "adminBody.audit.res.user",
    role: "adminBody.audit.res.role",
    fighter: "adminBody.audit.res.fighter",
    training_plan: "adminBody.audit.res.training_plan",
    training_session: "adminBody.audit.res.training_session",
    goal: "adminBody.audit.res.goal",
    video: "adminBody.audit.res.video",
    ai_job: "adminBody.audit.res.ai_job",
    ai_model: "adminBody.audit.res.ai_model",
    ai_finding: "adminBody.audit.res.ai_finding",
    ai_alert: "adminBody.audit.res.ai_alert",
    medical_record: "adminBody.audit.res.medical_record",
    examination: "adminBody.audit.res.examination",
    injury: "adminBody.audit.res.injury",
    treatment: "adminBody.audit.res.treatment",
    recovery_plan: "adminBody.audit.res.recovery_plan",
    clearance: "adminBody.audit.res.clearance",
    notification: "adminBody.audit.res.notification",
    settings: "adminBody.audit.res.settings",
};

/** Localized display name for an audit resource type. The stored type code stays the identifier. */
export function auditResourceLabel(t: Translator, type: AuditResourceType): string {
    return t(AUDIT_RESOURCE_KEYS[type]);
}

export const AUDIT_RESOURCE_LABELS: Record<AuditResourceType, string> = {
    auth: "Sign-in",
    user: "User account",
    role: "Role",
    fighter: "Fighter profile",
    training_plan: "Training plan",
    training_session: "Training session",
    goal: "Goal",
    video: "Video",
    ai_job: "AI job",
    ai_model: "AI model",
    ai_finding: "AI finding",
    ai_alert: "AI movement observation",
    medical_record: "Medical record",
    examination: "Examination",
    injury: "Injury record",
    treatment: "Treatment",
    recovery_plan: "Recovery plan",
    clearance: "Medical Clearance",
    notification: "Notification",
    settings: "System settings",
};

/** Display order of permission groups in the role matrix and on user pages. */
export const PERMISSION_GROUP_ORDER = ["Fighters", "Training", "Video & AI", "Medical", "Administration"] as const;

/** Permissions in this group expose clinical data and are visually marked as sensitive. */
export const SENSITIVE_PERMISSION_GROUP = "Medical";

export const SENSITIVE_PERMISSION_NOTE = "Clinical data — keep limited to sports doctors";

/** Permissions that open clinical records (the health summary alone is not clinical detail). */
export const CLINICAL_PERMISSIONS: Permission[] = ["medical:read", "medical:write", "clearance:manage"];

/** 42 → "42 s", 95 → "1m 35s", 3720 → "1h 2m". */
export function formatDurationSec(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) return `${s} s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return m === 0 ? `${h}h` : `${h}h ${m}m`;
    const rest = s % 60;
    return rest === 0 ? `${m} min` : `${m}m ${rest}s`;
}

/** Harmonic mean of precision and recall (both 0–1). */
export function f1Score(precision: number, recall: number): number {
    return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/** 0.914 → "0.91" — model metrics are shown as ratios, like in evaluation reports. */
export function formatRatio(value: number): string {
    return formatNumber(value, 2);
}

/** Share of `part` in `whole` on a 0–100 scale, 0 when there is nothing to compare. */
export function percentOf(part: number, whole: number): number {
    return whole === 0 ? 0 : (part / whole) * 100;
}

/** Stable order of account statuses when sorting lists by status. */
export const USER_STATUS_ORDER = { active: 0, invited: 1, suspended: 2 } as const;
