import { Scale, TriangleAlert, CircleCheck, Clock } from "lucide-react";

import { WeightWarningBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Bout } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";

export function BoutWeightCard({ bout }: { bout: Bout }) {
    const weight = bout.weight;
    const latestKg = weight?.latestKg ?? null;
    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;
    const status = weight?.status ?? "GREY";
    const remainingPct = weight?.remainingPct ?? null;
    const kgToCut = latestKg !== null ? Math.max(0, latestKg - limitKg).toFixed(1) : null;

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Weight tracking"
                description="Daily weigh-in progress and acute weight cut safety monitoring."
                icon={<Scale aria-hidden />}
                action={<WeightWarningBadge status={status} />}
            />
            <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="flex flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Latest weight</span>
                        <span className="text-xl font-bold tabular-nums text-fg">
                            {latestKg !== null ? `${latestKg} kg` : "—"}
                        </span>
                        <span className="text-[11px] text-fg-subtle">
                            {weight?.latestOn ? `Recorded ${formatDate(weight.latestOn)}` : "No weigh-ins yet"}
                        </span>
                    </div>

                    <div className="flex flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Target limit</span>
                        <span className="text-xl font-bold tabular-nums text-fg">
                            {limitKg} kg
                        </span>
                        <span className="text-[11px] text-fg-subtle">
                            {bout.catchweightKg ? "Catchweight" : "Category limit"}
                        </span>
                    </div>

                    <div className="flex flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Remaining cut</span>
                        <span className="text-xl font-bold tabular-nums text-fg">
                            {remainingPct !== null ? `${remainingPct}%` : "—"}
                        </span>
                        <span className="text-[11px] text-fg-subtle">
                            {kgToCut !== null ? `${kgToCut} kg remaining` : "—"}
                        </span>
                    </div>

                    <div className="flex flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Days to weigh-in</span>
                        <span className="text-xl font-bold tabular-nums text-fg">
                            {bout.daysToWeighIn !== undefined ? `${bout.daysToWeighIn}d` : "—"}
                        </span>
                        <span className="text-[11px] text-fg-subtle">
                            Weigh-in {formatDate(bout.weighInAt)}
                        </span>
                    </div>
                </div>

                {status === "RED" && (
                    <Callout
                        tone="danger"
                        icon={TriangleAlert}
                        title="Dangerous acute weight cut risk"
                    >
                        Fighter&apos;s remaining weight cut exceeds safe acute limits for the time remaining.
                        Consult with medical staff immediately and consider changing weight class or catching weight.
                    </Callout>
                )}

                {status === "YELLOW" && (
                    <Callout
                        tone="warning"
                        icon={TriangleAlert}
                        title="Tracking above reference curve"
                    >
                        Weight is higher than the reference cut trajectory by more than the allowed tolerance.
                        Monitor training sessions and hydration closely.
                    </Callout>
                )}

                {status === "GREY" && (
                    <Callout
                        tone="neutral"
                        icon={Clock}
                        title="No recent weigh-in data"
                    >
                        No weight has been recorded in the last 3 days. Remind the fighter to log daily morning weigh-ins.
                    </Callout>
                )}

                {status === "GREEN" && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        title="On track"
                    >
                        Weight cut is progressing safely within safe limits along the reference curve.
                    </Callout>
                )}
            </CardContent>
        </Card>
    );
}
