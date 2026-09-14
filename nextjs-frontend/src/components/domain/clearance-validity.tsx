import { Ban, TriangleAlert, type LucideIcon } from "lucide-react";

import { clearanceDaysRemaining, clearanceExpiresSoon, type ClearanceState } from "@/lib/domain/rules";
import type { MedicalClearance } from "@/lib/domain/types";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { describeDaysUntil } from "./domain-format";
import { ClearanceBadge } from "./status-badges";

/** Default expiry warning window; pages pass SystemSettings.clearanceExpiryWarningDays. */
export const CLEARANCE_WARNING_DAYS = 14;

export interface ClearanceValidityProps {
    clearance: MedicalClearance | null;
    state: ClearanceState;
    /** Server time (ISO). */
    now: string;
    warningDays?: number;
    /** "stacked" puts the date above the status; "inline" joins them on one line. */
    variant?: "stacked" | "inline";
    size?: "xs" | "sm";
    className?: string;
}

type Emphasis = "muted" | "warning" | "danger";

interface Phrase {
    text: string;
    emphasis: Emphasis;
    icon?: LucideIcon;
}

interface Validity {
    /** "Valid until 12 Oct 2026", when a future date still applies. */
    date?: { iso: string; text: string };
    status: Phrase;
}

const EMPHASIS_CLASS: Record<Emphasis, string> = {
    muted: "font-normal text-fg-muted",
    warning: "font-medium text-warning-fg",
    danger: "font-medium text-danger-fg",
};

function describeValidity(clearance: MedicalClearance | null, state: ClearanceState, now: string, warningDays: number): Validity {
    if (state === "none" || !clearance) return { status: { text: "No clearance on file", emphasis: "muted" } };
    if (clearance.status === "revoked") {
        return { status: { text: clearance.revokedAt ? `Revoked ${formatDate(clearance.revokedAt)}` : "Revoked", emphasis: "danger", icon: Ban } };
    }
    if (state === "expired") {
        return { status: { text: clearance.validUntil ? `Expired ${formatDate(clearance.validUntil)}` : "Expired", emphasis: "danger", icon: TriangleAlert } };
    }
    const days = clearanceDaysRemaining(clearance, now);
    if (!clearance.validUntil || days === null) return { status: { text: "No expiry date", emphasis: "muted" } };

    const date = { iso: clearance.validUntil, text: formatDate(clearance.validUntil) };
    return clearanceExpiresSoon(clearance, warningDays, now)
        ? { date, status: { text: `Expires ${describeDaysUntil(days)}`, emphasis: "warning", icon: TriangleAlert } }
        : { date, status: { text: `${pluralize(days, "day")} left`, emphasis: "muted" } };
}

/**
 * How long a Medical Clearance remains valid, in words: the date and days left, a calm warning
 * once it lapses within the warning window, or why no date applies (none on file, expired, revoked).
 */
export function ClearanceValidity({
    clearance,
    state,
    now,
    warningDays = CLEARANCE_WARNING_DAYS,
    variant = "stacked",
    size = "sm",
    className,
}: ClearanceValidityProps) {
    const { date, status } = describeValidity(clearance, state, now, warningDays);
    const StatusIcon = status.icon;
    const iconClass = size === "xs" ? "size-3 shrink-0" : "size-3.5 shrink-0";

    return (
        <span
            className={cn(
                size === "xs" ? "text-xs" : "text-[13px]",
                variant === "stacked" ? "flex flex-col gap-0.5" : "inline-flex flex-wrap items-center gap-x-1",
                className,
            )}
        >
            {date && (
                <span className="text-fg">
                    Valid until <time dateTime={date.iso}>{date.text}</time>
                    {variant === "inline" && <span className="text-fg-muted"> ·</span>}
                </span>
            )}
            <span className={cn("inline-flex items-center gap-1", EMPHASIS_CLASS[status.emphasis])}>
                {StatusIcon && <StatusIcon aria-hidden className={iconClass} />}
                {status.text}
            </span>
        </span>
    );
}

/** Clearance badge with its validity underneath — the table cell used across clinical lists. */
export function ClearanceCell({ size = "xs", ...props }: ClearanceValidityProps) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <ClearanceBadge state={props.state} size="sm" />
            <ClearanceValidity {...props} size={size} />
        </div>
    );
}
