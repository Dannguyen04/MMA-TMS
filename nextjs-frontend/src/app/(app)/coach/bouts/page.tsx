import { Plus, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BoutStatusBadge, Gate1Badge, WeightWarningBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { TBody, TD, THead, TR, Table } from "@/components/ui/table";
import { identitiesById } from "@/components/training/training-data";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { formatShortDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listBouts } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Bouts" };

export default async function CoachBoutsPage() {
    const user = await requireRole("coach");
    const scope = accessibleFighterIds(user);

    const [bouts, fighters] = await Promise.all([
        listBouts({ fighterIds: scope }),
        listFighters(user),
    ]);

    const fightersById = identitiesById(fighters);
    // Non-completed bouts sorted by weigh-in date ascending
    const activeBouts = bouts.filter((b) => b.status !== "COMPLETED" && b.status !== "CANCELLED");

    const newBoutButton = (
        <ButtonLink href={routes.coach.newBout}>
            <Plus aria-hidden />
            New bout
        </ButtonLink>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Bouts"
                description={pluralize(activeBouts.length, "active bout")}
                actions={newBoutButton}
            />

            {activeBouts.length === 0 ? (
                <EmptyState
                    icon={<Swords className="size-6" />}
                    title="No upcoming bouts"
                    description="Create a bout for a fighter on your roster to start tracking fight camp and weight cuts."
                    action={newBoutButton}
                />
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <THead>
                            <TR>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Fighter
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Event & weight
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Weigh-in
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Status
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Weight
                                </th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Gate 1
                                </th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                    Action
                                </th>
                            </TR>
                        </THead>
                        <TBody>
                            {activeBouts.map((bout) => {
                                const fighter = fightersById[bout.fighterId];
                                const daysLeft = bout.daysToWeighIn;
                                const daysDisplay =
                                    daysLeft !== undefined
                                        ? daysLeft > 1
                                            ? `in ${daysLeft} days`
                                            : daysLeft === 1
                                              ? "tomorrow"
                                              : daysLeft === 0
                                                ? "today"
                                                : `${Math.abs(daysLeft)} days ago`
                                        : null;

                                return (
                                    <TR key={bout.id} className="hover:bg-surface-muted/50">
                                        <TD className="px-4 py-3">
                                            {fighter ? (
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar name={fighter.name} shape="octagon" size="md" />
                                                    <span className="truncate font-semibold text-fg text-[15px]">{fighter.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-fg-muted">Unknown fighter</span>
                                            )}
                                        </TD>
                                        <TD className="px-4 py-3">
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate font-medium text-fg">{bout.eventName}</span>
                                                <span className="truncate text-xs text-fg-muted">
                                                    {bout.weightLimitKg} kg{bout.opponentName ? ` · vs ${bout.opponentName}` : ""}
                                                </span>
                                            </div>
                                        </TD>
                                        <TD className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-fg">{formatShortDate(bout.weighInAt)}</span>
                                                {daysDisplay && (
                                                    <span className="text-xs text-fg-muted">
                                                        {daysDisplay}
                                                    </span>
                                                )}
                                            </div>
                                        </TD>
                                        <TD className="px-4 py-3">
                                            <BoutStatusBadge status={bout.status} size="sm" />
                                        </TD>
                                        <TD className="px-4 py-3">
                                            {bout.weight ? (
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <WeightWarningBadge status={bout.weight.status} size="sm" />
                                                    {bout.weight.latestKg !== null && (
                                                        <span className="text-xs text-fg-muted tabular-nums">
                                                            {bout.weight.latestKg} kg
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-fg-muted">—</span>
                                            )}
                                        </TD>
                                        <TD className="px-4 py-3">
                                            <Gate1Badge gate1={bout.gate1} size="sm" />
                                        </TD>
                                        <TD className="px-4 py-3 text-right">
                                            <Link
                                                href={routes.coach.bout(bout.id)}
                                                className="text-xs font-semibold text-primary hover:underline"
                                            >
                                                View details
                                            </Link>
                                        </TD>
                                    </TR>
                                );
                            })}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
