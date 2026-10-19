import { ChevronRight, Scale } from "lucide-react";
import Link from "next/link";

import { CardLink } from "@/components/dashboard/card-link";
import { WeightWarningBadge } from "@/components/domain/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Bout } from "@/lib/domain/types";
import { formatNumber, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Running bouts whose weight needs a look, most urgent first (`weightAlerts`). Hidden when there are none. */
export function WeightAlertsCard({ alerts, fighterNames }: { alerts: Bout[]; fighterNames: Map<string, string> }) {
    if (alerts.length === 0) return null;

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Weight alerts"
                icon={<Scale aria-hidden />}
                action={<CardLink href={routes.coach.bouts}>All bouts</CardLink>}
            />
            <CardContent className="px-0 pb-2">
                <ul className="flex flex-col">
                    {alerts.map((bout) => (
                        <li key={bout.id}>
                            <Link
                                href={routes.coach.bout(bout.id)}
                                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-hover focus-visible:bg-surface-hover"
                            >
                                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                    <p className="max-w-full truncate text-sm font-medium text-fg">{fighterNames.get(bout.fighterId) ?? "Fighter"}</p>
                                    <WeightWarningBadge status={bout.weight?.status ?? "GREY"} size="sm" />
                                    <p className="text-xs text-fg-muted">{summary(bout)}</p>
                                </div>
                                <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function summary(bout: Bout): string {
    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;
    const latest = bout.weight?.latestKg;
    const weight = latest != null ? `${formatNumber(latest, 1)} / ${formatNumber(limitKg, 1)} kg` : `limit ${formatNumber(limitKg, 1)} kg`;
    const days = bout.daysToWeighIn;
    const when = days === undefined ? null : days > 0 ? `weigh-in in ${pluralize(days, "day")}` : days === 0 ? "weigh-in today" : null;
    return [bout.eventName, weight, when].filter(Boolean).join(" · ");
}
