import { getDemoCopy, getLocale } from "@/lib/i18n/server";
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
import { planAdherence, planAdherenceWeeks, planAdherencePct, recentAdherenceWeeks } from "@/components/training/training-utils";
import { requireFighterId } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listPlans, listSessions } from "@/lib/services/training";

export async function generateMetadata(): Promise<Metadata> { const copy = await getDemoCopy(); return { title: copy("Training plans") }; }

const NEXT_SESSIONS = 4;
const ADHERENCE_WEEKS = 8;

export default async function FighterTrainingPage() {
    const copy = await getDemoCopy();
    const locale = await getLocale();
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighterId = requireFighterId(user, user.profileId);
    const now = new Date().toISOString();

    const [plans, sessions, coachNames] = await Promise.all([listPlans({ fighterIds: [fighterId] }), listSessions({ fighterIds: [fighterId] }), getCoachNames()]);

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
                title={copy("Training plans")}
                description={copy("The plan your coach built for this phase, how consistently you're following it, and your past plans.")}
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
                                {copy("View full plan")} </ButtonLink>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<ClipboardList />}
                        title={copy("No active training plan")}
                        description={copy("Your coach hasn't published a plan for this phase yet. Sessions they schedule still appear on your schedule.")}
                        action={
                            <ButtonLink href={routes.fighter.schedule} variant="secondary">
                                {copy("View schedule")} </ButtonLink>
                        }
                    />
                )}

                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                    <AdherenceChart
                        weeks={adherenceWeeks}
                        description={activePlan ? copy("Completed out of due sessions per week in your current plan") : copy("Completed out of due sessions per week, last {n} weeks", { n: ADHERENCE_WEEKS })}
                        className="min-w-0"
                    />
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader
                            title={copy("Next in this plan")}
                            icon={<CalendarClock />}
                            action={
                                nextSessions.length > 0 ? (
                                    <CardLink href={routes.fighter.schedule} srContext={copy("upcoming sessions on your schedule")}>
                                        {copy("All")} </CardLink>
                                ) : undefined
                            }
                        />
                        {nextSessions.length === 0 ? (
                            <CardContent>
                                <EmptyState
                                    compact
                                    icon={<CalendarClock />}
                                    title={copy("No upcoming sessions")}
                                    description={activePlan ? copy("Nothing is scheduled ahead in this plan yet.") : copy("Sessions appear here once a plan is active.")}
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
                            {copy("Plan history")} </h2>
                        <p className="text-sm text-fg-muted">{copy("Completed and archived plans from earlier phases.")} </p>
                    </div>
                    {otherPlans.length === 0 ? (
                        <EmptyState compact icon={<ClipboardList />} title={copy("No earlier plans")} description={copy("Plans you finish with your coach are kept here.")} className="rounded-xl border border-dashed border-border-strong" />
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
