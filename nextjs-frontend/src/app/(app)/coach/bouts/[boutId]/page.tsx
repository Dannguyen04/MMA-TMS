import {
    Activity,
    Calendar,
    CalendarClock,
    History,
    MapPin,
    Shield,
    TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import {
    BoutStatusBadge,
    Gate1Badge,
    WeightWarningBadge,
} from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getBout, listRulesets } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { listPlans } from "@/lib/services/training";
import { BoutHeaderActions } from "./bout-actions";
import { BoutChecklistCard } from "./bout-checklist-card";
import { BoutWeightCard } from "./bout-weight-card";

interface PageProps {
    params: Promise<{ boutId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { boutId } = await params;
    const bout = await getBout(boutId);
    return {
        title: bout ? `${bout.eventName} · Bout` : "Bout",
    };
}

export default async function CoachBoutDetailPage({ params }: PageProps) {
    const user = await requireRole("coach");
    const { boutId } = await params;

    const bout = await getBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) {
        notFound();
    }

    const [fighter, plans, rulesets] = await Promise.all([
        getFighter(bout.fighterId),
        listPlans({ fighterIds: [bout.fighterId] }),
        listRulesets(),
    ]);

    if (!fighter) {
        notFound();
    }

    const fightCampPlans = plans.filter((p) => p.phase === "fight_camp");
    const linkedPlan = bout.trainingPlanId ? plans.find((p) => p.id === bout.trainingPlanId) ?? null : null;
    const ruleset = rulesets.find((r) => r.id === bout.rulesetId) ?? null;

    const daysLeft = bout.daysToWeighIn;
    const countdownText =
        daysLeft !== undefined
            ? daysLeft > 0
                ? `${daysLeft} days to weigh-in`
                : daysLeft === 0
                  ? "Weigh-in is today"
                  : `Weighed in ${Math.abs(daysLeft)} days ago`
            : "";

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Bout"
                back={{ href: routes.coach.bouts, label: "Bouts" }}
                title={bout.eventName}
                description={`${fighter.name} vs. ${bout.opponentName ?? "TBA"} · ${bout.weightLimitKg} kg limit · Weigh-in ${formatDate(bout.weighInAt)} · Bout ${formatDate(bout.boutAt)}.`}
                actions={<BoutHeaderActions bout={bout} plans={fightCampPlans} />}
            />

