import { Activity, Swords, Trophy, Users } from "lucide-react";

import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { MetricTile } from "@/components/domain/metric-tile";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { STANCE_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter } from "@/lib/domain/types";
import { daysBetween, formatDate, formatNumber } from "@/lib/format";
import { BodyMetricsDialog } from "./body-metrics-dialog";

/* ─── Fight profile ───────────────────────────────────────────────────────── */

export function FightProfileCard({ fighter, now }: { fighter: Fighter; now: string }) {
    const bout = fighter.upcomingBout;
    const { wins, losses, draws } = fighter.record;

    return (
        <Card className="min-w-0">
            <CardHeader title="Fight profile" icon={<Swords />} description="Kept up to date by your coaches — let them know if something has changed." />
            <CardContent className="flex flex-col gap-5">
                {bout ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                                <Trophy className="size-[18px]" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-fg-muted">Next bout</p>
                                <p className="text-[15px] font-semibold text-fg">{bout.event}</p>
                                <p className="text-[13px] text-fg-muted">
                                    vs {bout.opponent} · {WEIGHT_CLASS_LABELS[bout.weightClass]}
                                </p>
                            </div>
                        </div>
                        <div className="pl-12 sm:pl-0 sm:text-right">
                            <p className="text-sm font-medium text-fg">
                                <time dateTime={bout.date}>{formatDate(bout.date)}</time>
                            </p>
                            <p className="text-[13px] text-fg-muted">{capitalize(describeDaysUntil(daysBetween(now, bout.date)))}</p>
                        </div>
                    </div>
                ) : (
                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                        No bout scheduled. Your coaches add bouts here once they are confirmed.
                    </p>
                )}
                <DescriptionList
                    columns={3}
                    className="grid-cols-2"
                    items={[
                        { label: "Weight class", value: WEIGHT_CLASS_LABELS[fighter.weightClass] },
                        { label: "Stance", value: STANCE_LABELS[fighter.stance] },
                        { label: "Level", value: TRAINING_LEVEL_LABELS[fighter.level] },
                        { label: "Discipline", value: fighter.primaryDiscipline },
                        {
                            label: "Record (W-L-D)",
                            value: (
                                <>
                                    <span aria-hidden>
                                        {wins}-{losses}-{draws}
                                    </span>
                                    <span className="sr-only">
                                        {wins} wins, {losses} losses, {draws} draws
                                    </span>
                                </>
                            ),
                        },
                        { label: "Height", value: `${fighter.heightCm} cm` },
                        { label: "Reach", value: `${fighter.reachCm} cm` },
                        { label: "Nationality", value: fighter.nationality },
                    ]}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Body metrics ────────────────────────────────────────────────────────── */

export function BodyMetricsCard({ fighter }: { fighter: Fighter }) {
    const classLabel = WEIGHT_CLASS_LABELS[fighter.weightClass];
    const gap = Number((fighter.weightKg - fighter.targetWeightKg).toFixed(1));

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Body metrics"
                icon={<Activity />}
                description="Log changes after a weigh-in so your coaches plan around current numbers."
                action={
                    <BodyMetricsDialog
                        weightKg={fighter.weightKg}
                        bodyFatPct={fighter.bodyFatPct}
                        restingHeartRate={fighter.restingHeartRate}
                        targetWeightKg={fighter.targetWeightKg}
                        weightClassLabel={classLabel}
                    />
                }
                className="flex-col sm:flex-row"
            />
            <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MetricTile
                        label="Current weight"
                        value={formatNumber(fighter.weightKg, 1)}
                        unit="kg"
                        hint={gap > 0 ? `${formatNumber(gap, 1)} kg to cut` : "On weight"}
                    />
                    <MetricTile label="Target weight" value={formatNumber(fighter.targetWeightKg, 1)} unit="kg" hint={`${classLabel} limit`} />
                    <MetricTile label="Body fat" value={formatNumber(fighter.bodyFatPct, 1)} unit="%" />
                    <MetricTile label="Resting heart rate" value={fighter.restingHeartRate} unit="bpm" />
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Care team ───────────────────────────────────────────────────────────── */

export function CareTeamCard({ coaches, doctors, primaryCoachId }: { coaches: Coach[]; doctors: Doctor[]; primaryCoachId: string }) {
    return (
        <Card className="min-w-0">
            <CardHeader title="Care team" icon={<Users />} description="The coaches and sports doctors assigned to you." />
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                <TeamSection
                    id="care-team-coaches"
                    heading="Coaches"
                    emptyText="No coaches assigned yet. The academy will assign a head coach."
                    people={coaches.map((coach) => ({
                        id: coach.id,
                        name: coach.name,
                        detail: coach.specialty,
                        badge: coach.id === primaryCoachId ? "Primary coach" : null,
                    }))}
                />
                <TeamSection
                    id="care-team-doctors"
                    heading="Sports doctors"
                    emptyText="No sports doctor assigned yet. Ask the academy to arrange a baseline physical."
                    people={doctors.map((doctor) => ({ id: doctor.id, name: doctor.name, detail: doctor.specialty, badge: null }))}
                />
            </CardContent>
        </Card>
    );
}

interface TeamMember {
    id: string;
    name: string;
    detail: string;
    badge: string | null;
}

function TeamSection({
    id,
    heading,
    emptyText,
    people,
}: {
    id: string;
    heading: string;
    emptyText: string;
    people: TeamMember[];
}) {
    return (
        <section aria-labelledby={id} className="min-w-0">
            <h3 id={id} className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                {heading}
            </h3>
            {people.length === 0 ? (
                <p className="mt-2 text-sm text-fg-muted">{emptyText}</p>
            ) : (
                <ul className="mt-2.5 flex flex-col gap-3">
                    {people.map((person) => (
                        <li key={person.id} className="flex min-w-0 items-center gap-3">
                            <Avatar name={person.name} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-fg">
                                    <span className="min-w-0 truncate">{person.name}</span>
                                    {person.badge && (
                                        <Badge tone="primary" size="sm">
                                            {person.badge}
                                        </Badge>
                                    )}
                                </p>
                                <p className="truncate text-[13px] text-fg-muted">{person.detail}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
