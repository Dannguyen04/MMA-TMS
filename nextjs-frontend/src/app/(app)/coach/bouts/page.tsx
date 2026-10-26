import { Plus, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BoutStatusBadge, Gate1Badge, WeightWarningBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { identitiesById } from "@/components/training/training-data";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listBouts } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Bouts") };
}

function formatDaysDisplay(t: Translator, daysLeft?: number): string | null {
    if (daysLeft === undefined) return null;
    if (daysLeft > 1) return t("coachBouts.daysLeft.inDays", { n: daysLeft });
    if (daysLeft === 1) return t("coachBouts.daysLeft.tomorrow");
    if (daysLeft === 0) return t("coachBouts.daysLeft.today");
    return plural(t, "coachBouts.daysLeft.daysAgo", Math.abs(daysLeft));
}

export default async function CoachBoutsPage() {
    const user = await requireRole("coach");
    const scope = accessibleFighterIds(user);

    const [bouts, fighters, { t, locale }] = await Promise.all([
        listBouts({ fighterIds: scope }),
        listFighters(user),
        getTranslator(),
    ]);

    const fightersById = identitiesById(fighters);
    // Non-completed bouts sorted by weigh-in date ascending
    const activeBouts = bouts.filter((b) => b.status !== "COMPLETED" && b.status !== "CANCELLED");

    const newBoutButton = (
        <ButtonLink href={routes.coach.newBout}>
            <Plus aria-hidden />
            {t("coachBouts.newBout")}
        </ButtonLink>
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("nav.Bouts")}
                description={plural(t, "coachBouts.activeBouts", activeBouts.length)}
                actions={newBoutButton}
            />

            {activeBouts.length === 0 ? (
                <EmptyState
                    icon={<Swords className="size-6" />}
                    title={t("coachBouts.emptyTitle")}
                    description={t("coachBouts.emptyDescription")}
                    action={newBoutButton}
                />
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <THead>
                            <TR>
                                <TH className="text-left">{t("coachBouts.table.fighter")}</TH>
                                <TH className="text-left">{t("coachBouts.table.eventAndWeight")}</TH>
                                <TH className="text-left">{t("coachBouts.table.weighIn")}</TH>
                                <TH className="text-left">{t("coachBouts.table.status")}</TH>
                                <TH className="text-left">{t("weight.title")}</TH>
                                <TH className="text-left">{t("coachBouts.table.gate1")}</TH>
                            </TR>
                        </THead>
                        <TBody>
                            {activeBouts.map((bout) => {
                                const fighter = fightersById[bout.fighterId];
                                const daysLeft = bout.daysToWeighIn;
                                const daysDisplay = formatDaysDisplay(t, daysLeft);

                                return (
                                    <TR key={bout.id} className="hover:bg-surface-muted/50">
                                        <TD>
                                            {fighter ? (
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar name={fighter.name} shape="octagon" size="md" />
                                                    <Link
                                                        href={routes.coach.bout(bout.id)}
                                                        className="truncate font-semibold text-fg text-[15px] hover:text-primary hover:underline"
                                                    >
                                                        {fighter.name}
                                                    </Link>
                                                </div>
                                            ) : (
                                                <Link
                                                    href={routes.coach.bout(bout.id)}
                                                    className="font-medium text-fg-muted hover:underline"
                                                >
                                                    {t("coachBouts.unknownFighter")}
                                                </Link>
                                            )}
                                        </TD>
                                        <TD>
                                            <div className="flex min-w-0 flex-col">
                                                <Link
                                                    href={routes.coach.bout(bout.id)}
                                                    className="truncate font-medium text-fg hover:text-primary hover:underline"
                                                >
                                                    {bout.eventName}
                                                </Link>
                                                <span className="truncate text-xs text-fg-muted">
                                                    {bout.weightLimitKg} kg{bout.opponentName ? ` · ${t("bout.versus", { opponent: bout.opponentName })}` : ""}
                                                </span>
                                            </div>
                                        </TD>
                                        <TD>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-fg">{formatShortDate(bout.weighInAt, locale)}</span>
                                                {daysDisplay && (
                                                    <span className="text-xs text-fg-muted">
                                                        {daysDisplay}
                                                    </span>
                                                )}
                                            </div>
                                        </TD>
                                        <TD>
                                            <BoutStatusBadge status={bout.status} size="sm" locale={locale} />
                                        </TD>
                                        <TD>
                                            {bout.weight ? (
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <WeightWarningBadge status={bout.weight.status} size="sm" locale={locale} />
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
                                        <TD>
                                            <Gate1Badge gate1={bout.gate1} size="sm" compact locale={locale} />
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
