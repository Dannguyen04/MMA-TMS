import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import type { SessionStatus, SessionType, TrainingPlanStatus } from "@/api";
import type { ApplicationStatus } from "@/api/admissions";
import type { ColorTokens } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * Only tones backed by a real palette key. The palette has no warning/info keys,
 * so states that would need them render as `neutral` until those keys exist.
 */
export type VisualTone = "success" | "danger" | "neutral";

export type ToneColors = { fg: string; soft: string; border: string; label: string };

export function toneColors(colors: ColorTokens, tone: VisualTone): ToneColors {
  if (tone === "success") {
    return { fg: colors.success, soft: colors.successSoft, border: colors.success, label: colors.success };
  }
  if (tone === "danger") {
    return { fg: colors.danger, soft: colors.dangerSoft, border: colors.danger, label: colors.danger };
  }
  return { fg: colors.inkMuted, soft: colors.surfaceMuted, border: colors.line, label: colors.ink };
}

export const SESSION_TYPE_ICON: Record<SessionType, IconName> = {
  SHADOW_BOXING: "body",
  PAD_WORK: "hand-left",
  HEAVY_BAG: "fitness",
  SPARRING: "people",
  GRAPPLING: "infinite",
  STRENGTH_CONDITIONING: "barbell",
  RECOVERY: "leaf",
  PHYSICAL_THERAPY: "bandage",
};

export const SESSION_STATUS_TONE: Record<SessionStatus, VisualTone> = {
  SCHEDULED: "neutral",
  IN_PROGRESS: "neutral",
  COMPLETED: "success",
  SKIPPED: "neutral",
  CANCELLED: "neutral",
  ABANDONED: "danger",
};

export const PLAN_STATUS_TONE: Record<TrainingPlanStatus, VisualTone> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

export const PLAN_STATUS_ICON: Record<TrainingPlanStatus, IconName> = {
  ACTIVE: "play",
  DRAFT: "ellipse-outline",
  COMPLETED: "checkmark",
  CANCELLED: "close",
};

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, VisualTone> = {
  SUBMITTED: "neutral",
  FAILED: "danger",
  PASSED: "success",
  REJECTED: "danger",
  APPROVED: "success",
  ACTIVATED: "success",
};

export const APPLICATION_STATUS_ICON: Record<ApplicationStatus, IconName> = {
  SUBMITTED: "document-text-outline",
  FAILED: "close",
  PASSED: "ribbon-outline",
  REJECTED: "ban",
  APPROVED: "checkmark-done",
  ACTIVATED: "person-circle-outline",
};

export const JOINT_STATE_TONE: Record<string, VisualTone> = {
  HEALTHY: "success",
  SUSPECTED: "neutral",
  SUSPECTED_AVOIDANCE: "neutral",
  CONFIRMED_IMPAIRMENT: "danger",
};

export const JOINT_STATE_RANK: Record<string, number> = {
  HEALTHY: 0,
  SUSPECTED: 1,
  SUSPECTED_AVOIDANCE: 2,
  CONFIRMED_IMPAIRMENT: 3,
};

export const SEVERITY_TONE: Record<string, VisualTone> = {
  MINOR: "neutral",
  MODERATE: "neutral",
  SEVERE: "danger",
  CRITICAL: "danger",
};
