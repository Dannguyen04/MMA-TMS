import { CheckCircle2, Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampWeightCard } from "@/components/domain/camp-weight-card";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { requirementsReady } from "@/lib/domain/bout";
import { NUTRITION_PHASE_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { nutritionPhaseFor, savedWeightMessage, weighInCountdown } from "@/lib/domain/nutrition";
import { dayKey, formatDateTime, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getCurrentBout, getWeightTrack, wayOffForBout } from "@/lib/services/bouts";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Bout" };

export default async function FighterBoutPage({ searchParams }: PageProps<"/fighter/bout">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const query = await searchParams;
    const bout = await getCurrentBout(user.profileId);
    const saved = savedWeightMessage(param(query.saved), param(query.status));

    if (!bout) {
        return (
            <>
                <PageHeader title="Bout" description="No upcoming bout" />
                {saved && <SavedNote message={saved} />}
                <EmptyState
                    icon={<Scale />}
                    title="No upcoming bout"
                    description="You can still log today's weight."
                    action={
                        <ButtonLink href={routes.fighter.weighIn} size="lg">
                            Log weight
                        </ButtonLink>
                    }
                />
            </>
        );
    }

    const todayOn = dayKey(new Date());
    const [track, wayOff] = await Promise.all([getWeightTrack(bout.id), wayOffForBout(bout.id, todayOn)]);
    const ready = requirementsReady(bout.requirements);
    const phaseKey = nutritionPhaseFor(bout.phase);
    const note = phaseKey ? bout.nutritionPlan[phaseKey] : null;

    return (
        <>
            <PageHeader
                title={bout.event}
                description={bout.opponent ?? "Opponent TBA"}
                meta={<span className="text-sm text-fg-muted">{WEIGHT_CLASS_LABELS[bout.weightClass]}</span>}
            />
            {saved && <SavedNote message={saved} />}

            <DescriptionList
                columns={2}
                className="mb-6 lg:grid-cols-4"
                items={[
                    { label: bout.catchweightKg === null ? "Limit" : "Catchweight", value: `${formatNumber(bout.catchweightKg ?? bout.limitKg, 1)} kg` },
                    { label: "Weigh-in", value: formatDateTime(bout.weighInAt) },
                    { label: "Bout", value: formatDateTime(bout.boutAt) },
                    { label: "Countdown", value: track ? weighInCountdown(track.daysToWeighIn) : "—" },
                ]}
            />

            <div className="flex flex-col gap-6">
                {track && <CampWeightCard track={track} wayOff={wayOff} logHref={routes.fighter.weighIn} />}

                {phaseKey && (
                    <Card>
                        <CardHeader title={NUTRITION_PHASE_LABELS[phaseKey]} />
                        <CardContent>
                            {note ? (
                                <>
                                    <p className="text-sm text-pretty whitespace-pre-wrap text-fg">{note.text}</p>
                                    <p className="mt-2 text-xs text-fg-muted">
                                        {note.authorName} · {formatDateTime(note.updatedAt)}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-fg-muted">No plan for this phase yet.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader title="Medical file" description={`${ready.ready} of ${ready.total} ready`} />
                    <CardContent>
                        <ul className="divide-y divide-border">
                            {bout.requirements.map((item) => {
                                const isReady = item.state === "PROVIDED" || item.state === "CONFIRMED";
                                return (
                                    <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                                        <span>{item.label}</span>
                                        <span className="text-fg-muted">{isReady ? "Ready" : "Not ready"}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function SavedNote({ message }: { message: string }) {
    return (
        <div className="mb-6">
            <Callout tone="success" icon={CheckCircle2} role="status" title={message} />
        </div>
    );
}
