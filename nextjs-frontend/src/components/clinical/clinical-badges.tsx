"use client";

import {
    Activity,
    Bandage,
    BedDouble,
    CalendarClock,
    CircleCheck,
    CircleSlash,
    Dumbbell,
    Hand,
    Pause,
    PersonStanding,
    Pill,
    RefreshCw,
    ScanLine,
    Snowflake,
    Stethoscope,
    type LucideIcon,
} from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { ALERT_STATUS_META, StatusBadge, type BadgeSize, type StatusMeta } from "@/components/domain/status-badges";
import type { DoctorDecision, RecoveryPlanStatus, TreatmentStatus, TreatmentType } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { DOCTOR_DECISION_COPY, treatmentTypeText } from "./clinical-copy";

/**
 * Presentation for clinical statuses without a badge in the shared domain set: treatment
 * status, recovery plan status and the doctor's decision on an AI observation.
 * Label + icon + tone, never colour alone. Labels are dictionary keys, translated where the badge renders.
 */

type KeyedStatusMeta = StatusMeta & { label: MessageKey };

export const TREATMENT_STATUS_META: Record<TreatmentStatus, KeyedStatusMeta> = {
    planned: { label: "doctorClinical.treatmentStatus.planned", tone: "neutral", icon: CalendarClock },
    ongoing: { label: "doctorClinical.treatmentStatus.ongoing", tone: "info", icon: Activity },
    completed: { label: "doctorClinical.treatmentStatus.completed", tone: "success", icon: CircleCheck },
};

export function TreatmentStatusBadge({ status, size, className }: { status: TreatmentStatus; size?: BadgeSize; className?: string }) {
    const t = useT();
    const meta = TREATMENT_STATUS_META[status];
    return <StatusBadge meta={{ ...meta, label: t(meta.label) }} size={size} className={className} />;
}

export const RECOVERY_PLAN_STATUS_META: Record<RecoveryPlanStatus, KeyedStatusMeta> = {
    active: { label: "doctorClinical.planStatus.active", tone: "info", icon: RefreshCw },
    paused: { label: "doctorClinical.planStatus.paused", tone: "warning", icon: Pause },
    completed: { label: "doctorClinical.planStatus.completed", tone: "success", icon: CircleCheck },
    cancelled: { label: "doctorClinical.planStatus.cancelled", tone: "neutral", icon: CircleSlash },
};

export function RecoveryPlanStatusBadge({ status, size, className }: { status: RecoveryPlanStatus; size?: BadgeSize; className?: string }) {
    const t = useT();
    return <StatusBadge meta={{ ...RECOVERY_PLAN_STATUS_META[status], label: t(`doctorClinical.planStatusBadge.${status}`) }} size={size} className={className} />;
}

/** A doctor's decision reads the same as the observation status it sets (tone and icon; the label is the decision's past tense). */
export const DOCTOR_DECISION_META: Record<DoctorDecision, KeyedStatusMeta> = {
    acknowledged: { ...ALERT_STATUS_META.acknowledged, label: DOCTOR_DECISION_COPY.acknowledged.past },
    follow_up: { ...ALERT_STATUS_META.follow_up, label: DOCTOR_DECISION_COPY.follow_up.past },
    dismissed: { ...ALERT_STATUS_META.dismissed, label: DOCTOR_DECISION_COPY.dismissed.past },
};

/** The doctor's decision as a badge, in the viewer's language. */
export function DoctorDecisionBadge({ decision, size, className }: { decision: DoctorDecision; size?: BadgeSize; className?: string }) {
    const t = useT();
    const meta = DOCTOR_DECISION_META[decision];
    return <StatusBadge meta={{ ...meta, label: t(meta.label) }} size={size} className={className} />;
}

export const TREATMENT_TYPE_ICONS: Record<TreatmentType, LucideIcon> = {
    rest: BedDouble,
    ice_compression: Snowflake,
    physiotherapy: PersonStanding,
    manual_therapy: Hand,
    medication: Pill,
    imaging: ScanLine,
    strength_rehab: Dumbbell,
    specialist_referral: Stethoscope,
    immobilisation: Bandage,
};

/** Treatment type icon in a soft tile; labelled for assistive technology unless the label sits next to it. */
export function TreatmentTypeIcon({ type, labelled = false, className }: { type: TreatmentType | null; labelled?: boolean; className?: string }) {
    const t = useT();
    const Icon = type ? TREATMENT_TYPE_ICONS[type] : Stethoscope;
    return (
        <span
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-inset ring-border",
                className,
            )}
            role={labelled ? "img" : undefined}
            aria-label={labelled ? (type ? treatmentTypeText(t, type) : t("doctorClinical.treatmentType.fallback")) : undefined}
            aria-hidden={labelled ? undefined : true}
        >
            <Icon className="size-[18px]" aria-hidden />
        </span>
    );
}
