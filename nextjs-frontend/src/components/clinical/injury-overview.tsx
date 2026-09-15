import { Activity, CircleCheck, RefreshCw } from "lucide-react";
import Link from "next/link";

import { BodyMap, type BodyMapHighlight } from "@/components/domain/body-map";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { INJURY_STATUS_META, InjuryStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { TONE_SOLID } from "@/components/ui/tone";
import { BODY_REGION_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, Fighter, Injury } from "@/lib/domain/types";
import { daysBetween, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const POSTERIOR_REGIONS: BodyRegion[] = ["lower_back", "left_hamstring", "right_hamstring"];
const RESOLVED_WINDOW_DAYS = 90;

export interface InjuryOverviewProps {
    /** Every injury of the doctor's assigned fighters, unfiltered. */
    injuries: Injury[];
    fightersById: Map<string, Fighter>;
    /** Server time (ISO). */
    now: string;
    /** Link builder for the status stat cards (applies a status filter to the list). */
    statusHref: (status: Injury["status"]) => string;
}

/** Caseload at a glance: open and recently resolved counts, plus every open injury on one body map. */
export function InjuryOverview({ injuries, fightersById, now, statusHref }: InjuryOverviewProps) {
    const open = injuries.filter((injury) => injury.status !== "resolved");
    const active = open.filter((injury) => injury.status === "active");
    const recovering = open.filter((injury) => injury.status === "recovering");
    const resolvedRecently = injuries.filter(
        (injury) => injury.status === "resolved" && injury.resolvedAt !== null && daysBetween(injury.resolvedAt, now) <= RESOLVED_WINDOW_DAYS,
    );

    const highlights: BodyMapHighlight[] = open.map((injury) => ({
        region: injury.bodyRegion,
        tone: INJURY_STATUS_META[injury.status].tone,
        label: `${fightersById.get(injury.fighterId)?.name ?? "Fighter"} · ${INJURY_TYPE_LABELS[injury.type]}`,
    }));
    const hasPosterior = open.some((injury) => POSTERIOR_REGIONS.includes(injury.bodyRegion));

    return (
        <section aria-label="Injury caseload" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <StatCard label="Active" value={active.length} icon={<Activity />} hint="Acute, under treatment" href={statusHref("active")}>
                    <FighterStack injuries={active} fightersById={fightersById} />
                </StatCard>
                <StatCard
                    label="Recovering"
                    value={recovering.length}
                    icon={<RefreshCw />}
                    hint="Returning to training"
                    href={statusHref("recovering")}
                >
                    <FighterStack injuries={recovering} fightersById={fightersById} />
                </StatCard>
                <StatCard
                    label={`Resolved · last ${RESOLVED_WINDOW_DAYS} days`}
                    value={resolvedRecently.length}
                    icon={<CircleCheck />}
                    hint={resolvedRecently.length === 0 ? "None resolved recently" : "Closed injury records"}
                    href={statusHref("resolved")}
                >
                    <FighterStack injuries={resolvedRecently} fightersById={fightersById} />
                </StatCard>
            </div>

            <Card className="min-w-0 lg:col-span-2">
                <CardHeader
                    title="Open injuries on the body map"
                    description={
                        open.length === 0
                            ? "No active or recovering injuries across your fighters"
                            : `${pluralize(open.length, "open injury", "open injuries")} across ${pluralize(new Set(open.map((i) => i.fighterId)).size, "fighter")}`
                    }
                />
                <div className="flex flex-col items-center gap-6 px-5 pb-5 sm:flex-row sm:items-start">
                    <BodyMap highlights={highlights} size="md" showLegend={false} className="shrink-0" />
                    <div className="w-full min-w-0 flex-1">
                        {open.length === 0 ? (
                            <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                Every injury on record is resolved. New injuries you record appear here with a numbered marker.
                            </p>
                        ) : (
                            <ol aria-label="Open injuries, numbered as on the body map" className="flex flex-col divide-y divide-border">
                                {open.map((injury, index) => (
                                    <OpenInjuryItem
                                        key={injury.id}
                                        injury={injury}
                                        number={index + 1}
                                        fighter={fightersById.get(injury.fighterId)}
                                        now={now}
                                    />
                                ))}
                            </ol>
                        )}
                        {hasPosterior && <p className="mt-3 text-xs text-fg-subtle">Dashed rings mark areas on the back of the body.</p>}
                    </div>
                </div>
            </Card>
        </section>
    );
}

const STACK_LIMIT = 4;

/** Octagon avatars of the fighters behind a count, with their names for assistive technology. */
function FighterStack({ injuries, fightersById }: { injuries: Injury[]; fightersById: Map<string, Fighter> }) {
    const names = [...new Set(injuries.map((injury) => fightersById.get(injury.fighterId)?.name).filter((name): name is string => Boolean(name)))];
    if (names.length === 0) return null;
    const shown = names.slice(0, STACK_LIMIT);
    return (
        <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="flex shrink-0 -space-x-1.5">
                {shown.map((name) => (
                    <Avatar key={name} name={name} shape="octagon" size="xs" />
                ))}
            </span>
            <span className="truncate text-[13px] text-fg-muted">
                {names.length > STACK_LIMIT ? `${shown.join(", ")} +${names.length - STACK_LIMIT}` : names.join(", ")}
            </span>
        </div>
    );
}

function OpenInjuryItem({ injury, number, fighter, now }: { injury: Injury; number: number; fighter: Fighter | undefined; now: string }) {
    const days = injury.expectedReturnAt ? daysBetween(now, injury.expectedReturnAt) : null;
    return (
        <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    // TONE_SOLID pairs each fill with a readable number colour (dark on warning).
                    TONE_SOLID[INJURY_STATUS_META[injury.status].tone],
                )}
            >
                {number}
            </span>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={routes.doctor.injury(injury.id)} className="text-sm font-semibold text-fg hover:underline">
                        <span className="sr-only">{number}. </span>
                        {fighter?.name ?? "Fighter"}
                    </Link>
                    <InjuryStatusBadge status={injury.status} size="sm" />
                </p>
                <p className="mt-0.5 text-[13px] text-fg-muted">
                    {INJURY_TYPE_LABELS[injury.type]} · {BODY_REGION_LABELS[injury.bodyRegion]}
                    {days !== null && (
                        <span className="text-fg-subtle">
                            {" "}
                            · {days >= 0 ? `return ${describeDaysUntil(days)}` : `target passed ${describeDaysUntil(days)}`}
                        </span>
                    )}
                </p>
            </div>
        </li>
    );
}
