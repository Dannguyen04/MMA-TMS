import {
    Bot,
    CalendarDays,
    HeartPulse,
    MessageSquare,
    Radar,
    Settings,
    ShieldCheck,
    Target,
    type LucideIcon,
} from "lucide-react";

import type { Tone } from "@/components/ui/tone";
import type { NotificationCategory, NotificationSeverity } from "@/lib/domain/types";

export const NOTIFICATION_CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
    training: CalendarDays,
    ai_analysis: Bot,
    ai_alert: Radar,
    feedback: MessageSquare,
    medical: HeartPulse,
    clearance: ShieldCheck,
    goal: Target,
    system: Settings,
};

export const NOTIFICATION_SEVERITY_TONE: Record<NotificationSeverity, Tone> = {
    info: "neutral",
    success: "success",
    warning: "warning",
    danger: "danger",
};
