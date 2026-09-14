import { ChartLine, Info, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GoalGroups } from "@/components/performance/goal-groups";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listGoals } from "@/lib/services/goals";

export const metadata: Metadata = { title: "Goals" };

export default async function FighterGoalsPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = requireFighterAccess(user, user.profileId);
    const goals = await listGoals({ fighterIds: [fighter.id] });
    const now = new Date().toISOString();
    const active = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = active.filter((goal) => goal.status === "at_risk").length;

    return (
        <>
            <PageHeader
                title="Goals"
                description={
                    goals.length === 0
                        ? "Measurable targets your coaches set with you."
                        : `${pluralize(active.length, "goal")} in progress${atRisk > 0 ? `, ${atRisk} at risk` : ""}. Progress updates each time your coach logs a new measurement.`
                }
                meta={
                    <p className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
                        <Info aria-hidden className="size-3.5" />
                        Goals are managed by your coaches — talk to them to adjust a target or due date.
                    </p>
                }
                actions={
                    <ButtonLink href={routes.fighter.performance} variant="secondary">
                        <ChartLine aria-hidden />
                        Performance
                    </ButtonLink>
                }
            />
            {goals.length === 0 ? (
                <EmptyState
                    icon={<Target />}
                    title="No goals yet"
                    description="Your coaches set goals from your training and video analysis. Ask them about a target you'd like to work towards."
                    action={
                        <ButtonLink href={routes.fighter.performance} variant="secondary">
                            <ChartLine aria-hidden />
                            Review your performance
                        </ButtonLink>
                    }
                />
            ) : (
                <GoalGroups goals={goals} now={now} heading="h2" noActiveText="No goals in progress right now — your coaches will set the next one." />
            )}
        </>
    );
}
