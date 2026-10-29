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
    Scale,
    ShieldAlert,
    ShieldCheck,
    ShieldQuestion,
    ShieldX,
    Sparkles,
    Swords,
    Target,
    TrendingUp,
    TriangleAlert,
    UserCheck,
    UserX,
    type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/tone";
import { APPLICATION_STATUS_LABELS, CONCLUSION_LABELS, type ApplicationStatus, type AssessmentConclusion } from "@/lib/domain/admissions";
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
    BOUT_STATUS_LABELS,
    BOUT_REQUIREMENT_STATUS_LABELS,
    WEIGHT_WARNING_LABELS,
} from "@/lib/domain/labels";
import { confidenceBand, type ClearanceState } from "@/lib/domain/rules";
import type {
    AIFeedback,
    AIJobStatus,
    AlertStatus,
    BoutRequirementStatus,
    BoutStatus,
    Gate1Result,
    GoalStatus,
    HealthStatus,
    InjurySeverity,
    InjuryStatus,
    PlanStatus,
    Role,
    SessionStatus,
    UserStatus,
    SuspensionStatus,
    VideoStatus,
    WeightWarningStatus,
} from "@/lib/domain/types";
import { daysBetweenDates } from "@/lib/domain/suspension-rules";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
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
    variant?: "soft" | "solid" | "outline";
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
        <Badge tone={meta.tone} variant={variant ?? meta.variant ?? (meta.solid ? "solid" : "soft")} icon={meta.icon} size={size} className={className}>
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

export function HealthStatusBadge({ status, size, className, locale }: { status: HealthStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = HEALTH_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`healthStatus.${status}`) } : meta} size={size} className={className} />;
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

export const CLEARANCE_STATE_META: Record<ClearanceState, StatusMeta> = {
    full: { label: CLEARANCE_LEVEL_LABELS.full, tone: "success", icon: ShieldCheck },
    restricted: { label: "Restricted", tone: "warning", icon: ShieldAlert },
    not_cleared: { label: CLEARANCE_LEVEL_LABELS.not_cleared, tone: "danger", icon: ShieldX, solid: true },
    expired: { label: "Expired", tone: "danger", icon: ShieldX },
    none: { label: "No clearance", tone: "neutral", icon: ShieldQuestion },
};

export function ClearanceBadge({ state, size, className, locale }: { state: ClearanceState; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = CLEARANCE_STATE_META[state];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`clearance.${state}`) } : meta} size={size} className={className} />;
}

/**
 * A fighter's Medical Clearance, then their health status. A "not cleared" health status only restates the
 * clearance (and the medical service keeps it after a doctor clears the fighter), so the clearance stands alone.
 */
export function FighterStatusBadges({
    healthStatus,
    clearanceState,
    size,
    className,
    locale,
}: {
    healthStatus: HealthStatus;
    clearanceState: ClearanceState;
    size?: BadgeSize;
    className?: string;
    locale?: Locale;
}) {
    return (
        <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
            <ClearanceBadge state={clearanceState} size={size} locale={locale} />
            {healthStatus !== "not_cleared" && <HealthStatusBadge status={healthStatus} size={size} locale={locale} />}
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

export function VideoStatusBadge({ status, size, className, locale }: { status: VideoStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = VIDEO_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`videoStatus.${status}`) } : meta} size={size} className={className} />;
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
export function AIGeneratedBadge({ size, className, locale, label = createTranslator(locale ?? "en")("aiGenerated") }: { size?: BadgeSize; className?: string; locale?: Locale; label?: string }) {
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
    confidence: number | null;
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
export function ConfidenceBadge({ confidence, size, className }: { confidence: number | null; size?: BadgeSize; className?: string }) {
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
    pending: { label: SESSION_STATUS_LABELS.pending, tone: "warning", icon: Clock, variant: "outline" },
    cancelled: { label: SESSION_STATUS_LABELS.cancelled, tone: "neutral", icon: CircleX },
};

export function SessionStatusBadge({
    status,
    size,
    variant,
    className,
    locale,
}: {
    status: SessionStatus;
    size?: BadgeSize;
    variant?: "soft" | "solid" | "outline";
    className?: string;
    locale?: Locale;
}) {
    const meta = SESSION_STATUS_META[status];
    const label = locale ? createTranslator(locale)(`sessionStatus.${status}`) : meta.label;
    return <StatusBadge meta={{ ...meta, label }} variant={variant ?? meta.variant} size={size} className={className} />;
}

export const PLAN_STATUS_META: Record<PlanStatus, StatusMeta> = {
    draft: { label: PLAN_STATUS_LABELS.draft, tone: "neutral", icon: CircleDashed },
    active: { label: PLAN_STATUS_LABELS.active, tone: "primary", icon: Activity },
    completed: { label: PLAN_STATUS_LABELS.completed, tone: "success", icon: CircleCheck },
    archived: { label: PLAN_STATUS_LABELS.archived, tone: "neutral", icon: Clock },
};

export function PlanStatusBadge({ status, size, className, locale }: { status: PlanStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = PLAN_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`planStatus.${status}`) } : meta} size={size} className={className} />;
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
    critical: { label: INJURY_SEVERITY_LABELS.critical, tone: "danger", icon: TriangleAlert, solid: true },
};

