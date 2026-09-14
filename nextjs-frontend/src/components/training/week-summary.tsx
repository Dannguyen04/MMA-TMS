import { Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/format";
import { sum } from "@/lib/utils";
import { rpeLabel } from "./training-utils";

export interface WeekSummaryProps {
    sessions: TrainingSession[];
    title?: string;
    description?: string;
    children?: ReactNode;
}

/** Totals for the visible week: sessions, completed, planned time and peak intensity. */
export function WeekSummary({ sessions, title = "Week at a glance", description, children }: WeekSummaryProps) {
    const planned = sessions.filter((s) => s.status !== "cancelled");
    const completed = planned.filter((s) => s.status === "completed");
    const cancelled = sessions.length - planned.length;
    const minutes = sum(planned.map((s) => s.result?.actualDurationMin ?? s.durationMin));
    const peak = planned.reduce((max, s) => Math.max(max, s.targetRpe), 0);

    return (
        <Card>
            <CardHeader title={title} description={description} icon={<Gauge />} />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <MetricTile label="Sessions" value={planned.length} hint={cancelled > 0 ? `${cancelled} cancelled` : undefined} />
                    <MetricTile label="Completed" value={`${completed.length}/${planned.length}`} />
                    <MetricTile label="Training time" value={formatMinutes(minutes)} />
                    <MetricTile label="Peak target" value={peak > 0 ? `RPE ${peak}` : "—"} hint={peak > 0 ? rpeLabel(peak) : undefined} />
                </div>
                {children}
            </CardContent>
        </Card>
    );
}
