import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampWeightCard } from "@/components/domain/camp-weight-card";
import { NutritionPlanForm } from "@/components/domain/nutrition-plan-form";
import { WeightStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { weighInCountdown } from "@/lib/domain/nutrition";
import { dayKey, formatDateTime, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getCampBout, getWeightTrack, wayOffForBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Bout" };

export default async function CoachBoutPage({ params, searchParams }: PageProps<"/coach/bouts/[boutId]">) {
    const user = await requireRole("coach");
    const { boutId } = await params;
    const query = await searchParams;
    const bout = await getCampBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) notFound();

    const todayOn = dayKey(new Date());
    const [track, fighter, wayOff] = await Promise.all([getWeightTrack(bout.id), getFighter(bout.fighterId), wayOffForBout(bout.id, todayOn)]);

    return (
        <>
            <PageHeader
                back={{ href: routes.coach.dashboard, label: "Today" }}
                title={bout.event}
                description={`${fighter?.name ?? "Fighter"} · ${bout.opponent ?? "Opponent TBA"}`}
                meta={
                    <>
                        <span className="text-sm text-fg-muted">{WEIGHT_CLASS_LABELS[bout.weightClass]}</span>
                        {track && <WeightStatusBadge status={track.status} />}
                    </>
                }
            />
            {param(query.saved) === "plan" && (
                <div className="mb-6">
                    <Callout tone="success" icon={CheckCircle2} role="status" title="Plan saved" />
                </div>
            )}

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
                {track && <CampWeightCard track={track} wayOff={wayOff} />}

                <Card>
                    <CardHeader title="Meal plan" description="Camp, fight week, and after the official weigh-in." />
                    <CardContent>
                        <NutritionPlanForm boutId={bout.id} plan={bout.nutritionPlan} authorName={user.name} />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
