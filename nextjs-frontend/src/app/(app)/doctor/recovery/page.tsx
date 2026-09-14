import { CalendarClock, CheckCheck, Plus, RefreshCw, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { RecoveryPlanCard } from "@/components/clinical/recovery-plan-card";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { RecoveryPlan } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listInjuries, listRecoveryPlans } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Recovery" };

const RETURN_WINDOW_DAYS = 14;
/** Pain increase between the last two check-ins that deserves a look. */
const PAIN_RISE = 2;

function painRose(plan: RecoveryPlan): boolean {
    const [previous, last] = plan.checkIns.slice(-2);
    return Boolean(previous && last && last.painLevel - previous.painLevel >= PAIN_RISE);
}

export default async function RecoveryBoardPage() {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [fighters, plans, injuries] = await Promise.all([
        listFighters(user),
        listRecoveryPlans({ fighterIds: scope }),
        listInjuries({ fighterIds: scope }),
    ]);
    const fightersById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
    const injuriesById = new Map(injuries.map((injury) => [injury.id, injury]));

    const inProgress = plans
        .filter((plan) => plan.status !== "completed" && fightersById.has(plan.fighterId))
        .sort((a, b) => a.targetReturnDate.localeCompare(b.targetReturnDate));
    const completed = plans.filter((plan) => plan.status === "completed" && fightersById.has(plan.fighterId));
    const returningSoon = inProgress.filter((plan) => {
        const days = daysBetween(now, plan.targetReturnDate);
        return days >= 0 && days <= RETURN_WINDOW_DAYS;
    });
    const painRising = inProgress.filter(painRose);

    const newPlanAction = (
        <ButtonLink href={clinicalLinks.newRecoveryPlan}>
            <Plus aria-hidden />
            New recovery plan
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title="Recovery"
                description="Return-to-training plans for your assigned fighters: current phase, progress and how each fighter is responding at check-ins."
                actions={newPlanAction}
            />

            <div className="flex flex-col gap-8">
                <section aria-label="Recovery summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Plans in progress"
                        value={inProgress.length}
                        icon={<RefreshCw />}
                        hint={`${pluralize(completed.length, "completed plan")} on record`}
                    />
                    <StatCard
                        label={`Target return ≤ ${RETURN_WINDOW_DAYS} days`}
                        value={returningSoon.length}
                        icon={<CalendarClock />}
                        hint={
                            returningSoon.length > 0
                                ? returningSoon.map((plan) => fightersById.get(plan.fighterId)?.name).join(", ")
                                : "No returns due soon"
                        }
                    />
                    <StatCard
                        label="Pain up at last check-in"
                        value={painRising.length}
                        icon={<TrendingUp />}
                        hint={
                            painRising.length > 0
                                ? `Rose by ${PAIN_RISE}+ points: ${painRising.map((plan) => fightersById.get(plan.fighterId)?.name).join(", ")}`
                                : `No rise of ${PAIN_RISE}+ points`
                        }
                    />
                </section>

                <section aria-labelledby="active-plans-heading" className="flex flex-col gap-4">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id="active-plans-heading" className="text-lg font-semibold text-fg">
                            In progress
                        </h2>
                        <p className="text-[13px] text-fg-muted">Soonest target return first</p>
                    </div>
                    {inProgress.length === 0 ? (
                        <EmptyState
                            icon={<RefreshCw />}
                            title="No recovery plans in progress"
                            description="Create a plan from an injury record to guide a fighter's phased return to training."
                            action={newPlanAction}
                        />
                    ) : (
                        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {inProgress.map((plan) => {
                                const fighter = fightersById.get(plan.fighterId);
                                if (!fighter) return null;
                                return (
                                    <li key={plan.id} className="min-w-0">
                                        <RecoveryPlanCard plan={plan} fighter={fighter} injury={injuriesById.get(plan.injuryId) ?? null} now={now} />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="completed-plans-heading">
                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader
                            as="h2"
                            title={<span id="completed-plans-heading">Completed plans</span>}
                            description="Finished return-to-training plans, most recent first"
                            icon={<CheckCheck />}
                        />
                        {completed.length === 0 ? (
                            <EmptyState
                                compact
                                title="No completed plans yet"
                                description="Plans move here when you complete their final phase."
                                className="border-t border-border"
                            />
                        ) : (
                            <div className="border-t border-border">
                                <Table caption="Completed recovery plans">
                                    <THead>
                                        <tr>
                                            <TH>Fighter</TH>
                                            <TH>Plan</TH>
                                            <TH>Injury</TH>
                                            <TH>Started</TH>
                                            <TH>Target return</TH>
                                            <TH className="text-right">Phases</TH>
                                            <TH>Status</TH>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {completed.map((plan) => {
                                            const fighter = fightersById.get(plan.fighterId);
                                            const injury = injuriesById.get(plan.injuryId);
                                            if (!fighter) return null;
                                            return (
                                                <TR key={plan.id}>
                                                    <TD>
                                                        <FighterIdentity fighter={fighter} size="sm" showMeta={false} />
                                                    </TD>
                                                    <TD className="min-w-56">
                                                        <Link
                                                            href={routes.doctor.recoveryPlan(plan.id)}
                                                            className="font-medium text-fg hover:underline"
                                                        >
                                                            {plan.title}
                                                        </Link>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        {injury ? (
                                                            <Link
                                                                href={routes.doctor.injury(injury.id)}
                                                                className="text-fg-muted hover:text-fg hover:underline"
                                                            >
                                                                {injuryTitle(injury)}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-fg-subtle">—</span>
                                                        )}
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={plan.startDate}>{formatDate(plan.startDate)}</time>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={plan.targetReturnDate}>{formatDate(plan.targetReturnDate)}</time>
                                                    </TD>
                                                    <TD className="text-right">{plan.phases.length}</TD>
                                                    <TD>
                                                        <RecoveryPlanStatusBadge status={plan.status} size="sm" />
                                                    </TD>
                                                </TR>
                                            );
                                        })}
                                    </TBody>
                                </Table>
                            </div>
                        )}
                    </Card>
                </section>
            </div>
        </>
    );
}