export function InjurySeverityBadge({ severity, size, className, locale }: { severity: InjurySeverity; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = INJURY_SEVERITY_META[severity];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`injurySeverity.${severity}`) } : meta} size={size} className={className} />;
}

export const INJURY_STATUS_META: Record<InjuryStatus, StatusMeta> = {
    active: { label: INJURY_STATUS_LABELS.active, tone: "danger", icon: Activity },
    recovering: { label: INJURY_STATUS_LABELS.recovering, tone: "info", icon: RefreshCw },
    resolved: { label: INJURY_STATUS_LABELS.resolved, tone: "success", icon: CircleCheck },
};

export function InjuryStatusBadge({ status, size, className, locale }: { status: InjuryStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = INJURY_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`injuryStatus.${status}`) } : meta} size={size} className={className} />;
}

/* ─── Accounts ────────────────────────────────────────────────────────────── */

export const USER_STATUS_META: Record<UserStatus, StatusMeta> = {
    active: { label: USER_STATUS_LABELS.active, tone: "success", icon: CircleCheck },
    invited: { label: USER_STATUS_LABELS.invited, tone: "info", icon: Clock },
    suspended: { label: USER_STATUS_LABELS.suspended, tone: "danger", icon: Ban },
};

export function UserStatusBadge({ status, size, className, locale }: { status: UserStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = USER_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`userStatus.${status}`) } : meta} size={size} className={className} />;
}

export function RoleBadge({ role, size, className, locale }: { role: Role; size?: BadgeSize; className?: string; locale?: Locale }) {
    return (
        <Badge tone="neutral" variant="outline" size={size} className={className}>
            {locale ? createTranslator(locale)(`role.${role}`) : ROLE_LABELS[role]}
        </Badge>
    );
}

/* ─── Fighter admissions ──────────────────────────────────────────────────── */

export const APPLICATION_STATUS_META: Record<ApplicationStatus, StatusMeta> = {
    submitted: { label: APPLICATION_STATUS_LABELS.submitted, tone: "info", icon: Clock },
    passed: { label: APPLICATION_STATUS_LABELS.passed, tone: "primary", icon: Flag },
    approved: { label: APPLICATION_STATUS_LABELS.approved, tone: "success", icon: UserCheck },
    activated: { label: APPLICATION_STATUS_LABELS.activated, tone: "success", icon: CircleCheck },
    failed: { label: APPLICATION_STATUS_LABELS.failed, tone: "neutral", icon: CircleX },
    rejected: { label: APPLICATION_STATUS_LABELS.rejected, tone: "danger", icon: UserX },
};

