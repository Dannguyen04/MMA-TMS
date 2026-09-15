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
import { AI_MODEL_STATUS_LABELS, BROADCAST_CHANNEL_LABELS, BROADCAST_STATUS_LABELS } from "@/lib/domain/labels";
import type { AIModelStatus, AuditLog, BroadcastChannel, BroadcastStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Status presentation for admin-only entities (model lifecycle, broadcasts, audit results).
 * Same contract as components/domain/status-badges: label + icon + tone, never colour alone.
 */

type BadgeSize = "sm" | "md";

export const MODEL_STATUS_META: Record<AIModelStatus, StatusMeta> = {
    active: { label: AI_MODEL_STATUS_LABELS.active, tone: "success", icon: CircleCheck },
    staging: { label: AI_MODEL_STATUS_LABELS.staging, tone: "info", icon: FlaskConical },
    deprecated: { label: AI_MODEL_STATUS_LABELS.deprecated, tone: "neutral", icon: Archive },
};

export function ModelStatusBadge({ status, size, className }: { status: AIModelStatus; size?: BadgeSize; className?: string }) {
    const meta = MODEL_STATUS_META[status];
    return (
        <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
            {meta.label}
        </Badge>
    );
}

export const BROADCAST_STATUS_META: Record<BroadcastStatus, StatusMeta> = {
    draft: { label: BROADCAST_STATUS_LABELS.draft, tone: "neutral", icon: FilePen },
    scheduled: { label: BROADCAST_STATUS_LABELS.scheduled, tone: "info", icon: CalendarClock },
    sent: { label: BROADCAST_STATUS_LABELS.sent, tone: "success", icon: Send },
};

export function BroadcastStatusBadge({ status, size, className }: { status: BroadcastStatus; size?: BadgeSize; className?: string }) {
    const meta = BROADCAST_STATUS_META[status];
    return (
        <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
            {meta.label}
        </Badge>
    );
}

export const AUDIT_STATUS_META: Record<AuditLog["status"], StatusMeta> = {
    success: { label: "Success", tone: "success", icon: CircleCheck },
    failure: { label: "Failed", tone: "danger", icon: CircleX },
};

/** Icon + label for an audit entry result. `compact` renders an inline icon and text instead of a badge. */
export function AuditStatus({ status, compact = false, className }: { status: AuditLog["status"]; compact?: boolean; className?: string }) {
    const meta = AUDIT_STATUS_META[status];
    if (!compact) {
        return (
            <Badge tone={meta.tone} icon={meta.icon} size="sm" className={className}>
                {meta.label}
            </Badge>
        );
    }
    const Icon = meta.icon;
    return (
        <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", TONE_TEXT[meta.tone], className)}>
            <Icon aria-hidden className="size-3.5" />
            {meta.label}
        </span>
    );
}

/** Marks permissions that expose clinical data. */
export function ClinicalDataBadge({ size = "sm", className }: { size?: BadgeSize; className?: string }) {
    return (
        <Badge tone="warning" variant="outline" icon={ShieldAlert} size={size} className={className}>
            Clinical data
        </Badge>
    );
}

export const CHANNEL_ICONS: Record<BroadcastChannel, LucideIcon> = {
    in_app: Bell,
    email: Mail,
    in_app_email: MailPlus,
};

export function ChannelLabel({ channel, className }: { channel: BroadcastChannel; className?: string }) {
    const Icon = CHANNEL_ICONS[channel];
    return (
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-fg", className)}>
            <Icon aria-hidden className="size-4 text-fg-subtle" />
            {BROADCAST_CHANNEL_LABELS[channel]}
        </span>
    );
}
