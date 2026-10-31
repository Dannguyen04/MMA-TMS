"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { CalendarRange } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { PlanDates, PlanTimelineBar } from "@/components/domain/plan-schedule";
import { PlanStatusBadge } from "@/components/domain/status-badges";
import { TechniqueChips } from "@/components/domain/technique-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { trainingPhaseLabel } from "@/lib/domain/labels";
import type { TrainingPlan } from "@/lib/domain/types";
import { daysBetween, formatPercent } from "@/lib/format";
import { plural } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { PlanAdherence } from "./training-utils";

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
    const t = useT();
    const locale = useLocale();
    const weeks = plan.endDate === null ? null : Math.max(1, Math.ceil(daysBetween(plan.startDate, plan.endDate) / 7));

    return (
        <Card className={cn("overflow-hidden", className)}>
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8">
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <PlanStatusBadge locale={locale} status={plan.status} />
                        <Badge variant="outline">{trainingPhaseLabel(t, plan.phase)}</Badge>
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
                        <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t("training.plan.objective")} </p>
                        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-pretty text-fg">{plan.objective}</p>
                    </div>
                    {plan.focusAreas.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t("training.plan.focusAreas")} </p>
                            <TechniqueChips techniques={plan.focusAreas} label={t("training.plan.focusAreas")} />
                        </div>
                    )}
                    {showNotes && (
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{t("training.plan.coachNotes")} </p>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-pretty whitespace-pre-line text-fg-muted">
                                {plan.notes || t("training.plan.noNotes")}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface-muted/70 p-4">
                    <div>
                        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
                            <CalendarRange aria-hidden className="size-3.5 text-fg-subtle" />
                            <span>
                                <PlanDates plan={plan} />
                            </span>
                        </p>
                        <PlanTimelineBar plan={plan} now={now} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {plan.weeklySessionTarget !== null && (
                            <div className="min-w-0">
                                <dt className="text-[13px] text-fg-muted">{t("training.plan.weeklyTarget")} </dt>
                                <dd className="mt-0.5 font-semibold text-fg">{plural(t, "training.planCard.sessionsTarget", plan.weeklySessionTarget)}</dd>
                            </div>
                        )}
                        <div className="min-w-0">
                            <dt className="text-[13px] text-fg-muted">{t("training.plan.adherenceSoFar")} </dt>
                            <dd className="mt-0.5 font-semibold text-fg">
                                {adherence ? formatPercent(adherence.pct) : "—"}
                                <span className="block text-xs font-normal text-fg-muted">
                                    {adherence ? t("training.plan.dueSessions", { completed: adherence.completed, due: adherence.due }) : t("training.plan.nothingDueYet")}
                                </span>
                            </dd>
                        </div>
                        {weeks !== null && (
                            <div className="min-w-0">
                                <dt className="text-[13px] text-fg-muted">{t("training.plan.length")} </dt>
                                <dd className="mt-0.5 font-semibold text-fg">{plural(t, "training.plan.weeksCount", weeks)}</dd>
                            </div>
                        )}
                        {coachName && (
                            <div className="min-w-0">
                                <dt className="text-[13px] text-fg-muted">{t("training.plan.coach")} </dt>
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
