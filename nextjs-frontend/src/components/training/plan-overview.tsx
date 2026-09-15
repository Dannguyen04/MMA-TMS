import { CalendarRange } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { PlanStatusBadge } from "@/components/domain/status-badges";
import { TechniqueChips } from "@/components/domain/technique-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
import type { TrainingPlan } from "@/lib/domain/types";
import { daysBetween, formatDate, formatPercent, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { planTimeline, type PlanAdherence } from "./training-utils";

export interface PlanOverviewProps {
    plan: TrainingPlan;
    now: string;
    coachName?: string;
    /** Staff views: whose plan it is. */
    fighter?: FighterIdentityData;
    fighterHref?: string;
    /** Completed out of due sessions (see `planAdherence`); null or omitted when nothing is due yet. */
    adherence?: PlanAdherence | null;
    /** Renders the plan title as an h2 link (hero use on overview pages). Omit on the plan's own page. */
    titleHref?: string;
    /** Heading level for the linked title. */
    titleAs?: "h2" | "h3";
    /** Show the coach's plan notes under the focus areas (plan detail pages). */
    showNotes?: boolean;
    /** Buttons under the key facts. */
    actions?: ReactNode;
    className?: string;
}

/** Plan hero: objective, phase, focus areas, timeline, weekly target, adherence and coach. */
export function PlanOverview({ plan, now, coachName, fighter, fighterHref, adherence, titleHref, titleAs: TitleHeading = "h2", showNotes = false, actions, className }: PlanOverviewProps) {
    const timeline = planTimeline(plan, now);
    const weeks = Math.max(1, Math.ceil(daysBetween(plan.startDate, plan.endDate) / 7));

    return (
        <Card className={cn("overflow-hidden", className)}>
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8">
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <PlanStatusBadge status={plan.status} />
                        <Badge variant="outline">{TRAINING_PHASE_LABELS[plan.phase]} phase</Badge>
                    </div>
                    {titleHref && (
                        <TitleHeading className="-mt-1 text-xl leading-snug font-semibold tracking-tight text-fg">
                            <Link href={titleHref} className="rounded-sm hover:underline">
                                {plan.title}
                            </Link>
                        </TitleHeading>
                    )}
                    {fighter && <FighterIdentity fighter={fighter} href={fighterHref} showHealth />}
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Objective</p>
                        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-pretty text-fg">{plan.objective}</p>
                    </div>
                    {plan.focusAreas.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Focus areas</p>
                            <TechniqueChips techniques={plan.focusAreas} label="Focus areas" />
                        </div>
                    )}
                    {showNotes && (
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">Coach notes</p>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-pretty whitespace-pre-line text-fg-muted">
                                {plan.notes || "No notes on this plan."}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface-muted/70 p-4">
                    <div>
                        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
                            <CalendarRange aria-hidden className="size-3.5 text-fg-subtle" />
                            <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time>
                            <span aria-hidden>–</span>
                            <span className="sr-only">to</span>
                            <time dateTime={plan.endDate}>{formatDate(plan.endDate)}</time>
                        </p>
                        <ProgressBar
                            value={timeline.elapsedPct}
                            label={`Time elapsed in ${plan.title}`}
                            valueText={timeline.text}
                            tone={plan.status === "completed" ? "success" : "primary"}
                        />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div className="min-w-0">
                            <dt className="text-[13px] text-fg-muted">Weekly target</dt>
                            <dd className="mt-0.5 font-semibold text-fg">{pluralize(plan.weeklySessionTarget, "session")}</dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-[13px] text-fg-muted">Adherence so far</dt>
                            <dd className="mt-0.5 font-semibold text-fg">
                                {adherence ? formatPercent(adherence.pct) : "—"}
                                <span className="block text-xs font-normal text-fg-muted">
                                    {adherence ? `${adherence.completed} of ${pluralize(adherence.due, "due session")}` : "Nothing due yet"}
                                </span>
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-[13px] text-fg-muted">Length</dt>
                            <dd className="mt-0.5 font-semibold text-fg">{pluralize(weeks, "week")}</dd>
                        </div>
                        {coachName && (
                            <div className="min-w-0">
                                <dt className="text-[13px] text-fg-muted">Coach</dt>
                                <dd className="mt-0.5 truncate font-semibold text-fg">{coachName}</dd>
                            </div>
                        )}
                    </dl>
                    {actions && <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div>}
                </div>
            </div>
        </Card>
    );
}
