import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  CLEARANCE_STATUSES,
  EXAMINATION_DECISIONS,
  INJURY_SEVERITIES,
  INJURY_STATUSES,
  RECOVERY_PLAN_STATUSES,
  REVIEW_REQUEST_STATUSES,
  type ClearanceStatus,
  type ExaminationDecision,
  type InjurySeverity,
  type InjuryStatus,
  type MedicalStatus,
  type RecoveryPlanStatus,
  type ReviewRequestStatus,
} from "@/api/types";
import { doctor } from "@/i18n/doctor";
import { medical } from "@/i18n/medical";
import { media } from "@/i18n/media";
import { appearanceStorageKey, sanitizeAppearanceUserId } from "@/theme/appearance/settings";
import { normalizeHex } from "@/theme/appearance/color-math";
import { useSession } from "@/session/session-context";

/** Figma variable collection "MMA Gym", modes Dark / Light. */
const FIGMA = {
  positive: { light: "#16A34A", dark: "#22C55E" },
  info: { light: "#0284C7", dark: "#38BDF8" },
  warning: { light: "#CA8A04", dark: "#EAB308" },
  critical: { light: "#DC2626", dark: "#EF4444" },
  muted: { light: "#71717A", dark: "#A1A1AA" },
  /** Recovery "Đang hoạt động" pill on the Doctor recovery frame. */
  activePlan: { light: "#FF8066", dark: "#FF8066" },
} as const;

type Tone = keyof typeof FIGMA;
type Scheme = "light" | "dark";

export const AI_JOB_STATUSES = ["PENDING", "PROCESSING", "DONE", "FAILED"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export type BadgeId =
  | `medical.${MedicalStatus}`
  | `clearance.${ClearanceStatus}`
  | `injury.${InjuryStatus}`
  | `injurySeverity.${InjurySeverity}`
  | `recovery.${RecoveryPlanStatus}`
  | `exam.${ExaminationDecision}`
  | `review.${ReviewRequestStatus}`
  | `aiJob.${AiJobStatus}`
  | `aiSeverity.${InjurySeverity}`;

type BadgeItem = { id: BadgeId; label: string; tone: Tone };

export type BadgeGroup = { id: string; label: string; items: readonly BadgeItem[] };

const jobLabel: Record<AiJobStatus, string> = {
  PENDING: media.job.PENDING,
  PROCESSING: media.job.PROCESSING,
  DONE: doctor.ai.done,
  FAILED: media.job.FAILED,
};

export const BADGE_GROUPS: readonly BadgeGroup[] = [
  {
    id: "medical",
    label: "Tình trạng sức khỏe",
    items: [
      { id: "medical.HEALTHY", label: doctor.status.HEALTHY, tone: "positive" },
      { id: "medical.MONITORING", label: doctor.status.MONITORING, tone: "warning" },
      { id: "medical.RECOVERY", label: doctor.status.RECOVERY, tone: "info" },
      { id: "medical.INJURED", label: doctor.status.INJURED, tone: "critical" },
      { id: "medical.NOT_CLEARED", label: doctor.status.NOT_CLEARED, tone: "critical" },
    ],
  },
  {
    id: "clearance",
    label: "Giấy phép",
    items: CLEARANCE_STATUSES.map((status) => ({
      id: `clearance.${status}` as BadgeId,
      label: medical.clearanceStatus[status],
      tone: status === "ACTIVE" ? "positive" : status === "REVOKED" ? "critical" : "warning",
    })),
  },
  {
    id: "injury",
    label: "Chấn thương",
    items: INJURY_STATUSES.map((status) => ({
      id: `injury.${status}` as BadgeId,
      label: medical.injuryStatus[status],
      tone: status === "RESOLVED" ? "positive" : status === "RECOVERING" ? "info" : "critical",
    })),
  },
  {
    id: "injurySeverity",
    label: "Mức độ chấn thương",
    items: INJURY_SEVERITIES.map((status) => ({
      id: `injurySeverity.${status}` as BadgeId,
      label: medical.severity[status],
      tone: status === "MINOR" ? "positive" : status === "MODERATE" ? "warning" : "critical",
    })),
  },
  {
    id: "recovery",
    label: "Phục hồi",
    items: RECOVERY_PLAN_STATUSES.map((status) => ({
      id: `recovery.${status}` as BadgeId,
      label: doctor.recovery.status[status],
      tone: status === "ACTIVE" ? "activePlan" : status === "COMPLETED" ? "positive" : "muted",
    })),
  },
  {
    id: "exam",
    label: "Kết luận khám",
    items: EXAMINATION_DECISIONS.map((status) => ({
      id: `exam.${status}` as BadgeId,
      label: medical.decision[status],
      tone:
        status === "ELIGIBLE" ? "positive" : status === "NOT_ELIGIBLE" ? "critical" : "warning",
    })),
  },
  {
    id: "review",
    label: "Yêu cầu xem xét",
    items: REVIEW_REQUEST_STATUSES.map((status) => ({
      id: `review.${status}` as BadgeId,
      label: doctor.review[status],
      tone: status === "OPEN" ? "warning" : "positive",
    })),
  },
  {
    id: "aiJob",
    label: "Tác vụ AI",
    items: AI_JOB_STATUSES.map((status) => ({
      id: `aiJob.${status}` as BadgeId,
      label: jobLabel[status],
      tone: status === "FAILED" ? "critical" : status === "PENDING" ? "warning" : "info",
    })),
  },
  {
    id: "aiSeverity",
    label: "Mức độ cảnh báo AI",
    items: INJURY_SEVERITIES.map((status) => ({
      id: `aiSeverity.${status}` as BadgeId,
      label: medical.severity[status],
      tone: status === "MINOR" ? "positive" : status === "MODERATE" ? "warning" : "critical",
    })),
  },
];

const TONE_BY_ID = new Map<BadgeId, Tone>(
  BADGE_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.tone] as const)),
);

