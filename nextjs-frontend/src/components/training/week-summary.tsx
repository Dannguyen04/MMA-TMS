import type { Locale } from "@/lib/i18n/config";
import { Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes } from "@/lib/format";
import { createTranslator, plural, type MessageKey } from "@/lib/i18n";
import { sum } from "@/lib/utils";
import { sessionMinutes } from "./training-utils";

export interface WeekSummaryProps {
    locale?: Locale;
    sessions: TrainingSession[];
    title?: string;
    description?: string;
    children?: ReactNode;
}

/** Totals for the visible week: sessions, completed, planned time and peak intensity. */
export function WeekSummary({ sessions, title, description, children, locale = "en" }: WeekSummaryProps) {
    const t = createTranslator(locale);
    const planned = sessions.filter((s) => s.status !== "cancelled");
    const completed = planned.filter((s) => s.status === "completed");
    const cancelled = sessions.length - planned.length;
    const minutes = sum(planned.map(sessionMinutes));
    const peak = planned.reduce((max, s) => Math.max(max, s.targetRpe ?? 0), 0);
    const heading = title ?? t("training.weekSummary.title");

    return (
        <Card>
            <CardHeader title={heading} description={description} icon={<Gauge />} />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <MetricTile
                        label={t("training.weekSummary.sessions")}
                        value={planned.length}
                        hint={cancelled > 0 ? plural(t, "training.weekSummary.cancelledCount", cancelled) : undefined}
                    />
                    <MetricTile label={t("training.weekSummary.completed")} value={`${completed.length}/${planned.length}`} />
                    <MetricTile
                        label={t("training.weekSummary.trainingTime")}
                        value={locale === "vi" ? `${minutes} phút` : formatMinutes(minutes)}
                    />
                    <MetricTile
                        label={t("training.weekSummary.peakTarget")}
                        value={peak > 0 ? `RPE ${peak}` : "—"}
                        hint={peak > 0 ? t(`rpe.${peak}` as MessageKey) : undefined}
                    />
                </div>
                {children}
            </CardContent>
        </Card>
    );
}
