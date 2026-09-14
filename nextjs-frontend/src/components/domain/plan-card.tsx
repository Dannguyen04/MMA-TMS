import { CalendarRange, Repeat, UserRound } from "lucide-react";
import Link from "next/link";

import { ProgressBar } from "@/components/ui/progress";
import { TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
import { planTimeline } from "@/lib/domain/training-plan";
import type { TrainingPlan } from "@/lib/domain/types";
import { formatDate, formatPercent, formatShortDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FighterIdentity, type FighterIdentityData } from "./fighter-identity";
import { PlanStatusBadge } from "./status-badges";
import { TechniqueChips } from "./technique-chip";

export interface PlanCardProps {
    plan: TrainingPlan;
    /** Server time (ISO) used for time elapsed. */
    now: string;
    coachName?: string;
    /** Staff lists: whose plan it is, shown beside the status. */
    fighter?: FighterIdentityData;
    /** Show the plan objective under the title (lists where plans need telling apart). */
    showObjective?: boolean;
    /** Completed share of the sessions due so far, 0–100 (see `planAdherencePct`). Omit when nothing is due. */
    adherencePct?: number;
    /** Makes the whole card a link to the plan. */
    href?: string;
    headingLevel?: 2 | 3;
    className?: string;
}

/** Training plan summary: status, phase, timeline, weekly target, focus areas and adherence. */
export function PlanCard({ plan, now, coachName, fighter, showObjective = false, adherencePct, href, headingLevel = 3, className }: PlanCardProps) {
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const timeline = planTimeline(plan, now);
    const status = <PlanStatusBadge status={plan.status} size="sm" className="shrink-0" />;

    return (
        <article
            className={cn(
                "relative flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-card",
                href && "transition-colors hover:border-border-strong hover:bg-surface-muted/40",
                className,
            )}
        >
            {fighter && (
                <div className="flex items-start justify-between gap-3">
                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                    {status}
                </div>
            )}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{TRAINING_PHASE_LABELS[plan.phase]} phase</p>
                    <Heading className="mt-0.5 text-[15px] leading-6 font-semibold text-fg">
                        {href ? (
                            <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline">
                                {plan.title}
                            </Link>
                        ) : (
                            plan.title
                        )}
                    </Heading>
                    {showObjective && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{plan.objective}</p>}
                </div>
                {!fighter && status}
            </div>

            <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[13px] text-fg-muted">
                    <CalendarRange aria-hidden className="size-3.5 text-fg-subtle" />
                    <time dateTime={plan.startDate}>{formatShortDate(plan.startDate)}</time> –{" "}
                    <time dateTime={plan.endDate}>{formatDate(plan.endDate)}</time>
                </p>
                <ProgressBar
                    value={timeline.elapsedPct}
                    label={`Time elapsed in ${plan.title}`}
                    valueText={timeline.text}
                    size="sm"
                    tone={plan.status === "completed" ? "success" : "primary"}
                />
            </div>

            <TechniqueChips techniques={plan.focusAreas} label="Focus areas" size="sm" />

            <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3 text-[13px]">
                <div className="min-w-0">
                    <dt className="text-fg-muted">Weekly target</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-fg">
                        <Repeat aria-hidden className="size-3.5 text-fg-subtle" />
                        {pluralize(plan.weeklySessionTarget, "session")}
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-fg-muted">Adherence</dt>
                    <dd className="mt-0.5 font-medium text-fg">{adherencePct === undefined ? "—" : formatPercent(adherencePct)}</dd>
                </div>
                {coachName && (
                    <div className="col-span-2 min-w-0">
                        <dt className="sr-only">Coach</dt>
                        <dd className="flex items-center gap-1.5 truncate text-fg-muted">
                            <UserRound aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                            Coach {coachName}
                        </dd>
                    </div>
                )}
            </dl>
        </article>
    );
}
