import { Target } from "lucide-react";
import type { Metadata } from "next";

import { GoalGroups } from "@/components/performance/goal-groups";
import { NewGoalButton } from "@/components/performance/new-goal-button";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { pluralize } from "@/lib/format";
import { listGoals } from "@/lib/services/goals";

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]/goals">): Promise<Metadata> {
    const user = await requireRole("coach");
    const fighter = requireFighterAccess(user, (await params).fighterId);
    return { title: `Goals · ${fighter.name}` };
}

export default async function CoachFighterGoalsPage({ params }: PageProps<"/coach/fighters/[fighterId]/goals">) {
    const user = await requireRole("coach");
    const fighter = requireFighterAccess(user, (await params).fighterId);
    const goals = await listGoals({ fighterIds: [fighter.id] });
    const now = new Date().toISOString();
    const firstName = fighter.name.split(" ")[0];
    const active = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = active.filter((goal) => goal.status === "at_risk").length;
    const fighterOption = { id: fighter.id, name: fighter.name };

    return (
        <section aria-labelledby="goals-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 id="goals-heading" className="text-lg font-semibold text-fg">
                        Goals
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        {goals.length === 0
                            ? `Set measurable targets for ${firstName} and log progress as you measure it.`
                            : `${pluralize(active.length, "goal")} in progress${atRisk > 0 ? ` · ${atRisk} at risk` : ""}. ${firstName} sees these goals and every check-in.`}
                    </p>
                </div>
                {goals.length > 0 && <NewGoalButton now={now} fighter={fighterOption} />}
            </div>

            {goals.length === 0 ? (
                <EmptyState
                    icon={<Target />}
                    title={`No goals for ${firstName} yet`}
                    description="Goals turn feedback into a measurable target with a due date. Start from the focus area on the Performance tab."
                    action={<NewGoalButton now={now} fighter={fighterOption} />}
                />
            ) : (
                <GoalGroups goals={goals} now={now} heading="h3" manage={{ fighterName: fighter.name }} />
            )}
        </section>
    );
}
