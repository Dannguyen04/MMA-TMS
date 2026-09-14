import { Bandage, CalendarClock, ClipboardPlus, Radar, ShieldCheck, ShieldQuestion, ShieldX, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { AINotice } from "@/components/domain/ai-notice";
import { CardLink } from "@/components/dashboard/card-link";
import { AIGeneratedBadge, ConfidenceBadge } from "@/components/domain/status-badges";
import { AIObservationList } from "@/components/medical/ai-observation-list";
import { AttentionList, type AttentionItem } from "@/components/medical/attention-list";
import { ExaminationList } from "@/components/medical/examination-list";
import { FollowUpList, followUpExaminationHref } from "@/components/medical/follow-up-list";
import { HealthBreakdown } from "@/components/medical/health-breakdown";
import { RosterHealthBoard } from "@/components/medical/roster-health-board";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, EXAMINATION_TYPE_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import { daysBetween, formatDate, formatRelative, formatWeekdayDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getDoctorOverview, getFighterHealthSummary, type DoctorOverview, type FighterHealthSummary } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Clinical overview" };

/** Bouts this close make the pre-fight medical the right next step for an expiring clearance. */
const PRE_FIGHT_WINDOW_DAYS = 30;
const AI_PREVIEW_LIMIT = 3;
const FOLLOW_UP_PREVIEW_LIMIT = 6;

export default async function DoctorDashboardPage() {
    const user = await requireRole("doctor");
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    // Doctors are always scoped to their assigned fighters, so the summaries load alongside the list.
    const [overview, fighters, settings, loaded] = await Promise.all([
        getDoctorOverview(scope, now),
        listFighters(user),
        getSettings(),
        Promise.all((scope === "all" ? [] : scope).map((fighterId) => getFighterHealthSummary(fighterId, now))),
    ]);
    const summaryById = new Map(loaded.flatMap((summary) => (summary ? [[summary.fighter.id, summary] as const] : [])));
    const summaries = fighters.flatMap((fighter) => summaryById.get(fighter.id) ?? []);
    const withoutClearance = overview.fightersWithoutClearance.length;

    const warningDays = settings.clearanceExpiryWarningDays;
    const attention = buildAttentionItems(overview, summaries, now);
    const followUps = summaries
        .flatMap((summary) => (summary.nextFollowUp ? [summary.nextFollowUp] : []))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, FOLLOW_UP_PREVIEW_LIMIT);
    const recovering = overview.activeInjuries.filter(({ injury }) => injury.status === "recovering").length;

    return (
        <>
            <PageHeader
                eyebrow="Sports medicine"
                title="Clinical overview"
                description={`${user.name} · ${pluralize(fighters.length, "assigned fighter")} · ${formatWeekdayDate(now)}`}
                actions={
                    <>
                        <ButtonLink href={routes.doctor.grantClearance} variant="secondary">
                            <ShieldCheck aria-hidden />
                            Update clearance
                        </ButtonLink>
                        <ButtonLink href={routes.doctor.newExamination}>
                            <ClipboardPlus aria-hidden />
                            New examination
                        </ButtonLink>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Assigned fighters" value={fighters.length} icon={<Users />} href={routes.doctor.fighters}>
                        <HealthBreakdown counts={overview.healthCounts} />
                    </StatCard>
                    <StatCard
                        label="Active injuries"
                        value={overview.activeInjuries.length}
                        icon={<Bandage />}
                        href={routes.doctor.injuries}
                        hint={
                            overview.activeInjuries.length === 0
                                ? "No open injuries"
                                : `${overview.activeInjuries.length - recovering} active · ${recovering} recovering`
                        }
                    />
                    <StatCard
                        label={`Clearances expiring ≤ ${warningDays} days`}
                        value={overview.expiringClearances.length}
                        icon={<CalendarClock />}
                        href={`${routes.doctor.clearance}?view=expiring`}
                        hint={
                            withoutClearance > 0
                                ? `+ ${withoutClearance} expired or missing`
                                : "All other clearances valid"
                        }
                    />
                    <StatCard
                        label="New AI observations"
                        value={overview.newAlerts.length}
                        icon={<Radar />}
                        href={routes.doctor.aiAlerts}
                        hint={overview.newAlerts.length > 0 ? "Awaiting your review" : "Nothing new to review"}
                    />
                </section>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader
                            title="Needs attention"
                            description={
                                attention.length > 0
                                    ? `${pluralize(attention.length, "item")}, most urgent first`
                                    : "Clearance, follow-ups and AI observations are all up to date"
                            }
                        />
                        <AttentionList items={attention} className="border-t border-border" />
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader
                            title="Upcoming follow-ups"
                            description="Set on each fighter's latest examination"
                            icon={<CalendarClock />}
                        />
                        <FollowUpList followUps={followUps} className="border-t border-border" />
                    </Card>
                </div>

                <Card className="min-w-0">
                    <CardHeader
                        title="Roster health board"
                        description="Every assigned fighter's health, clearance, open injuries and next follow-up"
                        action={<CardLink href={routes.doctor.fighters}>All fighters</CardLink>}
                    />
                    <div className="border-t border-border md:border-t-0">
                        <RosterHealthBoard summaries={summaries} now={now} warningDays={warningDays} />
                    </div>
                </Card>

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader
                            title="Recent examinations"
                            action={<CardLink href={routes.doctor.examinations}>All examinations</CardLink>}
                        />
                        <ExaminationList
                            items={overview.recentExaminations.map(({ examination, fighter }) => ({ examination, fighterName: fighter.name }))}
                            className="border-t border-border"
                        />
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader
                            title="AI observations"
                            icon={<Sparkles />}
                            action={<CardLink href={routes.doctor.aiAlerts}>All observations</CardLink>}
                        />
                        <div className="flex flex-col gap-3 px-5 pb-5">
                            <AINotice audience="doctor" compact />
                            <AIObservationList
                                observations={overview.newAlerts
                                    .slice(0, AI_PREVIEW_LIMIT)
                                    .map(({ alert, fighter }) => ({ alert, fighterName: fighter.name }))}
                                now={now}
                                emptyTitle="No new AI observations"
                            />
                            {overview.newAlerts.length > AI_PREVIEW_LIMIT && (
                                <p className="text-[13px] text-fg-muted">
                                    {pluralize(overview.newAlerts.length - AI_PREVIEW_LIMIT, "more observation")} waiting in{" "}
                                    <Link href={routes.doctor.aiAlerts} className="font-medium text-primary-soft-fg hover:underline">
                                        AI alerts
                                    </Link>
                                    .
                                </p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}

/** Orders what needs the doctor first: training blocked, clearance gaps, lapsing clearances, follow-ups, then new AI observations. */
function buildAttentionItems(overview: DoctorOverview, summaries: FighterHealthSummary[], now: string): AttentionItem[] {
    const items: AttentionItem[] = [];
    const profile = (fighterId: string) => routes.doctor.fighter(fighterId);
    const grant = (fighterId: string) => `${routes.doctor.grantClearance}?fighter=${fighterId}`;
    const examine = (fighterId: string, type: string) => `${routes.doctor.newExamination}?fighter=${fighterId}&type=${type}`;

    for (const summary of summaries) {
        if (summary.clearanceState !== "not_cleared" || !summary.clearance) continue;
        const injury = summary.activeInjuries[0];
        items.push({
            id: `not-cleared-${summary.fighter.id}`,
            tone: "danger",
            icon: ShieldX,
            kind: "Not cleared",
            fighterName: summary.fighter.name,
            fighterHref: profile(summary.fighter.id),
            title: injury
                ? `No training permitted — ${INJURY_TYPE_LABELS[injury.type].toLowerCase()} (${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()})`
                : "No training permitted until re-examined",
            detail:
                summary.clearance.status === "revoked"
                    ? `Clearance revoked ${formatDate(summary.clearance.revokedAt ?? summary.clearance.issuedAt)}`
                    : `Not cleared since ${formatDate(summary.clearance.issuedAt)}`,
            action: { href: profile(summary.fighter.id), label: "Review patient" },
        });
    }

    for (const { fighter, state } of overview.fightersWithoutClearance) {
        const summary = summaries.find((s) => s.fighter.id === fighter.id);
        if (state === "expired") {
            const lapsed = summary?.clearance?.validUntil;
            items.push({
                id: `expired-${fighter.id}`,
                tone: "danger",
                icon: ShieldX,
                kind: "Clearance expired",
                fighterName: fighter.name,
                fighterHref: profile(fighter.id),
                title: "Training is blocked until the clearance is renewed",
                detail: lapsed ? `Expired ${describeDaysUntil(daysBetween(now, lapsed))}` : "Expired",
                action: { href: grant(fighter.id), label: "Renew clearance" },
            });
        } else {
            const examined = Boolean(summary?.latestExamination);
            items.push({
                id: `none-${fighter.id}`,
                tone: "warning",
                icon: ShieldQuestion,
                kind: "No clearance",
                fighterName: fighter.name,
                fighterHref: profile(fighter.id),
                title: "No Medical Clearance on file — coaches can't check training against it",
                detail: examined ? "Examined, clearance not yet issued" : `Joined ${formatRelative(fighter.joinedAt, now)} · no examinations yet`,
                action: examined
                    ? { href: grant(fighter.id), label: "Issue clearance" }
                    : { href: examine(fighter.id, "baseline"), label: "Start baseline exam" },
            });
        }
    }

    for (const { fighter, clearance, daysRemaining } of overview.expiringClearances) {
        const bout = fighter.upcomingBout;
        const boutSoon = bout !== null && daysBetween(now, bout.date) <= PRE_FIGHT_WINDOW_DAYS;
        items.push({
            id: `expiring-${fighter.id}`,
            tone: "warning",
            icon: CalendarClock,
            kind: "Clearance expiring",
            fighterName: fighter.name,
            fighterHref: profile(fighter.id),
            title: `${clearance.level === "restricted" ? "Restricted clearance" : "Full clearance"} expires ${describeDaysUntil(daysRemaining)}`,
            detail: boutSoon && bout ? `Fights ${describeDaysUntil(daysBetween(now, bout.date))} — pre-fight medical due` : `Valid until ${formatDate(clearance.validUntil ?? now)}`,
            action: boutSoon
                ? { href: examine(fighter.id, "pre_fight"), label: "Start pre-fight medical" }
                : { href: grant(fighter.id), label: "Renew clearance" },
        });
    }

    for (const followUp of overview.followUpsDue) {
        const overdue = followUp.daysUntil < 0;
        items.push({
            id: `follow-up-${followUp.examination.id}`,
            tone: overdue ? "danger" : "info",
            icon: CalendarClock,
            kind: overdue ? "Follow-up overdue" : "Follow-up due",
            fighterName: followUp.fighter.name,
            fighterHref: profile(followUp.fighter.id),
            title: overdue
                ? `Follow-up examination overdue by ${pluralize(-followUp.daysUntil, "day")}`
                : `${capitalize(describeDaysUntil(followUp.daysUntil))}: follow-up examination`,
            detail: `Set at the ${EXAMINATION_TYPE_LABELS[followUp.examination.type].toLowerCase()} on ${formatDate(followUp.examination.date)}`,
            action: { href: followUpExaminationHref(followUp), label: "Start examination" },
        });
    }

    for (const { alert, fighter } of overview.newAlerts) {
        items.push({
            id: `alert-${alert.id}`,
            tone: "ai",
            icon: Radar,
            kind: "AI observation",
            badges: (
                <>
                    <AIGeneratedBadge size="sm" />
                    <ConfidenceBadge confidence={alert.confidence} size="sm" />
                </>
            ),
            fighterName: fighter.name,
            fighterHref: profile(fighter.id),
            title: alert.pattern,
            detail: `${BODY_REGION_LABELS[alert.bodyRegion]} · observed ${formatRelative(alert.detectedAt, now)}`,
            action: { href: routes.doctor.aiAlert(alert.id), label: "Review observation" },
        });
    }

    return items;
}