            {/* Overview Banner Card */}
            <Card className="min-w-0">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-4">
                        <FighterIdentity fighter={fighter} size="lg" />
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider text-fg-muted">Opponent</span>
                            <span className="font-semibold text-fg">
                                {bout.opponentName ? `vs. ${bout.opponentName}` : "Opponent TBA"}
                            </span>
                            {bout.venue && (
                                <span className="flex items-center gap-1 text-xs text-fg-muted">
                                    <MapPin aria-hidden className="size-3" />
                                    {bout.venue}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <BoutStatusBadge status={bout.status} />
                        <Gate1Badge gate1={bout.gate1} />
                        {bout.weight && <WeightWarningBadge status={bout.weight.status} />}
                        {countdownText && (
                            <Badge tone="neutral" variant="outline" icon={CalendarClock}>
                                {countdownText}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Unverified ruleset notice */}
            {ruleset && !ruleset.verified && (
                <div className="flex items-center gap-2.5 rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-xs text-warning-fg">
                    <TriangleAlert aria-hidden className="size-4 shrink-0" />
                    <span>
                        <strong>Ruleset notice:</strong> This bout uses &quot;{ruleset.name}&quot; which is for reference only and has not been verified with the tournament organiser.
                    </span>
                </div>
            )}

            {/* Two-Column Workspace Grid */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                {/* Left/Main Column: Weight & Medical Checklist */}
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <BoutWeightCard bout={bout} />
                    <BoutChecklistCard bout={bout} />
                </div>

                {/* Right/Sidebar Column: Ruleset, Camp Plan, History */}
                <div className="flex flex-col gap-6">
                    {/* Ruleset & Competition Specs */}
                    <Card className="min-w-0">
                        <CardHeader
                            title="Competition rules"
                            description="Governing ruleset and safety limits."
                            icon={<Shield aria-hidden />}
                        />
                        <CardContent className="flex flex-col gap-3 text-xs">
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Ruleset</span>
                                <span className="font-medium text-fg">{ruleset?.name ?? "Custom rules"}</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Sport</span>
                                <span className="font-medium text-fg">{ruleset?.sport ?? "MMA"}</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Weight category</span>
                                <span className="font-medium text-fg">
                                    {bout.weightClassCode === "custom" ? "Custom limit" : `${bout.weightClassCode} kg`}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Target weight limit</span>
                                <span className="font-semibold tabular-nums text-fg">
                                    {bout.catchweightKg ?? bout.weightLimitKg} kg
                                    {bout.catchweightKg ? " (Catchweight)" : ""}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Acute cut limit (snapshot)</span>
                                <span className="font-semibold tabular-nums text-fg">
                                    {bout.acuteLossLimitPct}%
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Acute window</span>
                                <span className="font-medium text-fg">{ruleset?.acuteWindowDays ?? 7} days</span>
                            </div>
                            <div className="flex justify-between border-b border-border pb-2">
                                <span className="text-fg-muted">Weigh-in</span>
                                <span className="font-medium text-fg">{formatDateTime(bout.weighInAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-fg-muted">Bout start</span>
                                <span className="font-medium text-fg">{formatDateTime(bout.boutAt)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Fight Camp Card */}
                    <Card className="min-w-0">
                        <CardHeader
                            title="Fight camp"
                            description="Training plan linked to this bout."
                            icon={<Activity aria-hidden />}
                        />
                        <CardContent className="flex flex-col gap-3 text-xs">
                            {linkedPlan ? (
                                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
                                    <span className="font-semibold text-fg">{linkedPlan.title}</span>
                                    <span className="text-fg-muted">
                                        Phase: <strong className="text-fg">{TRAINING_PHASE_LABELS[linkedPlan.phase]}</strong> · Target: {linkedPlan.weeklySessionTarget ?? 0} sessions/wk
                                    </span>
                                    <span className="text-fg-muted">
                                        Camp started: {formatDate(linkedPlan.startDate)}
                                    </span>
                                    {linkedPlan.objective && (
                                        <p className="mt-1 text-fg-subtle italic">
                                            &ldquo;{linkedPlan.objective}&rdquo;
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border p-4 text-center text-fg-muted">
                                    <p className="font-medium text-fg">No training camp linked</p>
                                    <p className="mt-1 text-[11px]">
                                        {bout.status === "SCHEDULED"
                                            ? "Link a fight camp plan to transition this bout to Camp status."
                                            : "No fight camp plan is currently linked to this bout."}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Bout Notes */}
                    {bout.notes && (
                        <Card className="min-w-0">
                            <CardHeader title="Coach notes" icon={<Calendar aria-hidden />} />
                            <CardContent>
                                <p className="text-xs text-fg leading-relaxed whitespace-pre-wrap">{bout.notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* History Card */}
                    <Card className="min-w-0">
                        <CardHeader
                            title="Status history"
                            description="Audit trail of bout transitions."
                            icon={<History aria-hidden />}
                        />
                        <CardContent className="flex flex-col gap-3">
                            {bout.history.length === 0 ? (
                                <span className="text-xs text-fg-muted">No history recorded yet.</span>
                            ) : (
                                <div className="divide-y divide-border text-xs">
                                    {bout.history.map((entry, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-fg">
                                                    {entry.from === entry.to ? entry.to : `${entry.from} → ${entry.to}`}
                                                </span>
                                                <span className="text-[11px] text-fg-muted">
                                                    {formatDate(entry.at)}
                                                </span>
                                            </div>
                                            {entry.reason && (
                                                <span className="text-fg-muted italic">&ldquo;{entry.reason}&rdquo;</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
