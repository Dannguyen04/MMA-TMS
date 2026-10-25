import { Ban, Gauge, ShieldAlert, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/ui/tone";
import type { RestrictionSeverity } from "@/lib/domain/clearance-rules";
export const RESTRICTION_SEVERITY_META: Record<RestrictionSeverity, { icon: LucideIcon; tone: Tone }> = {
    block: { icon: Ban, tone: "danger" },
    limit: { icon: Gauge, tone: "warning" },
    warn: { icon: ShieldAlert, tone: "warning" },
};
