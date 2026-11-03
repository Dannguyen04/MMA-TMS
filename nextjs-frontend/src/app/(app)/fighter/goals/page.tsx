import { ChartLine, Info, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GoalGroups } from "@/components/performance/goal-groups";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listGoals } from "@/lib/services/goals";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.performance.goals") };
}

export default async function FighterGoalsPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("goals")) {
        return (
            <>
                <PageHeader title={t("screens.performance.goals")} />
                <FeatureUnavailable service="training" title={t("screens.performance.goalsUnavailable")} description={t("screens.performance.unavailableDesc")} />
            </>
        );
    }
    const goals = await listGoals({ fighterIds: [fighterId] });
    const now = new Date().toISOString();
    const active = goals.filter((goal) => goal.status === "on_track" || goal.status === "at_risk");
    const atRisk = active.filter((goal) => goal.status === "at_risk").length;

    return (
        <>
            <PageHeader
                title={t("screens.performance.goals")}
                description={
                    goals.length === 0
                        ? t("screens.performance.fighterGoals.emptyIntro")
                        : `${plural(t, "screens.performance.goalsInProgress", active.length)}${atRisk > 0 ? t("screens.performance.fighterGoals.atRisk", { n: atRisk }) : ""}. ${t("screens.performance.fighterGoals.updates")}`
                }
                meta={
                    <p className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
                        <Info aria-hidden className="size-3.5" />
                        {t("screens.performance.fighterGoals.managed")}
                    </p>
                }
            />
            {goals.length === 0 ? (
                <EmptyState
                    icon={<Target />}
                    title={t("screens.performance.fighterGoals.emptyTitle")}
                    description={t("screens.performance.fighterGoals.emptyDesc")}
                    action={
                        <ButtonLink href={routes.fighter.performance} variant="secondary">
                            <ChartLine aria-hidden />
                            {t("screens.performance.fighterGoals.review")}
                        </ButtonLink>
                    }
                />
            ) : (
                <GoalGroups goals={goals} now={now} heading="h2" noActiveText={t("screens.performance.fighterGoals.noActive")} locale={locale} />
            )}
        </>
    );
}
