import { MoveRight, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/tone";
import type { PerformanceTrend } from "@/lib/services/performance";

/** Direction of a fighter's overall score — always label + icon, never colour alone. */
export const TREND_META: Record<PerformanceTrend, { label: string; tone: Tone; icon: LucideIcon }> = {
    improving: { label: "Improving", tone: "success", icon: TrendingUp },
    steady: { label: "Steady", tone: "neutral", icon: MoveRight },
    declining: { label: "Declining", tone: "warning", icon: TrendingDown },
};

/** Sort weight for trend columns: improving first when descending. */
export const TREND_ORDER: Record<PerformanceTrend, number> = { improving: 2, steady: 1, declining: 0 };

export const PERFORMANCE_TRENDS: PerformanceTrend[] = ["improving", "steady", "declining"];

export function TrendBadge({ trend, size, className }: { trend: PerformanceTrend; size?: "sm" | "md"; className?: string }) {
    const meta = TREND_META[trend];
    return (
        <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
            {meta.label}
        </Badge>
    );
}
