import { Target } from "lucide-react";
import type { Metadata } from "next";

import { GoalGroups } from "@/components/performance/goal-groups";
import { NewGoalButton } from "@/components/performance/new-goal-button";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { listGoals } from "@/lib/services/goals";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export async function generateMetadata({ params }: PageProps<"/coach/fighters/[fighterId]/goals">): Promise<Metadata> {
    const user = await requireRole("coach");
    const [fighter, { t }] = await Promise.all([requireFighterAccess(user, (await params).fighterId), getTranslator()]);
    return { title: t("screens.performance.fighterTab.goalsMeta", { name: fighter.name }) };
}

export default async function CoachFighterGoalsPage({ params }: PageProps<"/coach/fighters/[fighterId]/goals">) {
    const user = await requireRole("coach");
    const [fighter, { t, locale }] = await Promise.all([requireFighterAccess(user, (await params).fighterId), getTranslator()]);
    if (!platformFeatureAvailable("goals")) {
        return <FeatureUnavailable service="training" title={t("screens.performance.goalsUnavailable")} description={t("screens.performance.unavailableDesc")} />;
    }
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
                        {t("screens.performance.goals")}
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-muted">
                        {goals.length === 0
                            ? t("screens.performance.fighterTab.goalsEmptyIntro", { name: firstName })
                            : `${plural(t, "screens.performance.goalsInProgress", active.length)}${atRisk > 0 ? t("screens.performance.fighterTab.atRisk", { n: atRisk }) : ""}. ${t("screens.performance.fighterTab.sees", { name: firstName })}`}
                    </p>
                </div>
                {goals.length > 0 && <NewGoalButton now={now} fighter={fighterOption} />}
            </div>

            {goals.length === 0 ? (
                <EmptyState
                    icon={<Target />}
                    title={t("screens.performance.fighterTab.goalsEmptyTitle", { name: firstName })}
                    description={t("screens.performance.fighterTab.goalsEmptyDesc")}
                    action={<NewGoalButton now={now} fighter={fighterOption} />}
                />
            ) : (
                <GoalGroups goals={goals} now={now} heading="h3" manage={{ fighterName: fighter.name }} locale={locale} />
            )}
        </section>
    );
}
