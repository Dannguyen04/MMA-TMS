import { createDemoCopy } from "@/lib/i18n/demo-copy";
import type { Locale } from "@/lib/i18n/config";
import { Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/format";
import { sum } from "@/lib/utils";
import { rpeLabel, sessionMinutes } from "./training-utils";

export interface WeekSummaryProps {
    locale?: Locale;
    sessions: TrainingSession[];
    title?: string;
    description?: string;
    children?: ReactNode;
}

/** Totals for the visible week: sessions, completed, planned time and peak intensity. */
export function WeekSummary({ sessions, title = "Week at a glance", description, children, locale = "en" }: WeekSummaryProps) {
    const copy = createDemoCopy(locale);
    const planned = sessions.filter((s) => s.status !== "cancelled");
    const completed = planned.filter((s) => s.status === "completed");
    const cancelled = sessions.length - planned.length;
    const minutes = sum(planned.map(sessionMinutes));
    const peak = planned.reduce((max, s) => Math.max(max, s.targetRpe ?? 0), 0);

    return (
        <Card>
            <CardHeader title={copy(title)} description={description} icon={<Gauge />} />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <MetricTile label={copy("Sessions")} value={planned.length} hint={cancelled > 0 ? copy("{n} cancelled", { n: cancelled }) : undefined} />
                    <MetricTile label={copy("Completed")} value={`${completed.length}/${planned.length}`} />
                    <MetricTile label={copy("Training time")} value={locale === "vi" ? copy("{n} minutes", { n: minutes }) : formatMinutes(minutes)} />
                    <MetricTile label={copy("Peak target")} value={peak > 0 ? `RPE ${peak}` : "—"} hint={peak > 0 ? copy(rpeLabel(peak)) : undefined} />
                </div>
                {children}
            </CardContent>
        </Card>
    );
}
