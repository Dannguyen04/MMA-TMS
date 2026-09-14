import {
    Activity,
    Ban,
    BellRing,
    Bot,
    CalendarCheck2,
    CalendarClock,
    CalendarX2,
    CircleCheck,
    CircleDashed,
    CircleX,
    Clock,
    Eye,
    Flag,
    HeartPulse,
    LoaderCircle,
    PenLine,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    ShieldQuestion,
    ShieldX,
    Sparkles,
    Target,
    TrendingUp,
    TriangleAlert,
    UserCheck,
    UserX,
    type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/tone";
import {
    AI_JOB_STATUS_LABELS,
    ALERT_STATUS_LABELS,
    CLEARANCE_LEVEL_LABELS,
    GOAL_STATUS_LABELS,
    HEALTH_STATUS_LABELS,
    INJURY_SEVERITY_LABELS,
    INJURY_STATUS_LABELS,
    PLAN_STATUS_LABELS,
    ROLE_LABELS,
    SESSION_STATUS_LABELS,
    USER_STATUS_LABELS,
    VIDEO_STATUS_LABELS,
} from "@/lib/domain/labels";
import { confidenceBand, type ClearanceState } from "@/lib/domain/rules";
import type {
    AIFeedback,
    AIJobStatus,
    AlertStatus,
    GoalStatus,
    HealthStatus,
    InjurySeverity,
    InjuryStatus,
    PlanStatus,
    Role,
    SessionStatus,
    UserStatus,
    VideoStatus,
} from "@/lib/domain/types";
import { formatConfidence } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Every status is rendered with a label + icon + tone, so meaning never depends on
 * color alone. Status → presentation mappings live only in this file.
 */

export interface StatusMeta {
    label: string;
    tone: Tone;
    icon: LucideIcon;
    /** Solid emphasis for states that block activity. */
    solid?: boolean;
}

export type BadgeSize = "sm" | "md";

/** Renders any status meta as a badge; the typed badges below and the clinical badge sets build on it. */
export function StatusBadge({
    meta,
    size,
    variant,
    className,
}: {
    meta: StatusMeta;
    size?: BadgeSize;
    /** Defaults to solid for blocking states and soft otherwise. */
    variant?: "soft" | "solid" | "outline";
    className?: string;
}) {
    return (
        <Badge tone={meta.tone} variant={variant ?? (meta.solid ? "solid" : "soft")} icon={meta.icon} size={size} className={className}>
            {meta.label}
        </Badge>
    );
}

/* ─── Health ──────────────────────────────────────────────────────────────── */

export const HEALTH_STATUS_META: Record<HealthStatus, StatusMeta> = {
    healthy: { label: HEALTH_STATUS_LABELS.healthy, tone: "success", icon: HeartPulse },
    monitoring: { label: HEALTH_STATUS_LABELS.monitoring, tone: "warning", icon: Eye },
    injured: { label: HEALTH_STATUS_LABELS.injured, tone: "danger", icon: TriangleAlert },
    recovery: { label: HEALTH_STATUS_LABELS.recovery, tone: "info", icon: RefreshCw },
    not_cleared: { label: HEALTH_STATUS_LABELS.not_cleared, tone: "danger", icon: Ban, solid: true },
};

export function HealthStatusBadge({ status, size, className }: { status: HealthStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={HEALTH_STATUS_META[status]} size={size} className={className} />;
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

export const CLEARANCE_STATE_META: Record<ClearanceState, StatusMeta> = {
    full: { label: CLEARANCE_LEVEL_LABELS.full, tone: "success", icon: ShieldCheck },
    restricted: { label: "Restricted", tone: "warning", icon: ShieldAlert },
    not_cleared: { label: CLEARANCE_LEVEL_LABELS.not_cleared, tone: "danger", icon: ShieldX, solid: true },
    expired: { label: "Expired", tone: "danger", icon: ShieldX },
    none: { label: "No clearance", tone: "neutral", icon: ShieldQuestion },
};

export function ClearanceBadge({ state, size, className }: { state: ClearanceState; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={CLEARANCE_STATE_META[state]} size={size} className={className} />;
}

/**
 * A fighter's Medical Clearance, then their health status. When both already say the fighter must
 * not train (health Not Cleared with a Not Cleared or expired clearance) only the clearance is shown.
 */
export function FighterStatusBadges({
    healthStatus,
    clearanceState,
    size,
    className,
}: {
    healthStatus: HealthStatus;
    clearanceState: ClearanceState;
    size?: BadgeSize;
    className?: string;
}) {
    const repeatsClearance = healthStatus === "not_cleared" && (clearanceState === "not_cleared" || clearanceState === "expired");
    return (
        <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
            <ClearanceBadge state={clearanceState} size={size} />
            {!repeatsClearance && <HealthStatusBadge status={healthStatus} size={size} />}
        </span>
    );
}

/* ─── Video & AI pipeline ─────────────────────────────────────────────────── */

export const VIDEO_STATUS_META: Record<VideoStatus, StatusMeta> = {
    uploading: { label: VIDEO_STATUS_LABELS.uploading, tone: "neutral", icon: LoaderCircle },
    queued: { label: VIDEO_STATUS_LABELS.queued, tone: "neutral", icon: Clock },
    processing: { label: VIDEO_STATUS_LABELS.processing, tone: "primary", icon: LoaderCircle },
    completed: { label: VIDEO_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
    failed: { label: VIDEO_STATUS_LABELS.failed, tone: "danger", icon: CircleX },
};

export function VideoStatusBadge({ status, size, className }: { status: VideoStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={VIDEO_STATUS_META[status]} size={size} className={className} />;
}

export const AI_JOB_STATUS_META: Record<AIJobStatus, StatusMeta> = {
    queued: { label: AI_JOB_STATUS_LABELS.queued, tone: "neutral", icon: Clock },
    processing: { label: AI_JOB_STATUS_LABELS.processing, tone: "primary", icon: LoaderCircle },
    completed: { label: AI_JOB_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
    failed: { label: AI_JOB_STATUS_LABELS.failed, tone: "danger", icon: CircleX },
};

export function AIJobStatusBadge({ status, size, className }: { status: AIJobStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={AI_JOB_STATUS_META[status]} size={size} className={className} />;
}

export function LowConfidenceBadge({ size, className }: { size?: BadgeSize; className?: string }) {
    return (
        <Badge tone="warning" icon={TriangleAlert} size={size} className={className}>
            Low confidence
        </Badge>
    );
}

/** Marks content produced by AI so it is never mistaken for a human judgement. */
export function AIGeneratedBadge({ size, className, label = "AI-generated" }: { size?: BadgeSize; className?: string; label?: string }) {
    return (
        <Badge tone="ai" icon={Sparkles} size={size} className={className}>
            {label}
        </Badge>
    );
}

/**
 * Review state of an AI output: unreviewed, needs review (low confidence), or the human decision.
 */
export function ReviewStateBadge({
    review,
    confidence,
    size,
    className,
}: {
    review: AIFeedback | null;
    confidence: number;
    size?: BadgeSize;
    className?: string;
}) {
    if (review?.decision === "confirmed") {
        return (
            <Badge tone="success" icon={UserCheck} size={size} className={className} title={`Confirmed by ${review.reviewerName}`}>
                Human verified
            </Badge>
        );
    }
    if (review?.decision === "corrected") {
        return (
            <Badge tone="info" icon={PenLine} size={size} className={className} title={`Corrected by ${review.reviewerName}`}>
                Human corrected
            </Badge>
        );
    }
    if (review?.decision === "rejected") {
        return (
            <Badge tone="neutral" icon={UserX} size={size} className={className} title={`Rejected by ${review.reviewerName}`}>
                Rejected by reviewer
            </Badge>
        );
    }
    if (confidenceBand(confidence) === "low") {
        return (
            <Badge tone="warning" icon={TriangleAlert} size={size} className={className}>
                Needs review
            </Badge>
        );
    }
    return (
        <Badge tone="ai" icon={Bot} size={size} className={className}>
            Unreviewed
        </Badge>
    );
}

export const ALERT_STATUS_META: Record<AlertStatus, StatusMeta> = {
    new: { label: ALERT_STATUS_LABELS.new, tone: "ai", icon: BellRing },
    acknowledged: { label: ALERT_STATUS_LABELS.acknowledged, tone: "neutral", icon: CircleCheck },
    follow_up: { label: ALERT_STATUS_LABELS.follow_up, tone: "warning", icon: CalendarClock },
    dismissed: { label: ALERT_STATUS_LABELS.dismissed, tone: "neutral", icon: CircleX },
};

export function AlertStatusBadge({ status, size, className }: { status: AlertStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={ALERT_STATUS_META[status]} size={size} className={className} />;
}

/** Confidence as text + band, e.g. "87% · High". */
export function ConfidenceBadge({ confidence, size, className }: { confidence: number; size?: BadgeSize; className?: string }) {
    const band = confidenceBand(confidence);
    const tone: Tone = band === "high" ? "neutral" : band === "medium" ? "neutral" : "warning";
    return (
        <Badge tone={tone} variant="outline" size={size} className={className} icon={band === "low" ? TriangleAlert : undefined}>
            {formatConfidence(confidence)} confidence
        </Badge>
    );
}

/* ─── Training ────────────────────────────────────────────────────────────── */

export const SESSION_STATUS_META: Record<SessionStatus, StatusMeta> = {
    scheduled: { label: SESSION_STATUS_LABELS.scheduled, tone: "primary", icon: CalendarClock },
    in_progress: { label: SESSION_STATUS_LABELS.in_progress, tone: "primary", icon: Activity },
    completed: { label: SESSION_STATUS_LABELS.completed, tone: "success", icon: CalendarCheck2 },
    missed: { label: SESSION_STATUS_LABELS.missed, tone: "warning", icon: CalendarX2 },
    cancelled: { label: SESSION_STATUS_LABELS.cancelled, tone: "neutral", icon: CircleX },
};

export function SessionStatusBadge({ status, size, className }: { status: SessionStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={SESSION_STATUS_META[status]} size={size} className={className} />;
}

export const PLAN_STATUS_META: Record<PlanStatus, StatusMeta> = {
    draft: { label: PLAN_STATUS_LABELS.draft, tone: "neutral", icon: CircleDashed },
    active: { label: PLAN_STATUS_LABELS.active, tone: "primary", icon: Activity },
    completed: { label: PLAN_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
    archived: { label: PLAN_STATUS_LABELS.archived, tone: "neutral", icon: Clock },
};

export function PlanStatusBadge({ status, size, className }: { status: PlanStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={PLAN_STATUS_META[status]} size={size} className={className} />;
}

export const GOAL_STATUS_META: Record<GoalStatus, StatusMeta> = {
    on_track: { label: GOAL_STATUS_LABELS.on_track, tone: "primary", icon: TrendingUp },
    at_risk: { label: GOAL_STATUS_LABELS.at_risk, tone: "warning", icon: TriangleAlert },
    achieved: { label: GOAL_STATUS_LABELS.achieved, tone: "success", icon: Target },
    missed: { label: GOAL_STATUS_LABELS.missed, tone: "neutral", icon: Flag },
};

export function GoalStatusBadge({ status, size, className }: { status: GoalStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={GOAL_STATUS_META[status]} size={size} className={className} />;
}

/* ─── Injuries ────────────────────────────────────────────────────────────── */

export const INJURY_SEVERITY_META: Record<InjurySeverity, StatusMeta> = {
    minor: { label: INJURY_SEVERITY_LABELS.minor, tone: "warning", icon: TriangleAlert },
    moderate: { label: INJURY_SEVERITY_LABELS.moderate, tone: "danger", icon: TriangleAlert },
    severe: { label: INJURY_SEVERITY_LABELS.severe, tone: "danger", icon: TriangleAlert, solid: true },
};

export function InjurySeverityBadge({ severity, size, className }: { severity: InjurySeverity; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={INJURY_SEVERITY_META[severity]} size={size} className={className} />;
}

export const INJURY_STATUS_META: Record<InjuryStatus, StatusMeta> = {
    active: { label: INJURY_STATUS_LABELS.active, tone: "danger", icon: Activity },
    recovering: { label: INJURY_STATUS_LABELS.recovering, tone: "info", icon: RefreshCw },
    resolved: { label: INJURY_STATUS_LABELS.resolved, tone: "success", icon: CircleCheck },
};

export function InjuryStatusBadge({ status, size, className }: { status: InjuryStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={INJURY_STATUS_META[status]} size={size} className={className} />;
}

/* ─── Accounts ────────────────────────────────────────────────────────────── */

export const USER_STATUS_META: Record<UserStatus, StatusMeta> = {
    active: { label: USER_STATUS_LABELS.active, tone: "success", icon: CircleCheck },
    invited: { label: USER_STATUS_LABELS.invited, tone: "info", icon: Clock },
    suspended: { label: USER_STATUS_LABELS.suspended, tone: "danger", icon: Ban },
};

export function UserStatusBadge({ status, size, className }: { status: UserStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={USER_STATUS_META[status]} size={size} className={className} />;
}

export function RoleBadge({ role, size, className }: { role: Role; size?: BadgeSize; className?: string }) {
    return (
        <Badge tone="neutral" variant="outline" size={size} className={className}>
            {ROLE_LABELS[role]}
        </Badge>
    );
}
