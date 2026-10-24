import { Ban, TriangleAlert, type LucideIcon } from "lucide-react";

import { clearanceDaysRemaining, clearanceExpiresSoon, type ClearanceState } from "@/lib/domain/rules";
import type { MedicalClearance } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
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
    locale?: Locale;
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

function describeValidity(
    clearance: MedicalClearance | null,
    state: ClearanceState,
    now: string,
    warningDays: number,
    locale: Locale = "en",
): Validity {
    const t = createTranslator(locale);
    if (state === "none" || !clearance) return { status: { text: t("health.clearance.validity.none"), emphasis: "muted" } };
    if (clearance.status === "revoked") {
        return {
            status: {
                text: clearance.revokedAt
                    ? t("health.clearance.validity.revoked_on", { date: formatDate(clearance.revokedAt, locale) })
                    : t("health.clearance.validity.revoked"),
                emphasis: "danger",
                icon: Ban,
            },
        };
    }
    if (state === "expired") {
        return {
            status: {
                text: clearance.validUntil
                    ? t("health.clearance.validity.expired_on", { date: formatDate(clearance.validUntil, locale) })
                    : t("health.clearance.validity.expired"),
                emphasis: "danger",
                icon: TriangleAlert,
            },
        };
    }
    const days = clearanceDaysRemaining(clearance, now);
    if (!clearance.validUntil || days === null) return { status: { text: t("health.clearance.validity.no_expiry"), emphasis: "muted" } };

    const date = { iso: clearance.validUntil, text: formatDate(clearance.validUntil, locale) };
    return clearanceExpiresSoon(clearance, warningDays, now)
        ? { date, status: { text: t("health.clearance.validity.expires_in", { time: describeDaysUntil(days, locale) }), emphasis: "warning", icon: TriangleAlert } }
        : {
            date,
            status: {
                text: t("health.clearance.validity.days_left", {
                    count: days,
                    unit: locale === "vi" ? "ngày" : (days === 1 ? "day" : "days"),
                }),
                emphasis: "muted",
            },
        };
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
    locale = "en",
}: ClearanceValidityProps) {
    const t = createTranslator(locale);
    const { date, status } = describeValidity(clearance, state, now, warningDays, locale);
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
                    {t("health.clearance.validity.valid_until")} <time dateTime={date.iso}>{date.text}</time>
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
export function ClearanceCell({ size = "xs", locale = "en", ...props }: ClearanceValidityProps) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <ClearanceBadge state={props.state} size="sm" locale={locale} />
            <ClearanceValidity {...props} size={size} locale={locale} />
        </div>
    );
}
