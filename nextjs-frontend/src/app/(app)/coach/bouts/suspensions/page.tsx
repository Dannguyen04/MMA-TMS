import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BoutPhaseBadge, SuspensionStateBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { isActivePhase, type Suspension } from "@/lib/domain/bout";
import { canClearSuspension, isSuspensionActive, suspensionDays, suspensionState, type SuspensionState } from "@/lib/domain/suspension-rules";
import { dayKey, formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listCampBouts, listSuspensions } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";
import { ClearSuspensionButton, SuspensionDialogButton } from "../suspension-dialogs";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("coachBouts.suspensions.title") };
}

const STATE_ORDER: Record<SuspensionState, number> = { AWAITING_CLEARANCE: 0, ACTIVE: 1, UPCOMING: 2, CLEARED: 3, ENDED: 4 };

/** Gate 2 and readiness (F7, H7): who is suspended, who waits for clearance, and who can take a new bout. */
export default async function SuspensionsPage() {
    const user = await requireRole("coach");
    const { t, locale } = await getTranslator();
    const scope = accessibleFighterIds(user);
    const todayOn = dayKey(new Date());
    const [fighters, suspensions, bouts] = await Promise.all([listFighters(user), listSuspensions(scope), listCampBouts(scope)]);
    const names = new Map(fighters.map((fighter) => [fighter.id, fighter.name]));
    const rows = suspensions
        .map((item) => ({ item, state: suspensionState(item, todayOn) }))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.item.endsOn < b.item.endsOn ? -1 : 1));
    const fighterOptions = fighters.map((fighter) => ({ id: fighter.id, name: fighter.name }));
    const newSuspension = <SuspensionDialogButton fighters={fighterOptions} defaultBlocked={["sparring"]} startsOn={todayOn} label={t("coachBouts.suspensions.new")} />;

    return (
        <>
            <PageHeader title={t("coachBouts.suspensions.title")} description={t("coachBouts.suspensions.description")} actions={newSuspension} />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="min-w-0 lg:col-span-2">
                    {rows.length === 0 ? (
                        <EmptyState icon={<ShieldCheck />} title={t("coachBouts.suspensions.emptyTitle")} description={t("coachBouts.suspensions.emptyDescription")} />
                    ) : (
                        <Card>
                            <CardHeader title={t("coachBouts.suspensions.listTitle")} description={t("coachBouts.suspensions.listDescription")} />
                            <CardContent>
                                <ul className="divide-y divide-border">
                                    {rows.map(({ item, state }) => (
                                        <SuspensionRow
                                            key={item.id}
                                            item={item}
                                            state={state}
                                            fighterName={names.get(item.fighterId) ?? t("coachBouts.common.fighterFallback")}
                                            todayOn={todayOn}
                                            t={t}
                                            locale={locale}
                                        />
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <Card className="min-w-0">
                    <CardHeader title={t("coachBouts.suspensions.readyTitle")} description={t("coachBouts.suspensions.readyDescription")} />
                    <CardContent>
                        <ul className="divide-y divide-border">
                            {fighters.map((fighter) => {
                                const active = bouts.find((bout) => bout.fighterId === fighter.id && isActivePhase(bout.phase));
                                const suspended = suspensions.find((item) => item.fighterId === fighter.id && isSuspensionActive(item, todayOn));
                                return (
                                    <li key={fighter.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <Avatar name={fighter.name} size="xs" shape="octagon" />
                                            <span className="truncate text-fg">{fighter.name}</span>
                                        </span>
                                        {suspended ? (
                                            <SuspensionStateBadge state={suspensionState(suspended, todayOn)} size="sm" locale={locale} />
                                        ) : active ? (
                                            <Link href={routes.coach.bout(active.id)} aria-label={`${fighter.name}: ${active.event}`}>
                                                <BoutPhaseBadge phase={active.phase} size="sm" locale={locale} />
                                            </Link>
                                        ) : (
                                            <Badge tone="success" icon={ShieldCheck} size="sm">
                                                {t("coachBouts.suspensions.ready")}
                                            </Badge>
                                        )}
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

function SuspensionRow({
    item,
    state,
    fighterName,
    todayOn,
    t,
    locale,
}: {
    item: Suspension;
    state: SuspensionState;
    fighterName: string;
    todayOn: string;
    t: Translator;
    locale: Locale;
}) {
    const types = item.blockedSessionTypes.map((type) => t(`trainingType.${type}`).toLowerCase()).join(", ");
    return (
        <li className="flex flex-col gap-2 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={fighterName} size="sm" shape="octagon" />
                    <span className="min-w-0">
                        <span className="block font-medium text-fg">{fighterName}</span>
                        <span className="block text-sm text-fg-muted">
                            {t("coachBouts.suspensions.period", {
                                reason: t(`boutLabel.suspensionReason.${item.reason}`),
                                start: formatDate(item.startsOn, locale),
                                end: formatDate(item.endsOn, locale),
                                days: suspensionDays(item),
                            })}
                        </span>
                    </span>
                </span>
                <SuspensionStateBadge state={state} locale={locale} />
            </div>
            <p className="text-[13px] text-fg-muted">
                {t(item.requiresClearance && !item.clearedAt ? "coachBouts.suspensions.blocksNeedsClearance" : "coachBouts.suspensions.blocks", { types })}
                {item.lossOfConsciousness &&
                    item.lossOfConsciousness !== "NONE" &&
                    ` ${t("coachBouts.suspensions.lostConsciousness", { duration: t(`boutLabel.loc.${item.lossOfConsciousness}`).toLowerCase() })}`}
            </p>
            {item.overrideReason && (
                <p className="text-[13px] text-fg-muted">{t("coachBouts.suspensions.override", { n: item.suggestedDays ?? "", reason: item.overrideReason })}</p>
            )}
            {item.note && <p className="text-[13px] text-fg-muted">{item.note}</p>}
            {item.clearedAt && (
                <p className="text-[13px] text-fg-muted">
                    {t("coachBouts.suspensions.cleared", { name: item.clearedBy ?? "", date: formatDateTime(item.clearedAt, locale), note: item.clearanceNote ?? "" })}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
                {item.boutId && (
                    <Link href={routes.coach.bout(item.boutId)} className="text-sm font-medium text-primary-soft-fg hover:underline">
                        {t("coachBouts.suspensions.openBout")}
                    </Link>
                )}
                {canClearSuspension(item, todayOn) && <ClearSuspensionButton suspensionId={item.id} fighterName={fighterName} />}
            </div>
        </li>
    );
}
