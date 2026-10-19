import { CalendarClock, FileCheck2, Scale, Swords, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import { BoutRequirementStatusBadge, BoutStatusBadge, WeightWarningBadge } from "@/components/domain/status-badges";
import { WeightChart } from "@/components/domain/weight-chart";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { WEIGHT_WARNING_LABELS } from "@/lib/domain/labels";
import type { Bout, BoutRequirement, WeightTrack } from "@/lib/domain/types";
import { activeBout, WEIGHT_SAVED_NOTICE } from "@/lib/domain/weigh-in";
import { formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getWeightTrack, listBouts } from "@/lib/services/bouts";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Bout" };

/** Medical documents count as ready once provided or confirmed. */
const READY = new Set<BoutRequirement["status"]>(["PROVIDED", "CONFIRMED"]);

/**
 * The fighter's running bout on a phone: the fight, today's weight against the limit, and which
 * medical documents the coach still needs. The fighter reads the checklist; the coach keeps it.
 */
export default async function FighterBoutPage({ searchParams }: PageProps<"/fighter/bout">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const query = await searchParams;

    const bouts = await nullIfServiceFails(listBouts({ fighterIds: [fighter.id] }));
    const bout = bouts ? activeBout(bouts) : null;
    const track = bout ? await nullIfServiceFails(getWeightTrack(bout.id)) : null;

    const saved = param(query.notice) === WEIGHT_SAVED_NOTICE;
    const notice =
        saved && track?.latestKg != null
            ? { title: `Saved ${formatNumber(track.latestKg, 1)} kg`, description: `Status: ${WEIGHT_WARNING_LABELS[track.status]}` }
            : saved
              ? { title: "Weight saved" }
              : null;

    if (!bout) {
        return (
            <>
                <FlashToast notice={notice} cleanHref={routes.fighter.bout} />
                <PageHeader title="Bout" />
                <EmptyState
                    icon={<Swords />}
                    title="No upcoming bout"
                    description="When your coach books a bout, the weigh-in limit and medical checklist show here. You can still log your weight."
                    action={
                        <ButtonLink href={routes.fighter.weighIn}>
                            <Scale aria-hidden />
                            Log weight
                        </ButtonLink>
                    }
                />
            </>
        );
    }

    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;

    return (
        <>
            <FlashToast notice={notice} cleanHref={routes.fighter.bout} />
            <PageHeader
                eyebrow="Bout"
                title={bout.eventName}
                description={`vs ${bout.opponentName ?? "Opponent TBA"} · ${formatNumber(limitKg, 1)} kg`}
                meta={
                    <>
                        <BoutStatusBadge status={bout.status} />
                        {bout.daysToWeighIn !== undefined && (
                            <Badge tone="neutral" variant="outline" icon={CalendarClock}>
                                {countdown(bout.daysToWeighIn)}
                            </Badge>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <FighterWeightCard bout={bout} track={track} limitKg={limitKg} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <Card className="min-w-0">
                        <CardHeader title="Fight details" icon={<Swords aria-hidden />} />
                        <CardContent>
                            <DescriptionList
                                columns={1}
                                items={[
                                    { label: "Opponent", value: bout.opponentName ?? "Opponent TBA" },
                                    { label: "Weight limit", value: `${formatNumber(limitKg, 1)} kg${bout.catchweightKg ? " (catchweight)" : ""}` },
                                    { label: "Weigh-in", value: formatDateTime(bout.weighInAt) },
                                    { label: "Bout", value: formatDateTime(bout.boutAt) },
                                    ...(bout.venue ? [{ label: "Venue", value: bout.venue }] : []),
                                ]}
                            />
                        </CardContent>
                    </Card>
                    <MedicalDocumentsCard requirements={bout.requirements} />
                </div>
            </div>
        </>
    );
}

function countdown(days: number): string {
    if (days > 0) return `${pluralize(days, "day")} to weigh-in`;
    if (days === 0) return "Weigh-in is today";
    return "Weigh-in done";
}

function FighterWeightCard({ bout, track, limitKg }: { bout: Bout; track: WeightTrack | null; limitKg: number }) {
    const weight = track ?? bout.weight ?? null;
    const status = weight?.status ?? "GREY";
    const latestKg = weight?.latestKg ?? null;
    const remainingPct = weight?.remainingPct ?? null;

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Weight"
                description={`Limit ${formatNumber(limitKg, 1)} kg · weigh-in ${formatDate(bout.weighInAt)}`}
                icon={<Scale aria-hidden />}
                action={<WeightWarningBadge status={status} />}
            />
            <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Latest weight</span>
                        <span className="font-display text-2xl font-bold text-fg">{latestKg !== null ? `${formatNumber(latestKg, 1)} kg` : "—"}</span>
                        <span className="text-xs text-fg-subtle">
                            {weight?.latestOn ? formatDate(`${weight.latestOn}T12:00:00+07:00`) : "No weigh-ins yet"}
                        </span>
                    </div>
                    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-muted p-3">
                        <span className="text-xs text-fg-muted">Still to cut</span>
                        <span className="font-display text-2xl font-bold text-fg">{remainingPct !== null ? `${formatNumber(remainingPct, 1)}%` : "—"}</span>
                        <span className="text-xs text-fg-subtle">
                            {latestKg !== null ? `${formatNumber(Math.max(0, latestKg - limitKg), 1)} kg above the limit` : "Log a weight to see it"}
                        </span>
                    </div>
                </div>

                {status === "RED" && (
                    <Callout tone="danger" icon={TriangleAlert} title="Your cut is too steep for the days left">
                        What&apos;s left to lose is more than is safe to cut before the weigh-in. Talk to your coach and medical staff today about
                        the plan, including moving up a weight class.
                    </Callout>
                )}

                {track && <WeightChart track={track} weighInAt={bout.weighInAt} height={220} />}

                <ButtonLink href={routes.fighter.weighIn} size="lg" className="w-full sm:w-auto sm:self-start">
                    <Scale aria-hidden />
                    Log weight
                </ButtonLink>
            </CardContent>
        </Card>
    );
}

function MedicalDocumentsCard({ requirements }: { requirements: BoutRequirement[] }) {
    const ready = requirements.filter((item) => READY.has(item.status)).length;

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Medical documents"
                description={requirements.length > 0 ? `${ready} of ${requirements.length} ready` : "Nothing required yet"}
                icon={<FileCheck2 aria-hidden />}
            />
            <CardContent>
                {requirements.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border">
                        {requirements.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                <span className="min-w-0 text-sm text-fg">
                                    {item.label}
                                    {item.validUntil && <span className="block text-xs text-fg-subtle">Valid until {formatDate(`${item.validUntil}T12:00:00+07:00`)}</span>}
                                </span>
                                <BoutRequirementStatusBadge status={item.status} size="sm" />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-fg-muted">Your coach adds the documents this event asks for.</p>
                )}
            </CardContent>
        </Card>
    );
}
