import {
    Archive,
    Bell,
    CalendarClock,
    CircleCheck,
    CircleX,
    FilePen,
    FlaskConical,
    Mail,
    MailPlus,
    Send,
    ShieldAlert,
    type LucideIcon,
} from "lucide-react";

import type { StatusMeta } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { TONE_TEXT } from "@/components/ui/tone";
import type { AIModelStatus, AuditLog, BroadcastChannel, BroadcastStatus } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/**
 * Status presentation for admin-only entities (model lifecycle, broadcasts, audit results).
 * Same contract as components/domain/status-badges: label + icon + tone, never colour alone.
 * Labels come from the dictionary in the viewer's `locale` (English when omitted).
 */

type BadgeSize = "sm" | "md";
type BadgeMeta = Omit<StatusMeta, "label">;

export function modelStatusLabel(t: Translator, status: AIModelStatus): string {
    return t(`screens.admin.modelStatus.${status}` as MessageKey);
}

export function broadcastChannelLabel(t: Translator, channel: BroadcastChannel): string {
    return t(`screens.admin.channel.${channel}` as MessageKey);
}

export function auditStatusLabel(t: Translator, status: AuditLog["status"]): string {
    return t(`screens.admin.auditStatus.${status}` as MessageKey);
}

export const MODEL_STATUS_META: Record<AIModelStatus, BadgeMeta> = {
    active: { tone: "success", icon: CircleCheck },
    staging: { tone: "info", icon: FlaskConical },
    deprecated: { tone: "neutral", icon: Archive },
};

export function ModelStatusBadge({ status, size, className, locale = "en" }: { status: AIModelStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = MODEL_STATUS_META[status];
    return (
        <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
            {modelStatusLabel(createTranslator(locale), status)}
        </Badge>
    );
}

export const BROADCAST_STATUS_META: Record<BroadcastStatus, BadgeMeta> = {
    draft: { tone: "neutral", icon: FilePen },
    scheduled: { tone: "info", icon: CalendarClock },
    sent: { tone: "success", icon: Send },
};

export function BroadcastStatusBadge({ status, size, className, locale = "en" }: { status: BroadcastStatus; size?: BadgeSize; className?: string; locale?: Locale }) {
    const meta = BROADCAST_STATUS_META[status];
    return (
        <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
            {createTranslator(locale)(`screens.admin.broadcastStatus.${status}` as MessageKey)}
        </Badge>
    );
}

export const AUDIT_STATUS_META: Record<AuditLog["status"], BadgeMeta> = {
    success: { tone: "success", icon: CircleCheck },
    failure: { tone: "danger", icon: CircleX },
};

/** Icon + label for an audit entry result. `compact` renders an inline icon and text instead of a badge. */
export function AuditStatus({ status, compact = false, className, locale = "en" }: { status: AuditLog["status"]; compact?: boolean; className?: string; locale?: Locale }) {
    const meta = AUDIT_STATUS_META[status];
    const label = auditStatusLabel(createTranslator(locale), status);
    if (!compact) {
        return (
            <Badge tone={meta.tone} icon={meta.icon} size="sm" className={className}>
                {label}
            </Badge>
        );
    }
    const Icon = meta.icon;
    return (
        <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", TONE_TEXT[meta.tone], className)}>
            <Icon aria-hidden className="size-3.5" />
            {label}
        </span>
    );
}

/** Marks permissions that expose clinical data. */
export function ClinicalDataBadge({ size = "sm", className, locale = "en" }: { size?: BadgeSize; className?: string; locale?: Locale }) {
    return (
        <Badge tone="warning" variant="outline" icon={ShieldAlert} size={size} className={className}>
            {createTranslator(locale)("screens.admin.clinicalData")}
        </Badge>
    );
}

export const CHANNEL_ICONS: Record<BroadcastChannel, LucideIcon> = {
    in_app: Bell,
    email: Mail,
    in_app_email: MailPlus,
};

export function ChannelLabel({ channel, className, locale = "en" }: { channel: BroadcastChannel; className?: string; locale?: Locale }) {
    const Icon = CHANNEL_ICONS[channel];
    return (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-fg", className)}>
            <Icon aria-hidden className="size-4 text-fg-subtle" />
            {broadcastChannelLabel(createTranslator(locale), channel)}
        </span>
    );
}
