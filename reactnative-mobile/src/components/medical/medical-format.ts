import type {
  MedicalHistoryEntry,
  MedicalInjury,
  RecoveryMilestone,
  RecoveryPlan,
} from "@/api/types";
import { fighter } from "@/i18n/fighter";
import { medical } from "@/i18n/medical";

type Dict = Record<string, string>;

function lookup(dict: Dict, value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  return dict[value] ?? value;
}

export const jointLabel = (value: unknown) => lookup(medical.joint, value);
export const techniqueLabel = (value: unknown) => lookup(medical.technique, value);
export const severityLabel = (value: unknown) => lookup(medical.severity, value);
export const injuryStatusLabel = (value: unknown) => lookup(medical.injuryStatus, value);
export const recoveryStatusLabel = (value: unknown) => lookup(medical.recoveryStatus, value);
export const clearanceTypeLabel = (value: unknown) => lookup(medical.clearanceType, value);
export const clearanceStatusLabel = (value: unknown) => lookup(medical.clearanceStatus, value);
export const decisionLabel = (value: unknown) => lookup(medical.decision, value);
export const scopeLabel = (value: unknown) => lookup(medical.scope, value);
export const recordTypeLabel = (value: unknown) => lookup(medical.recordType, value);
export const reviewStatusLabel = (value: unknown) => lookup(medical.status, value);
export const requesterRoleLabel = (value: unknown) => lookup(medical.requesterRole, value);
export const sessionTypeName = (value: unknown) => lookup(fighter.sessionType, value);

export function eligibilityReasonLabel(code: string): string {
  return (medical.reason as Dict)[code] ?? medical.unknownReason;
}

export function formatMedicalWhen(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMedicalDay(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function isRecoveryMilestone(value: unknown): value is RecoveryMilestone {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const completedAt = row.completedAt;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.criteria === "string" &&
    (row.targetDate === null || typeof row.targetDate === "string") &&
    typeof row.isCompleted === "boolean" &&
    (completedAt === null || typeof completedAt === "string") &&
    row.isCompleted === (completedAt !== null) &&
    (row.notes === null || typeof row.notes === "string")
  );
}

export type MilestoneView =
  | { kind: "standard"; items: RecoveryMilestone[] }
  | { kind: "legacy"; items: unknown[] };

/** Standard view only when EVERY element matches the server schema; otherwise legacy, unchanged and in order. */
export function classifyMilestones(raw: RecoveryPlan["milestones"] | unknown): MilestoneView {
  const items = Array.isArray(raw) ? (raw as unknown[]) : [];
  if (items.every(isRecoveryMilestone)) {
    return { kind: "standard", items: items as RecoveryMilestone[] };
  }
  return { kind: "legacy", items };
}

/** Read-only text for one legacy milestone element; never reinterpreted into the standard schema. */
export function legacyMilestoneText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function strList(value: unknown, label: (item: unknown) => string): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map(label).join(", ");
}

export type SnapshotLine = { label: string; value: string };

