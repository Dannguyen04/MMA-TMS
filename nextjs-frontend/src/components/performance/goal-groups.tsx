import type { ReactNode } from "react";

import { GoalCard } from "@/components/domain/goal-card";
import type { Goal } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import { GoalActions } from "./goal-actions";
import { GoalTrend } from "./goal-trend";

interface GoalGroup {
    id: string;
    title: string;
    description: string;
    goals: Goal[];
}

export interface GoalGroupsProps {
    /** Goals in urgency order (as returned by `listGoals`). */
    goals: Goal[];
    /** Server time (ISO). */
    now: string;
    /** Level of the group headings; goal cards use h3. */
    heading: "h2" | "h3";
    /** When set, each card gets coach controls (log progress, edit, delete). */
    manage?: { fighterName: string };
    /** Shown in the Active group when nothing is in progress. */
    noActiveText?: ReactNode;
}

/** Goals split into Active (at risk first), Achieved and Missed, each as a card grid. */
export function GoalGroups({ goals, now, heading: Heading, manage, noActiveText = "No goals in progress right now." }: GoalGroupsProps) {
    const groups: GoalGroup[] = [
        {
            id: "active",
            title: "Active",
            description: "In progress · at-risk goals first",
            goals: goals.filter((goal) => goal.status === "at_risk" || goal.status === "on_track"),
        },
        { id: "achieved", title: "Achieved", description: "Target reached", goals: goals.filter((goal) => goal.status === "achieved") },
        {
            id: "missed",
            title: "Missed",
            description: "Due date passed before the target was reached",
            goals: goals.filter((goal) => goal.status === "missed"),
        },
    ];

    return (
        <div className="flex flex-col gap-8">
            {groups
                .filter((group) => group.id === "active" || group.goals.length > 0)
                .map((group) => {
                    const headingId = `goals-${group.id}-heading`;
                    return (
                        <section key={group.id} aria-labelledby={headingId} className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <Heading id={headingId} className="text-base font-semibold text-fg">
                                    {group.title}
                                    <span className="ml-2 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-fg-muted tabular-nums">
                                        <span className="sr-only">(</span>
                                        {formatNumber(group.goals.length)}
                                        <span className="sr-only">)</span>
                                    </span>
                                </Heading>
                                <p className="text-[13px] text-fg-subtle">{group.description}</p>
                            </div>
                            {group.goals.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-fg-muted">{noActiveText}</p>
                            ) : (
                                <ul className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {group.goals.map((goal) => (
                                        <li key={goal.id} className="min-w-0">
                                            <GoalCard goal={goal} now={now} headingLevel={3}>
                                                <div className="flex flex-col gap-3">
                                                    <GoalTrend goal={goal} now={now} />
                                                    {manage && (
                                                        <GoalActions goal={goal} fighterName={manage.fighterName} now={now} className="border-t border-border pt-3" />
                                                    )}
                                                </div>
                                            </GoalCard>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
        </div>
    );
}
