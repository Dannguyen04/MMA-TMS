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
import { RequirementStateBadge } from "@/components/domain/status-badges";
import { boutLimitKg } from "@/lib/domain/bout";
import { boutOn, expiresBeforeBout, gateSummary } from "@/lib/domain/bout-rules";
import { NUTRITION_PHASE_LABELS } from "@/lib/domain/labels";
import { kgLabel } from "@/lib/domain/weight-input";
import { nutritionPhaseFor, savedWeightMessage, weighInCountdown } from "@/lib/domain/nutrition";
import { dayKey, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
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
    const limit = boutLimitKg(bout);
    const boutDay = boutOn(bout);
    const phaseKey = nutritionPhaseFor(bout.phase);
    const note = phaseKey ? bout.nutritionPlan[phaseKey] : null;

    return (
        <>
            <PageHeader
                title={bout.event}
                description={bout.opponent ?? "Opponent TBA"}
                meta={<span className="text-sm text-fg-muted">{bout.weightClassLabel}</span>}
            />
            {saved && <SavedNote message={saved} />}

            <DescriptionList
                columns={2}
                className="mb-6 lg:grid-cols-4"
                items={[
                    { label: bout.catchweightKg === null ? "Limit" : "Catchweight", value: limit === null ? "No upper limit" : kgLabel(limit) },
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
                    <CardHeader title="Medical file" description={gateSummary(bout.requirements, boutDay)} />
                    <CardContent>
                        {bout.requirements.length === 0 ? (
                            <p className="text-sm text-fg-muted">Your coach hasn&apos;t listed any documents for this bout yet.</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {bout.requirements.map((item) => {
                                    const late = expiresBeforeBout(item, boutDay);
                                    return (
                                        <li key={item.code} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                                            <span className="min-w-0">
                                                <span className="block text-fg">
                                                    {item.label}
                                                    {!item.required && <span className="ml-1.5 text-xs text-fg-subtle">Optional</span>}
                                                </span>
                                                {item.validUntil && (
                                                    <span className={cn("block text-[13px] text-fg-muted", late && "font-medium text-danger-fg")}>
                                                        Valid until {formatDate(item.validUntil)}
                                                        {late && " (before the bout)"}
                                                    </span>
                                                )}
                                            </span>
                                            <RequirementStateBadge state={item.state} size="sm" />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
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