/** Adapter over snake_case history snapshots, keyed by `recordType`. */
export function describeSnapshot(entry: MedicalHistoryEntry): {
  title: string;
  lines: SnapshotLine[];
} {
  const s = entry.snapshot ?? {};
  const lines: SnapshotLine[] = [];
  const push = (label: string, value: string | null) => {
    if (value) lines.push({ label, value });
  };

  switch (entry.recordType) {
    case "INJURY":
      push(medical.injuryDetail, `${jointLabel(s.affected_joint)} · ${str(s.injury_type) ?? "—"}`);
      push(fighter.tap.status, `${injuryStatusLabel(s.status)} · ${severityLabel(s.severity)}`);
      push(medical.occurredAt, s.occurred_at ? formatMedicalWhen(s.occurred_at) : null);
      push(medical.resolvedAt, s.resolved_at ? formatMedicalWhen(s.resolved_at) : null);
      push(fighter.plans.description, str(s.description));
      return { title: medical.recordType.INJURY, lines };
    case "TREATMENT":
      push(medical.snapshot.treatmentType, str(s.treatment_type));
      push(medical.occurredAt, s.treatment_date ? formatMedicalWhen(s.treatment_date) : null);
      push(fighter.plans.description, str(s.description));
      push(medical.snapshot.outcome, str(s.outcome_notes));
      push(medical.snapshot.nextReview, s.next_review_at ? formatMedicalWhen(s.next_review_at) : null);
      return { title: medical.recordType.TREATMENT, lines };
    case "RECOVERY_PLAN": {
      push(medical.recoveryPlans, str(s.title));
      push(fighter.tap.status, recoveryStatusLabel(s.status));
      const range = [formatMedicalDay(s.start_date), formatMedicalDay(s.actual_end_date ?? s.estimated_end_date)]
        .filter((part) => part !== "—")
        .join(" – ");
      push(fighter.plans.dates, range || null);
      push(fighter.plans.description, str(s.description));
      const view = classifyMilestones(s.milestones);
      if (view.items.length > 0) {
        push(
          medical.milestones,
          view.kind === "standard"
            ? view.items
                .map((m) => `${m.isCompleted ? "✓" : "○"} ${m.title}`)
                .join("\n")
            : view.items.map(legacyMilestoneText).join("\n"),
        );
      }
      return { title: medical.recordType.RECOVERY_PLAN, lines };
    }
    case "MEDICAL_EXAMINATION":
      push(scopeLabel(s.scope), decisionLabel(s.decision));
      push(medical.occurredAt, s.examined_at ? formatMedicalWhen(s.examined_at) : null);
      push(medical.snapshot.reason, str(s.reason));
      push(medical.allowedSessionTypes, strList(s.allowed_session_types, sessionTypeName));
      push(medical.allowedTechniqueTypes, strList(s.allowed_technique_types, techniqueLabel));
      push(medical.excludedJoints, strList(s.excluded_joints, jointLabel));
      push(medical.restrictionNotes, str(s.restriction_notes));
      push(medical.validUntil, s.valid_until ? formatMedicalWhen(s.valid_until) : null);
      push(medical.correction, s.supersedes_id ? "✓" : null);
      return { title: medical.recordType.MEDICAL_EXAMINATION, lines };
    case "MEDICAL_CLEARANCE":
      push(medical.clearances, `${clearanceTypeLabel(s.clearance_type)} · ${clearanceStatusLabel(s.status)}`);
      push(medical.validFrom, s.valid_from ? formatMedicalWhen(s.valid_from) : null);
      push(medical.validUntil, s.valid_until ? formatMedicalWhen(s.valid_until) : null);
      push(medical.allowedSessionTypes, strList(s.allowed_session_types, sessionTypeName));
      push(medical.allowedTechniqueTypes, strList(s.allowed_technique_types, techniqueLabel));
      push(medical.excludedJoints, strList(s.excluded_joints, jointLabel));
      push(medical.clearanceNotes, str(s.notes));
      push(medical.snapshot.revokedReason, str(s.revoked_reason));
      return { title: medical.recordType.MEDICAL_CLEARANCE, lines };
    case "MEDICAL_REVIEW_REQUEST":
      push(fighter.tap.status, reviewStatusLabel(s.status));
      push(medical.requestedBy, s.requester_role ? requesterRoleLabel(s.requester_role) : null);
      push(medical.requestedAt, s.requested_at ? formatMedicalWhen(s.requested_at) : null);
      push(medical.reviewReason, str(s.reason));
      push(medical.resolvedAt, s.resolved_at ? formatMedicalWhen(s.resolved_at) : null);
      return { title: medical.recordType.MEDICAL_REVIEW_REQUEST, lines };
    default:
      return { title: recordTypeLabel(entry.recordType), lines };
  }
}

/** Injury row to render when only a history snapshot is available (no `GET /injuries/:id`). */
export function injuryFromSnapshot(entry: MedicalHistoryEntry): MedicalInjury | null {
  if (entry.recordType !== "INJURY") return null;
  const s = entry.snapshot ?? {};
  if (typeof s.id !== "string") return null;
  return {
    id: s.id,
    fighterId: typeof s.fighter_id === "string" ? s.fighter_id : "",
    reportedById: typeof s.reported_by_id === "string" ? s.reported_by_id : "",
    affectedJoint: s.affected_joint as MedicalInjury["affectedJoint"],
    injuryType: typeof s.injury_type === "string" ? s.injury_type : "",
    severity: s.severity as MedicalInjury["severity"],
    occurredAt: typeof s.occurred_at === "string" ? s.occurred_at : "",
    description: typeof s.description === "string" ? s.description : null,
    status: s.status as MedicalInjury["status"],
    resolvedAt: typeof s.resolved_at === "string" ? s.resolved_at : null,
    sourceAlertId: typeof s.source_alert_id === "string" ? s.source_alert_id : null,
    triggerVideoId: typeof s.trigger_video_id === "string" ? s.trigger_video_id : null,
    revision: entry.revision,
    createdAt: typeof s.created_at === "string" ? s.created_at : "",
    updatedAt: typeof s.updated_at === "string" ? s.updated_at : "",
  };
}