const KNOWN = new Set<string>(TONE_BY_ID.keys());

export function defaultBadgeColor(id: BadgeId, scheme: Scheme): string {
  const tone = TONE_BY_ID.get(id) ?? "muted";
  return FIGMA[tone][scheme];
}

export function medicalBadgeId(status: MedicalStatus): BadgeId {
  return `medical.${status}`;
}

type Overrides = Partial<Record<BadgeId, string>>;

let overrides: Overrides = {};
let loadedFor: string | null | undefined = undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Overrides {
  return overrides;
}

function storageKey(userId: string | null): string {
  const appearanceKey = appearanceStorageKey(userId);
  return appearanceKey.replace("mma.ui.appearance.v1", "mma.ui.doctorBadges.v1");
}

function parseOverrides(raw: string | null): Overrides {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; overrides?: unknown };
    if (!parsed || parsed.version !== 1 || !parsed.overrides || typeof parsed.overrides !== "object") {
      return {};
    }
    const next: Overrides = {};
    for (const [key, value] of Object.entries(parsed.overrides as Record<string, unknown>)) {
      if (!KNOWN.has(key) || typeof value !== "string") continue;
      const hex = normalizeHex(value);
      if (hex) next[key as BadgeId] = hex;
    }
    return next;
  } catch {
    return {};
  }
}

async function loadOverrides(userId: string | null) {
  const key = storageKey(userId);
  const raw = await AsyncStorage.getItem(key);
  overrides = parseOverrides(raw);
  loadedFor = userId;
  emit();
}

export function useBadgeOverrides(): Overrides {
  const { user } = useSession();
  const userId = sanitizeAppearanceUserId(user?.id ?? null);
  useEffect(() => {
    if (loadedFor === userId) return;
    let cancelled = false;
    void loadOverrides(userId).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useBadgeColor(id: BadgeId, scheme: Scheme): string {
  const stored = useBadgeOverrides();
  return stored[id] ?? defaultBadgeColor(id, scheme);
}

export function useSetBadgeColor() {
  const { user } = useSession();
  const userId = sanitizeAppearanceUserId(user?.id ?? null);
  return useCallback(
    (id: BadgeId, hex: string | null) => {
      const next = { ...overrides };
      if (hex == null) delete next[id];
      else {
        const normalized = normalizeHex(hex);
        if (!normalized) return;
        next[id] = normalized;
      }
      overrides = next;
      emit();
      const payload = JSON.stringify({ version: 1, overrides: next });
      void AsyncStorage.setItem(storageKey(userId), payload).catch(() => undefined);
    },
    [userId],
  );
}

export function useResetBadgeColors() {
  const { user } = useSession();
  const userId = sanitizeAppearanceUserId(user?.id ?? null);
  return useCallback(() => {
    overrides = {};
    emit();
    const payload = JSON.stringify({ version: 1, overrides: {} });
    void AsyncStorage.setItem(storageKey(userId), payload).catch(() => undefined);
  }, [userId]);
}
