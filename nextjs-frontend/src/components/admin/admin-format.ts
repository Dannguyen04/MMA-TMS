import type {
    AIJobStatus,
    AIModelTask,
    AuditLog,
    AuditResourceType,
    CameraAngle,
    Permission,
    PermissionCatalogEntry,
    PipelineStage,
    Role,
} from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, hasMessage, plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/format";

/** Presentation helpers shared by the administrator screens. */

export const ROLE_ORDER: Role[] = ["fighter", "coach", "doctor", "admin"];

/** Who can appear as the actor of an audit entry, in filter order. */
export const ACTOR_ROLES: AuditLog["actorRole"][] = [...ROLE_ORDER, "system"];

/** A role's label ("Sports doctor"). */
export function roleLabel(t: Translator, role: Role): string {
    return t(`role.${role}`);
}

/** A role's label as it reads mid-sentence: as is in English ("the Coach role"), in lower case in Vietnamese. */
export function roleInSentence(label: string, locale: Locale): string {
    return locale === "vi" ? label.toLowerCase() : label;
}

/** `{role}` (mid-sentence) and `{roleLower}` for messages that name a role. */
export function roleParams(t: Translator, role: Role, locale: Locale): { role: string; roleLower: string } {
    const label = roleLabel(t, role);
    return { role: roleInSentence(label, locale), roleLower: label.toLowerCase() };
}

/** A role's one-line description; the stored text when the role has no translated one. */
export function roleDescription(t: Translator, role: Role, fallback: string): string {
    const key = `screens.admin.roleDescription.${role}`;
    return hasMessage(key) ? t(key) : fallback;
}

export function actorRoleLabel(t: Translator, actorRole: AuditLog["actorRole"]): string {
    return actorRole === "system" ? t("screens.admin.actor.system") : roleLabel(t, actorRole);
}

/** Secondary label under an audit actor — "System" entries are automated, so the role would only repeat the name. */
export function actorCaption(t: Translator, actorRole: AuditLog["actorRole"]): string {
    return actorRole === "system" ? t("screens.admin.actor.automated") : roleLabel(t, actorRole);
}

export const AUDIT_RESOURCE_TYPES: AuditResourceType[] = [
    "auth",
    "user",
    "role",
    "fighter",
    "training_plan",
    "training_session",
    "goal",
    "video",
    "ai_job",
    "ai_model",
    "ai_finding",
    "ai_alert",
    "medical_record",
    "examination",
    "injury",
    "treatment",
    "recovery_plan",
    "clearance",
    "notification",
    "settings",
];

export function auditResourceLabel(t: Translator, type: AuditResourceType): string {
    return t(`screens.admin.auditResource.${type}` as MessageKey);
}

/** "Estimating pose keypoints" — where a job is in the analysis pipeline. */
export function pipelineStageLabel(t: Translator, stage: PipelineStage): string {
    return t(`screens.admin.pipelineStage.${stage}` as MessageKey);
}

export function jobStatusLabel(t: Translator, status: AIJobStatus): string {
    return t(`screens.admin.jobStatus.${status}` as MessageKey);
}

export function modelTaskLabel(t: Translator, task: AIModelTask): string {
    return t(`screens.admin.modelTask.${task}` as MessageKey);
}

export function cameraAngleLabel(t: Translator, angle: CameraAngle): string {
    return t(`screens.admin.cameraAngle.${angle}` as MessageKey);
}

/** Display order of permission groups in the role matrix and on user pages. */
export const PERMISSION_GROUP_ORDER = ["Fighters", "Training", "Video & AI", "Medical", "Administration"] as const;

const PERMISSION_GROUP_KEYS: Record<(typeof PERMISSION_GROUP_ORDER)[number], MessageKey> = {
    Fighters: "screens.admin.permissionGroup.fighters",
    Training: "screens.admin.permissionGroup.training",
    "Video & AI": "screens.admin.permissionGroup.videoAi",
    Medical: "screens.admin.permissionGroup.medical",
    Administration: "screens.admin.permissionGroup.administration",
};

export function permissionGroupLabel(t: Translator, group: (typeof PERMISSION_GROUP_ORDER)[number]): string {
    return t(PERMISSION_GROUP_KEYS[group]);
}

/** A permission's label in the viewer's language; the catalog's own label for a permission without one. */
export function permissionLabel(t: Translator, entry: Pick<PermissionCatalogEntry, "permission" | "label">): string {
    const key = `screens.admin.permission.${entry.permission}`;
    return hasMessage(key) ? t(key) : entry.label;
}

/** Permissions in this group expose clinical data and are visually marked as sensitive. */
export const SENSITIVE_PERMISSION_GROUP = "Medical";

/** Permissions that open clinical records (the health summary alone is not clinical detail). */
export const CLINICAL_PERMISSIONS: Permission[] = ["medical:read", "medical:write", "clearance:manage"];

/** "3 jobs" / "1 job" from `key` and `key.one`, with the count formatted like `pluralize`. */
export function countLabel(t: Translator, key: MessageKey, count: number, params: Record<string, string | number> = {}): string {
    return plural(t, key, count, { ...params, n: formatNumber(count) });
}

/** The text before and after `{token}` in a message, for wrapping the inserted part in markup. */
export function splitAround(message: string, token: string): [string, string] {
    const at = message.indexOf(`{${token}}`);
    return at === -1 ? [message, ""] : [message.slice(0, at), message.slice(at + token.length + 2)];
}

/** 42 → "42 s", 95 → "1m 35s", 3720 → "1h 2m" (in Vietnamese "1 phút 35 giây"). */
export function formatDurationSec(totalSeconds: number, locale: Locale = "en"): string {
    const t = createTranslator(locale);
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) return t("screens.admin.duration.seconds", { s });
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return m === 0 ? t("screens.admin.duration.hours", { h }) : t("screens.admin.duration.hoursMinutes", { h, m });
    const rest = s % 60;
    return rest === 0 ? t("screens.admin.duration.minutes", { m }) : t("screens.admin.duration.minutesSeconds", { m, s: rest });
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
