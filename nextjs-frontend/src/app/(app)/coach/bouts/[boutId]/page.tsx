import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampWeightCard } from "@/components/domain/camp-weight-card";
import { NutritionPlanForm } from "@/components/domain/nutrition-plan-form";
import { WeightStatusBadge } from "@/components/domain/weight-status-badge";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { weighInCountdown } from "@/lib/domain/nutrition";
import { dayKey, formatDateTime, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getCampBout, getWeightTrack, wayOffForBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";

export const metadata: Metadata = { title: "Bout" };

export default async function CoachBoutPage({
    params,
    searchParams,
}: {
    params: Promise<{ boutId: string }>;
    searchParams: Promise<{ saved?: string }>;
}) {
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
            {query.saved === "plan" && (
                <div className="mb-6">
                    <Callout tone="success" icon={CheckCircle2} role="status" title="Plan saved" />
                </div>
            )}

            <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
                <Fact label={bout.catchweightKg === null ? "Limit" : "Catchweight"} value={`${formatNumber(bout.catchweightKg ?? bout.limitKg, 1)} kg`} />
                <Fact label="Weigh-in" value={formatDateTime(bout.weighInAt)} />
                <Fact label="Bout" value={formatDateTime(bout.boutAt)} />
                <Fact label="Countdown" value={track ? weighInCountdown(track.daysToWeighIn) : "—"} />
            </dl>

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

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-pretty text-fg tabular-nums">{value}</dd>
        </div>
    );
}
