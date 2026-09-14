import {
    Activity,
    Bandage,
    BedDouble,
    CalendarClock,
    CircleCheck,
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

import { ALERT_STATUS_META, StatusBadge, type BadgeSize, type StatusMeta } from "@/components/domain/status-badges";
import { RECOVERY_PLAN_STATUS_LABELS, TREATMENT_STATUS_LABELS, TREATMENT_TYPE_LABELS } from "@/lib/domain/labels";
import type { DoctorDecision, RecoveryPlanStatus, TreatmentStatus, TreatmentType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Presentation for clinical statuses without a badge in the shared domain set: treatment
 * status, recovery plan status and the doctor's decision on an AI observation.
 * Label + icon + tone, never colour alone.
 */

export const TREATMENT_STATUS_META: Record<TreatmentStatus, StatusMeta> = {
    planned: { label: TREATMENT_STATUS_LABELS.planned, tone: "neutral", icon: CalendarClock },
    ongoing: { label: TREATMENT_STATUS_LABELS.ongoing, tone: "info", icon: Activity },
    completed: { label: TREATMENT_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
};

export function TreatmentStatusBadge({ status, size, className }: { status: TreatmentStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={TREATMENT_STATUS_META[status]} size={size} className={className} />;
}

export const RECOVERY_PLAN_STATUS_META: Record<RecoveryPlanStatus, StatusMeta> = {
    active: { label: RECOVERY_PLAN_STATUS_LABELS.active, tone: "info", icon: RefreshCw },
    paused: { label: RECOVERY_PLAN_STATUS_LABELS.paused, tone: "warning", icon: Pause },
    completed: { label: RECOVERY_PLAN_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
};

export function RecoveryPlanStatusBadge({ status, size, className }: { status: RecoveryPlanStatus; size?: BadgeSize; className?: string }) {
    const meta = RECOVERY_PLAN_STATUS_META[status];
    return <StatusBadge meta={{ ...meta, label: `Plan ${meta.label.toLowerCase()}` }} size={size} className={className} />;
}

/** A doctor's decision reads the same as the observation status it sets. */
export const DOCTOR_DECISION_META: Record<DoctorDecision, StatusMeta> = {
    acknowledged: ALERT_STATUS_META.acknowledged,
    follow_up: ALERT_STATUS_META.follow_up,
    dismissed: ALERT_STATUS_META.dismissed,
};

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
export function TreatmentTypeIcon({ type, labelled = false, className }: { type: TreatmentType; labelled?: boolean; className?: string }) {
    const Icon = TREATMENT_TYPE_ICONS[type];
    return (
        <span
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-inset ring-border",
                className,
            )}
            role={labelled ? "img" : undefined}
            aria-label={labelled ? TREATMENT_TYPE_LABELS[type] : undefined}
            aria-hidden={labelled ? undefined : true}
        >
            <Icon className="size-[18px]" aria-hidden />
        </span>
    );
}
