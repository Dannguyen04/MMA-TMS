import { Activity, Swords, Trophy, Users } from "lucide-react";

import { recordSpoken, recordText } from "@/components/dashboard/dashboard-utils";
import { MetricTile } from "@/components/domain/metric-tile";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { stanceLabel, trainingLevelLabel, weightClassLabel } from "@/lib/domain/labels";
import type { Coach, Doctor, Fighter } from "@/lib/domain/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { BodyMetricsDialog } from "./body-metrics-dialog";

/* ─── Fight profile ───────────────────────────────────────────────────────── */

export function FightProfileCard({ fighter, now, locale = "en" }: { fighter: Fighter; now: string; locale?: Locale }) {
    const bout = fighter.upcomingBout;
    const t = createTranslator(locale);
    const notRecorded = t("account.profile.notRecorded");

    return (
        <Card className="min-w-0">
            <CardHeader title={t("account.fightProfile.title")} icon={<Swords />} description={t("account.fightProfile.description")} />
            <CardContent className="flex flex-col gap-5">
                {bout ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg">
                                <Trophy className="size-[18px]" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-fg-muted">{t("account.fightProfile.nextBout")}</p>
                                <p className="text-[15px] font-semibold text-fg">{bout.event}</p>
                                <p className="text-[13px] text-fg-muted">
                                    {t("account.fightProfile.vs", { opponent: bout.opponent, weightClass: weightClassLabel(bout.weightClass, locale) })}
                                </p>
                            </div>
                        </div>
                        <div className="pl-12 sm:pl-0 sm:text-right">
                            <p className="text-sm font-medium text-fg">
                                <time dateTime={bout.date}>{formatDate(bout.date, locale)}</time>
                            </p>
                            <p className="text-[13px] text-fg-muted">{formatRelative(bout.date, now, locale)}</p>
                        </div>
                    </div>
                ) : (
                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                        {t("account.fightProfile.noBout")}
                    </p>
                )}
                <DescriptionList
                    columns={3}
                    className="grid-cols-2"
                    items={[
                        { label: t("account.fightProfile.weightClass"), value: weightClassLabel(fighter.weightClass, locale) },
                        { label: t("account.fightProfile.stance"), value: fighter.stance ? stanceLabel(fighter.stance, locale) : notRecorded },
                        { label: t("account.fightProfile.level"), value: fighter.level ? trainingLevelLabel(fighter.level, locale) : notRecorded },
                        { label: t("account.fightProfile.discipline"), value: fighter.primaryDiscipline ?? notRecorded },
                        {
                            label: t("account.fightProfile.record"),
                            value: fighter.record ? (
                                <>
                                    <span aria-hidden>{recordText(fighter)}</span>
                                    <span className="sr-only">{recordSpoken(fighter, t)}</span>
                                </>
                            ) : (
                                notRecorded
                            ),
                        },
                        { label: t("account.fightProfile.height"), value: fighter.heightCm === null ? notRecorded : `${fighter.heightCm} cm` },
                        { label: t("account.fightProfile.reach"), value: fighter.reachCm === null ? notRecorded : `${fighter.reachCm} cm` },
                        { label: t("account.fightProfile.nationality"), value: fighter.nationality },
                    ]}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Body metrics ────────────────────────────────────────────────────────── */

/** `canLog` offers the fighter's own weigh-in log; off while body metrics can't be saved. */
export function BodyMetricsCard({ fighter, canLog, locale = "en" }: { fighter: Fighter; canLog: boolean; locale?: Locale }) {
    const t = createTranslator(locale);
    const classLabel = weightClassLabel(fighter.weightClass, locale);
    const gap = fighter.weightKg === null ? null : Number((fighter.weightKg - fighter.targetWeightKg).toFixed(1));
    const notRecorded = t("account.profile.notRecorded");

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("account.bodyMetrics.title")}
                icon={<Activity />}
                description={canLog ? t("account.bodyMetrics.descriptionCanLog") : t("account.bodyMetrics.descriptionReadOnly")}
                action={
                    canLog && (
                        <BodyMetricsDialog
                            weightKg={fighter.weightKg}
                            bodyFatPct={fighter.bodyFatPct}
                            restingHeartRate={fighter.restingHeartRate}
                            targetWeightKg={fighter.targetWeightKg}
                            weightClassLabel={classLabel}
                        />
                    )
                }
                className="flex-col sm:flex-row"
            />
            <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MetricTile
                        label={t("account.bodyMetrics.currentWeight")}
                        value={fighter.weightKg === null ? notRecorded : formatNumber(fighter.weightKg, 1)}
                        unit={fighter.weightKg === null ? undefined : "kg"}
                        hint={gap === null ? undefined : gap > 0 ? t("account.bodyMetrics.toCut", { gap: formatNumber(gap, 1) }) : t("account.bodyMetrics.onWeight")}
                    />
                    <MetricTile label={t("account.bodyMetrics.targetWeight")} value={formatNumber(fighter.targetWeightKg, 1)} unit="kg" hint={t("account.bodyMetrics.limit", { classLabel })} />
                    <MetricTile
                        label={t("account.bodyMetrics.bodyFat")}
                        value={fighter.bodyFatPct === null ? notRecorded : formatNumber(fighter.bodyFatPct, 1)}
                        unit={fighter.bodyFatPct === null ? undefined : "%"}
                    />
                    <MetricTile
                        label={t("account.bodyMetrics.restingHeartRate")}
                        value={fighter.restingHeartRate ?? notRecorded}
                        unit={fighter.restingHeartRate === null ? undefined : "bpm"}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Care team ───────────────────────────────────────────────────────────── */

export function CareTeamCard({ coaches, doctors, primaryCoachId, locale = "en" }: { coaches: Coach[]; doctors: Doctor[]; primaryCoachId: string | null; locale?: Locale }) {
    const t = createTranslator(locale);

    return (
        <Card className="min-w-0">
            <CardHeader title={t("account.careTeam.title")} icon={<Users />} description={t("account.careTeam.description")} />
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                <TeamSection
                    id="care-team-coaches"
                    heading={t("account.careTeam.coaches")}
                    emptyText={t("account.careTeam.noCoaches")}
                    people={coaches.map((coach) => ({
                        id: coach.id,
                        name: coach.name,
                        detail: coach.specialty,
                        badge: coach.id === primaryCoachId ? t("account.careTeam.primaryCoach") : null,
                    }))}
                />
                <TeamSection
                    id="care-team-doctors"
                    heading={t("account.careTeam.doctors")}
                    emptyText={t("account.careTeam.noDoctors")}
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
