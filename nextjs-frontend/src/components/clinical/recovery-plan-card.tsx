import { ArrowRight, Flag } from "lucide-react";
import Link from "next/link";

import { CHECK_IN_COLORS } from "@/components/charts/colors";
import { CheckInTrendTile } from "@/components/domain/check-in-charts";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { InjurySeverityBadge } from "@/components/domain/status-badges";
import { ProgressBar } from "@/components/ui/progress";
import { recoveryProgressPct } from "@/lib/domain/rules";
import type { Fighter, Injury, RecoveryPlan } from "@/lib/domain/types";
import { daysBetween, formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { RecoveryPlanStatusBadge } from "./clinical-badges";
import { injuryTitle, painLabel } from "./clinical-copy";

const TREND_POINTS = 8;

export interface RecoveryPlanCardProps {
    plan: RecoveryPlan;
    fighter: Fighter;
    injury: Injury | null;
    now: string;
    className?: string;
}

/** Active recovery plan at a glance: who, what, current phase, progress, target return and recent check-in trend. */
export function RecoveryPlanCard({ plan, fighter, injury, now, className }: RecoveryPlanCardProps) {
    const progress = recoveryProgressPct(plan);
    const currentIndex = plan.phases.findIndex((phase) => phase.status === "current");
    const current = currentIndex === -1 ? null : plan.phases[currentIndex];
    const daysToReturn = daysBetween(now, plan.targetReturnDate);
    const recent = plan.checkIns.slice(-TREND_POINTS);
    const last = recent.at(-1) ?? null;

    return (
        <article className={cn("flex h-full flex-col rounded-xl border border-border bg-surface shadow-card", className)}>
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <FighterIdentity fighter={fighter} size="sm" showMeta={false} showHealth />
                <RecoveryPlanStatusBadge status={plan.status} size="sm" />
            </div>

            <div className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-4">
                <div className="min-w-0">
                    <h3 className="text-[15px] leading-snug font-semibold text-pretty text-fg">
                        <Link href={routes.doctor.recoveryPlan(plan.id)} className="rounded-sm hover:underline">
                            {plan.title}
                        </Link>
                    </h3>
                    {injury && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
                            {injuryTitle(injury)}
                            <InjurySeverityBadge severity={injury.severity} size="sm" />
                        </p>
                    )}
                </div>

                <div>
                    <p className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate text-fg">
                            {current ? (
                                <>
                                    <span className="text-fg-muted">
                                        Phase {currentIndex + 1} of {plan.phases.length} ·{" "}
                                    </span>
                                    <span className="font-medium">{current.name}</span>
                                </>
                            ) : (
                                <span className="text-fg-muted">{plan.status === "completed" ? "All phases completed" : "No current phase"}</span>
                            )}
                        </span>
                        <span className="shrink-0 font-semibold text-fg tabular-nums">{progress}%</span>
                    </p>
                    <ProgressBar value={progress} hideValue size="sm" tone="info" label={`${plan.title} progress`} valueText={`${progress}%`} />
                </div>

                <p className="flex items-center gap-2 text-[13px]">
                    <Flag aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                    <span className="text-fg-muted">Target return</span>
                    <time dateTime={plan.targetReturnDate} className="font-medium text-fg">
                        {formatDate(plan.targetReturnDate)}
                    </time>
                    <span className={daysToReturn < 0 ? "font-medium text-warning-fg" : "text-fg-muted"}>
                        · {daysToReturn < 0 ? `passed ${describeDaysUntil(daysToReturn)}` : describeDaysUntil(daysToReturn)}
                    </span>
                </p>

                <div className="mt-auto flex flex-col gap-2">
                    {last ? (
                        <>
                            <p className="text-xs text-fg-muted">
                                Last check-in <time dateTime={last.date}>{formatRelative(last.date, now)}</time> · {recent.length} most recent
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <CheckInTrendTile
                                    label="Pain"
                                    value={`${last.painLevel}/10`}
                                    detail={painLabel(last.painLevel)}
                                    values={recent.map((c) => c.painLevel)}
                                    color={CHECK_IN_COLORS.pain}
                                    ariaLabel={`Pain over the last ${recent.length} check-ins, from ${recent[0].painLevel} to ${last.painLevel} out of 10`}
                                />
                                <CheckInTrendTile
                                    label="Mobility"
                                    value={`${last.mobilityPct}%`}
                                    detail="vs healthy side"
                                    values={recent.map((c) => c.mobilityPct)}
                                    color={CHECK_IN_COLORS.mobility}
                                    ariaLabel={`Mobility over the last ${recent.length} check-ins, from ${recent[0].mobilityPct}% to ${last.mobilityPct}%`}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] text-fg-muted">No check-ins logged yet.</p>
                    )}
                </div>
            </div>

            <div className="border-t border-border px-5 py-2.5">
                <Link
                    href={routes.doctor.recoveryPlan(plan.id)}
                    className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-primary-soft-fg hover:underline"
                >
                    Open plan
                    <span className="sr-only">: {plan.title}</span>
                    <ArrowRight aria-hidden className="size-3.5" />
                </Link>
            </div>
        </article>
    );
}
