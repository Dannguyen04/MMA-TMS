import { CalendarClock, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/dashboard/card-link";
import { PlanCard } from "@/components/domain/plan-card";
import { SessionListItem } from "@/components/domain/session-list-item";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { PlanOverview } from "@/components/training/plan-overview";
import { AdherenceChart } from "@/components/training/training-charts";
import { getCoachNames } from "@/components/training/training-data";
import { planAdherence, planAdherencePct, planAdherenceWeeks, recentAdherenceWeeks } from "@/components/training/training-utils";
import { requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listPlans, listSessions } from "@/lib/services/training";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("training.fighterTraining.title") };
}

const NEXT_SESSIONS = 4;
const ADHERENCE_WEEKS = 8;

export default async function FighterTrainingPage() {
    const { t, locale } = await getTranslator();
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    const now = new Date().toISOString();

    const [plans, sessions, coachNames] = await Promise.all([
        listPlans({ fighterIds: [fighterId] }),
        listSessions({ fighterIds: [fighterId] }),
        getCoachNames(),
    ]);

    // Drafts are still being prepared by the coach, so fighters don't see them.
    const visiblePlans = plans.filter((plan) => plan.status !== "draft");
    const activePlan = visiblePlans.find((plan) => plan.status === "active");
    const otherPlans = visiblePlans.filter((plan) => plan.id !== activePlan?.id);
    const sessionsFor = (planId: string) => sessions.filter((s) => s.planId === planId);
    const nextSessions = activePlan
        ? sessionsFor(activePlan.id)
              .filter((s) => (s.status === "scheduled" || s.status === "in_progress") && s.scheduledAt >= now)
              .slice(0, NEXT_SESSIONS)
        : [];
    // With an active plan the chart covers that plan, so it reports the same adherence as the plan overview.
    const adherenceWeeks = activePlan ? planAdherenceWeeks(activePlan, sessionsFor(activePlan.id), now) : recentAdherenceWeeks(sessions, now, ADHERENCE_WEEKS);

    return (
        <>
            <PageHeader
                title={t("training.fighterTraining.title")}
                description={t("training.fighterTraining.description")}
            />

            <div className="flex flex-col gap-6">
                {activePlan ? (
                    <PlanOverview
                        plan={activePlan}
                        now={now}
                        titleHref={routes.fighter.plan(activePlan.id)}
                        coachName={coachNames[activePlan.coachId]}
                        adherence={planAdherence(sessionsFor(activePlan.id), now)}
                        actions={
                            <ButtonLink href={routes.fighter.plan(activePlan.id)} variant="secondary" className="w-full sm:w-auto">
                                <ClipboardList aria-hidden />
                                {t("training.fighterTraining.viewFullPlan")}
                            </ButtonLink>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<ClipboardList />}
                        title={t("training.fighterTraining.noActivePlanTitle")}
                        description={t("training.fighterTraining.noActivePlanDesc")}
                        action={
                            <ButtonLink href={routes.fighter.schedule} variant="secondary">
                                {t("training.fighterTraining.viewSchedule")}
                            </ButtonLink>
                        }
                    />
                )}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                    <AdherenceChart
                        weeks={adherenceWeeks}
                        description={activePlan ? t("training.fighterTraining.chartActiveDesc") : t("training.fighterTraining.chartRecentDesc", { weeks: ADHERENCE_WEEKS })}
                        className="min-w-0"
                    />
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader
                            title={t("training.fighterTraining.nextInPlan")}
                            icon={<CalendarClock />}
                            action={
                                nextSessions.length > 0 ? (
                                    <CardLink href={routes.fighter.schedule} srContext={t("training.fighterTraining.allAriaContext")}>
                                        {t("training.fighterTraining.all")}
                                    </CardLink>
                                ) : undefined
                            }
                        />
                        {nextSessions.length === 0 ? (
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<CalendarClock />}
                                    title={t("training.fighterTraining.noUpcomingTitle")}
                                    description={activePlan ? t("training.fighterTraining.noUpcomingDescPlan") : t("training.fighterTraining.noUpcomingDescNoPlan")}
                                />
                            </CardContent>
                        ) : (
                            <ul className="divide-y divide-border border-t border-border">
                                {nextSessions.map((session) => (
                                    <li key={session.id}>
                                        <SessionListItem locale={locale} session={session} href={routes.fighter.session(session.id)} coachName={session.coachId ? coachNames[session.coachId] : undefined} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                <section aria-labelledby="plan-history-heading" className="flex flex-col gap-4">
                    <div>
                        <h2 id="plan-history-heading" className="text-lg font-semibold text-fg">
                            {t("training.fighterTraining.planHistoryHeading")}
                        </h2>
                        <p className="text-sm text-fg-muted">{t("training.fighterTraining.planHistoryDesc")}</p>
                    </div>
                    {otherPlans.length === 0 ? (
                        <EmptyState compact icon={<ClipboardList />} title={t("training.fighterTraining.noEarlierPlansTitle")} description={t("training.fighterTraining.noEarlierPlansDesc")} className="rounded-xl border border-dashed border-border-strong" />
                    ) : (
                        <ul className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {otherPlans.map((plan) => (
                                <li key={plan.id} className="min-w-0">
                                    <PlanCard
                                        plan={plan}
                                        now={now}
                                        coachName={coachNames[plan.coachId]}
                                        adherencePct={planAdherencePct(sessionsFor(plan.id), now)}
                                        href={routes.fighter.plan(plan.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