export function ApplicationStatusBadge({ status, size, className, locale }: { status: ApplicationStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    if (locale) {
        const t = createTranslator(locale);
        return <StatusBadge meta={{ ...APPLICATION_STATUS_META[status], label: t(`applicant.status.${status}`) }} size={size} className={className} />;
    }
    return <StatusBadge meta={APPLICATION_STATUS_META[status]} size={size} className={className} />;
}

export const CONCLUSION_META: Record<AssessmentConclusion, StatusMeta> = {
    pass: { label: CONCLUSION_LABELS.pass, tone: "success", icon: CircleCheck },
    fail: { label: CONCLUSION_LABELS.fail, tone: "danger", icon: CircleX },
};

export function ConclusionBadge({ conclusion, size, className }: { conclusion: AssessmentConclusion; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={CONCLUSION_META[conclusion]} size={size} className={className} />;
}

/* ─── Bouts & Gate 1 ──────────────────────────────────────────────────────── */

export const BOUT_STATUS_META: Record<BoutStatus, StatusMeta> = {
    SCHEDULED: { label: BOUT_STATUS_LABELS.SCHEDULED, tone: "neutral", icon: CalendarClock },
    CAMP: { label: BOUT_STATUS_LABELS.CAMP, tone: "primary", icon: Activity },
    FIGHT_WEEK: { label: BOUT_STATUS_LABELS.FIGHT_WEEK, tone: "warning", icon: Swords },
    WEIGHED_IN: { label: BOUT_STATUS_LABELS.WEIGHED_IN, tone: "info", icon: Scale },
    COMPLETED: { label: BOUT_STATUS_LABELS.COMPLETED, tone: "success", icon: CircleCheck },
    CANCELLED: { label: BOUT_STATUS_LABELS.CANCELLED, tone: "neutral", icon: CircleX },
};

/** Pass `locale` on translated screens; without it the badge keeps the English label. */
export function BoutStatusBadge({ status, size, className, locale }: { status: BoutStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = BOUT_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`boutStatus.${status}`) } : meta} size={size} className={className} />;
}

export const BOUT_REQUIREMENT_STATUS_META: Record<BoutRequirementStatus, StatusMeta> = {
    MISSING: { label: BOUT_REQUIREMENT_STATUS_LABELS.MISSING, tone: "danger", icon: CircleX },
    PROVIDED: { label: BOUT_REQUIREMENT_STATUS_LABELS.PROVIDED, tone: "info", icon: Clock },
    CONFIRMED: { label: BOUT_REQUIREMENT_STATUS_LABELS.CONFIRMED, tone: "success", icon: CircleCheck },
    REJECTED: { label: BOUT_REQUIREMENT_STATUS_LABELS.REJECTED, tone: "danger", icon: Ban },
};

export function BoutRequirementStatusBadge({
    status,
    size,
    className,
    locale,
}: {
    status: BoutRequirementStatus;
    size?: BadgeSize;
    className?: string;
    locale?: Locale;
}) {
    const meta = BOUT_REQUIREMENT_STATUS_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`requirementStatus.${status}`) } : meta} size={size} className={className} />;
}

export const WEIGHT_WARNING_META: Record<WeightWarningStatus, StatusMeta> = {
    ON_TRACK: { label: WEIGHT_WARNING_LABELS.ON_TRACK, tone: "success", icon: CircleCheck },
    ABOVE_TARGET: { label: WEIGHT_WARNING_LABELS.ABOVE_TARGET, tone: "warning", icon: TriangleAlert },
    OVER_LIMIT: { label: WEIGHT_WARNING_LABELS.OVER_LIMIT, tone: "danger", icon: TriangleAlert, solid: true },
    NOT_WEIGHED: { label: WEIGHT_WARNING_LABELS.NOT_WEIGHED, tone: "neutral", icon: Clock },
    NEUTRAL: { label: WEIGHT_WARNING_LABELS.NEUTRAL, tone: "neutral", icon: Scale },
};

export function WeightWarningBadge({
    status,
    size,
    className,
    locale,
}: {
    status: WeightWarningStatus;
    size?: BadgeSize;
    className?: string;
    locale?: Locale;
}) {
    const meta = WEIGHT_WARNING_META[status];
    return <StatusBadge meta={locale ? { ...meta, label: createTranslator(locale)(`weightStatus.${status}`) } : meta} size={size} className={className} />;
}

