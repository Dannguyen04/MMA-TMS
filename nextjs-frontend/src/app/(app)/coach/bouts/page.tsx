import { Plus, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BoutPhaseBadge, Gate1Badge, WeightStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { isRunningPhase, type CampBout } from "@/lib/domain/bout";
import { boutGate1, requirementsOverdue, weighInOn } from "@/lib/domain/bout-rules";
import { BOUT_PHASE_LABELS, BOUT_RESULT_LABELS, CANCEL_REASON_LABELS } from "@/lib/domain/labels";
import { weighInCountdown } from "@/lib/domain/nutrition";
import type { WeightTrack } from "@/lib/domain/weight-track";
import { dayKey, daysBetweenKeys, formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getWeightTrack, listCampBouts } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Bouts" };

/** Finished bouts stay on the list this long, so a result or a cancellation can still be opened. */
const FINISHED_DAYS = 30;

interface BoutRow {
    bout: CampBout;
    fighterName: string;
    track: WeightTrack | null;
    countdown: string;
    missing: number;
    overdue: boolean;
}

export default async function CoachBoutsPage() {
    const user = await requireRole("coach");
    const now = new Date();
    const todayOn = dayKey(now);
    const [fighters, bouts] = await Promise.all([listFighters(user), listCampBouts(accessibleFighterIds(user))]);
    const names = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));

    const running = bouts.filter((bout) => isRunningPhase(bout.phase)).sort((a, b) => (a.weighInAt < b.weighInAt ? -1 : 1));
    const rows: BoutRow[] = await Promise.all(
        running.map(async (bout) => ({
            bout,
            fighterName: names.get(bout.fighterId) ?? "Fighter",
            track: await getWeightTrack(bout.id, now),
            countdown: weighInCountdown(daysBetweenKeys(todayOn, weighInOn(bout))),
            missing: boutGate1(bout).missing.length,
            overdue: requirementsOverdue(bout, todayOn),
        })),
    );
    const finished = bouts
        .filter((bout) => !isRunningPhase(bout.phase) && daysBetweenKeys(dayKey(bout.boutAt), todayOn) <= FINISHED_DAYS)
        .sort((a, b) => (a.boutAt < b.boutAt ? 1 : -1));
    const newBout = (
        <ButtonLink href={routes.coach.newBout}>
            <Plus aria-hidden />
            New bout
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title="Bouts"
                description="Running bouts on your roster, by weigh-in date: can each fighter make weight, and are the documents in?"
                actions={rows.length > 0 ? newBout : undefined}
            />

            {rows.length === 0 ? (
                <EmptyState
                    icon={<Swords />}
                    title="No running bouts"
                    description="Create a bout when the club accepts one. Its camp, weight and medical checklist start from there."
                    action={newBout}
                />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-border md:hidden" aria-label="Running bouts">
                        {rows.map((row) => (
                            <li key={row.bout.id}>
                                <Link href={routes.coach.bout(row.bout.id)} className="flex flex-col gap-2 px-4 py-3.5 hover:bg-surface-muted">
                                    <span className="flex min-w-0 items-center gap-3">
                                        <Avatar name={row.fighterName} size="sm" shape="octagon" />
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium text-fg">{row.fighterName}</span>
                                            <span className="block truncate text-sm text-fg-muted">{row.bout.event}</span>
                                        </span>
                                    </span>
                                    <span className="text-sm text-fg-muted">
                                        Weigh-in {formatDateTime(row.bout.weighInAt)} · {row.countdown}
                                    </span>
                                    <BadgeRow row={row} />
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div className="hidden md:block">
                        <Table caption="Running bouts">
                            <THead>
                                <tr>
                                    <TH>Fighter</TH>
                                    <TH>Weigh-in</TH>
                                    <TH>Phase</TH>
                                    <TH>Weight</TH>
                                    <TH>Gate 1</TH>
                                </tr>
                            </THead>
                            <TBody>
                                {rows.map((row) => (
                                    <TR key={row.bout.id} className="relative hover:bg-surface-muted">
                                        <TD>
                                            <span className="flex min-w-0 items-center gap-3">
                                                <Avatar name={row.fighterName} size="sm" shape="octagon" />
                                                <span className="min-w-0">
                                                    <Link
                                                        href={routes.coach.bout(row.bout.id)}
                                                        className="block truncate font-medium text-fg after:absolute after:inset-0 hover:underline"
                                                    >
                                                        {row.fighterName}
                                                    </Link>
                                                    <span className="block truncate text-fg-muted">{row.bout.event}</span>
                                                </span>
                                            </span>
                                        </TD>
                                        <TD className="whitespace-nowrap">
                                            <span className="block text-fg">{formatDateTime(row.bout.weighInAt)}</span>
                                            <span className="block text-fg-muted">{row.countdown}</span>
                                        </TD>
                                        <TD>
                                            <BoutPhaseBadge phase={row.bout.phase} />
                                        </TD>
                                        <TD>{row.track ? <WeightStatusBadge status={row.track.status} /> : <span className="text-fg-subtle">—</span>}</TD>
                                        <TD>
                                            <Gate1Badge missing={row.missing} overdue={row.overdue} />
                                        </TD>
                                    </TR>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            )}

            {finished.length > 0 && (
                <Card className="mt-6">
                    <CardHeader title="Recently finished" description={`Completed and cancelled bouts from the last ${FINISHED_DAYS} days.`} />
                    <CardContent>
                        <ul className="divide-y divide-border">
                            {finished.map((bout) => (
                                <li key={bout.id}>
                                    <Link href={routes.coach.bout(bout.id)} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 hover:underline">
                                        <span className="min-w-0">
                                            <span className="block font-medium text-fg">
                                                {names.get(bout.fighterId) ?? "Fighter"} · {bout.event}
                                            </span>
                                            <span className="block text-sm text-fg-muted">
                                                {formatDate(bout.boutAt)} · {finishedSummary(bout)}
                                            </span>
                                        </span>
                                        <BoutPhaseBadge phase={bout.phase} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </>
    );
}

function BadgeRow({ row }: { row: BoutRow }) {
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            <BoutPhaseBadge phase={row.bout.phase} />
            {row.track && <WeightStatusBadge status={row.track.status} />}
            <Gate1Badge missing={row.missing} overdue={row.overdue} />
        </span>
    );
}

function finishedSummary(bout: CampBout): string {
    if (bout.phase === "CANCELLED") return bout.cancelReason ? `Cancelled: ${CANCEL_REASON_LABELS[bout.cancelReason]}` : "Cancelled";
    if (bout.outcome) return `${BOUT_RESULT_LABELS[bout.outcome.result]}`;
    return BOUT_PHASE_LABELS[bout.phase];
}