export function Gate1Badge({
    gate1,
    size,
    className,
    compact,
    locale = "en",
}: {
    gate1?: Gate1Result | null;
    size?: BadgeSize;
    className?: string;
    compact?: boolean;
    locale?: Locale;
}) {
    if (!gate1) return null;
    const t = createTranslator(locale);
    if (gate1.passed) {
        return (
            <Badge tone="success" icon={ShieldCheck} size={size} className={className}>
                {t(compact ? "gate1.passedShort" : "gate1.passed")}
            </Badge>
        );
    }
    const totalMissing = gate1.missing.length + gate1.expiring.length;
    return (
        <Badge
            tone="danger"
            variant="solid"
            icon={ShieldAlert}
            size={size}
            className={className}
            title={[...gate1.missing, ...gate1.expiring].join(", ")}
        >
            {t(compact ? "gate1.missingShort" : "gate1.missing", { n: totalMissing })}
        </Badge>
    );
}


/* ─── Suspensions ─────────────────────────────────────────────────────────── */

export type SuspensionBadgeStatus = SuspensionStatus | "GRADED_RETURN";

export const SUSPENSION_STATUS_META: Record<SuspensionBadgeStatus, StatusMeta> = {
    ACTIVE: { label: "Đang đình chỉ", tone: "danger", icon: Ban, solid: true },
    AWAITING_CLEARANCE: { label: "Chờ xác nhận", tone: "warning", icon: Clock },
    GRADED_RETURN: { label: "Tập lại", tone: "info", icon: TrendingUp },
    ENDED: { label: "Đã hết", tone: "success", icon: CircleCheck },
    UPCOMING: { label: "Sắp hiệu lực", tone: "neutral", icon: CalendarClock },
};

export function suspensionStatusBadgeLabel(
    status: SuspensionBadgeStatus,
    options?: {
        ceiling?: number;
        startsOn?: string;
        endsOn?: string;
        today?: string;
        locale?: Locale;
    },
): string {
    const locale = options?.locale ?? "vi";
    const t = createTranslator(locale);

    if (status === "GRADED_RETURN") {
        if (options?.ceiling != null && options.ceiling >= 1 && options.ceiling <= 5) {
            return t("suspension.status.GRADED_RETURN_TIER", { tier: options.ceiling });
        }
        return t("suspension.status.GRADED_RETURN");
    }

    if (status === "ACTIVE" && options?.startsOn && options?.endsOn && options?.today) {
        const total = Math.max(1, daysBetweenDates(options.startsOn, options.endsOn) + 1);
        const elapsed = Math.max(1, Math.min(total, daysBetweenDates(options.startsOn, options.today) + 1));
        return t("suspension.status.ACTIVE_WITH_DAY", { elapsed, total });
    }

    switch (status) {
        case "ACTIVE":
            return t("suspension.status.ACTIVE");
        case "AWAITING_CLEARANCE":
            return t("suspension.status.AWAITING_CLEARANCE");
        case "ENDED":
            return t("suspension.status.ENDED");
        case "UPCOMING":
            return t("suspension.status.UPCOMING");
        default:
            return status;
    }
}

export interface SuspensionStatusBadgeProps {
    status: SuspensionBadgeStatus;
    ceiling?: number;
    startsOn?: string;
    endsOn?: string;
    today?: string;
    size?: BadgeSize;
    variant?: "soft" | "solid" | "outline";
    className?: string;
    locale?: Locale;
    suspension?: {
        startsOn?: string;
        endsOn?: string;
        gradedReturn?: { ceiling: number } | null;
    };
}

export function SuspensionStatusBadge({
    status,
    ceiling,
    startsOn,
    endsOn,
    today,
    size,
    variant,
    className,
    locale,
    suspension,
}: SuspensionStatusBadgeProps) {
    const effectiveStartsOn = startsOn ?? suspension?.startsOn;
    const effectiveEndsOn = endsOn ?? suspension?.endsOn;
    const effectiveCeiling = ceiling ?? suspension?.gradedReturn?.ceiling;
    const meta = SUSPENSION_STATUS_META[status];
    const label = suspensionStatusBadgeLabel(status, {
        ceiling: effectiveCeiling,
        startsOn: effectiveStartsOn,
        endsOn: effectiveEndsOn,
        today,
        locale,
    });
    return (
        <StatusBadge
            meta={{ ...meta, label }}
            size={size}
            variant={variant}
            className={className}
        />
    );
}
