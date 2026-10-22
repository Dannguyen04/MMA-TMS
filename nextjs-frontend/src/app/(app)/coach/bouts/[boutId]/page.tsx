import { CalendarClock, CheckCircle2, CircleSlash, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { CampWeightCard } from "@/components/domain/camp-weight-card";
import { NutritionPlanForm } from "@/components/domain/nutrition-plan-form";
import { BoutPhaseBadge, Gate1Badge, SuspensionStateBadge, WeightStatusBadge } from "@/components/domain/status-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { boutLimitKg, isRunningPhase, type CampBout, type Suspension } from "@/lib/domain/bout";
import {
    boutGate1,
    boutOn,
    canCancel,
    canEditSchedule,
    canEnterFightWeek,
    canRecordResult,
    checklistLocked,
    fightWeekOpensOn,
    requirementsDueOn,
    requirementsOverdue,
    weighInOn,
} from "@/lib/domain/bout-rules";
import { weighInCountdown } from "@/lib/domain/nutrition";
import { describeRule, suggestSuspension, suspensionReasonFor, suspensionState } from "@/lib/domain/suspension-rules";
import { kgLabel } from "@/lib/domain/weight-input";
import { dayKey, daysBetweenKeys, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getCampBout, getRuleset, getWeightTrack, knockoutHistory, listSuspensions, wayOffForBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { getPlan, listPlans } from "@/lib/services/training";
import { param } from "@/lib/utils";
import { CancelBoutButton, EditBoutButton, EnterFightWeekForm, LinkCampButton, ResultButton, WeighInButton } from "./bout-actions";
import { MedicalChecklist } from "./medical-checklist";
import { SuspensionDialogButton } from "../suspension-dialogs";

const loadBout = cache(getCampBout);

const NOTICES: Record<"created" | "created-suspended" | "fight-week" | "plan", { title: MessageKey; description?: MessageKey }> = {
    created: { title: "boutDetail.notice.created", description: "boutDetail.notice.createdDescription" },
    "created-suspended": { title: "boutDetail.notice.created", description: "boutDetail.notice.createdSuspended" },
    "fight-week": { title: "boutDetail.notice.fightWeek", description: "boutDetail.notice.fightWeekDescription" },
    plan: { title: "boutDetail.notice.planSaved" },
};

/** The viewer's translator and language, passed to the cards below. */
interface Lang {
    t: Translator;
    locale: Locale;
}

export async function generateMetadata({ params }: PageProps<"/coach/bouts/[boutId]">): Promise<Metadata> {
    const [{ boutId }, { t }] = await Promise.all([params, getTranslator()]);
    const bout = await loadBout(boutId);
    return { title: bout ? bout.event : t("boutDetail.metaTitle") };
}

export default async function CoachBoutPage({ params, searchParams }: PageProps<"/coach/bouts/[boutId]">) {
    const user = await requireRole("coach");
    const { boutId } = await params;
    const query = await searchParams;
    const bout = await loadBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) notFound();

    const { t, locale } = await getTranslator();
    const now = new Date();
    const todayOn = dayKey(now);
    const [track, fighter, wayOff, ruleset, plans, linkedPlan, suspensions, priorKnockouts] = await Promise.all([
        getWeightTrack(bout.id, now),
        getFighter(bout.fighterId),
        wayOffForBout(bout.id, todayOn),
        getRuleset(bout.rulesetId),
        bout.phase === "SCHEDULED" ? listPlans({ fighterIds: [bout.fighterId] }) : [],
        bout.trainingPlanId ? getPlan(bout.trainingPlanId) : null,
        listSuspensions([bout.fighterId]),
        knockoutHistory(bout.fighterId),
    ]);
    const fighterName = fighter?.name ?? t("boutDetail.fighterFallback");
    const gate = boutGate1(bout);
    const dueOn = requirementsDueOn(bout);
    const overdue = requirementsOverdue(bout, todayOn);
    const limit = boutLimitKg(bout);
    const notice = param(query.notice);
    const flashKeys = notice && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;
    const flash = flashKeys ? { title: t(flashKeys.title), description: flashKeys.description ? t(flashKeys.description) : undefined } : null;
    const campPlans = plans
        .filter((plan) => plan.phase === "fight_camp" && plan.status !== "archived")
        .map((plan) => ({
            id: plan.id,
            title: plan.title,
            period: `${formatDate(plan.startDate, locale)} – ${plan.endDate ? formatDate(plan.endDate, locale) : t("boutDetail.planOpenEnded")}`,
        }));
    const boutSuspensions = suspensions.filter((item) => item.boutId === bout.id);
    const lang: Lang = { t, locale };

    return (
        <>
            <FlashToast notice={flash ? { ...flash, tone: "success" } : null} cleanHref={routes.coach.bout(bout.id)} />
            <PageHeader
                eyebrow={t("boutDetail.header.eyebrow")}
                back={{ href: routes.coach.bouts, label: t("boutDetail.header.back") }}
                title={bout.event}
                description={`${fighterName} · ${bout.opponent ?? t("boutDetail.header.opponentTba")}`}
                meta={
                    <>
                        <BoutPhaseBadge phase={bout.phase} locale={locale} />
                        {track && isRunningPhase(bout.phase) && <WeightStatusBadge status={track.status} locale={locale} />}
                    </>
                }
                actions={
                    (canEditSchedule(bout.phase) || canCancel(bout.phase)) && (
                        <>
                            {canEditSchedule(bout.phase) && <EditBoutButton bout={bout} ruleset={ruleset} todayOn={todayOn} />}
                            {canCancel(bout.phase) && <CancelBoutButton bout={bout} />}
                        </>
                    )
                }
            />

            <Card className="mb-6">
                <CardContent className="pt-5">
                    <DescriptionList
                        columns={3}
                        className="grid-cols-2"
                        items={[
                            {
                                label: bout.catchweightKg === null ? t("boutDetail.summary.weightClass") : t("boutDetail.common.catchweight"),
                                value:
                                    bout.catchweightKg === null
                                        ? `${bout.weightClassLabel}${limit === null ? ` ${t("boutDetail.summary.noUpperLimit")}` : ""}`
                                        : t("boutDetail.summary.catchweightValue", { kg: kgLabel(bout.catchweightKg), weightClass: bout.weightClassLabel }),
                            },
                            { label: t("boutDetail.summary.weighIn"), value: formatDateTime(bout.weighInAt, locale) },
                            { label: t("boutDetail.summary.bout"), value: formatDateTime(bout.boutAt, locale) },
                            { label: t("boutDetail.summary.countdown"), value: isRunningPhase(bout.phase) ? weighInCountdown(daysBetweenKeys(todayOn, weighInOn(bout)), t) : "—" },
                            {
                                label: t("boutDetail.summary.documentsDue"),
                                value: (
                                    <>
                                        {formatDate(dueOn, locale)}
                                        {overdue && <span className="text-danger-fg"> · {t("boutDetail.summary.late")}</span>}
                                    </>
                                ),
                            },
                            {
                                label: t("boutDetail.summary.acuteLossLimit"),
                                value: t("boutDetail.summary.acuteLossValue", { pct: formatNumber(bout.acuteLossLimitPct), days: bout.acuteWindowDays }),
                            },
                            {
                                label: t("boutDetail.summary.ruleset"),
                                value: (
                                    <>
                                        {bout.rulesetName}
                                        {!bout.rulesetVerified && (
                                            <span className="block text-[13px] font-normal text-fg-muted">
                                                {ruleset?.weightClasses.length ? t("boutDetail.summary.referenceOnly") : t("boutDetail.coachEntered")}
                                            </span>
                                        )}
                                    </>
                                ),
                            },
                            { label: t("boutDetail.summary.venue"), value: bout.venue ?? "—" },
                            {
                                label: t("boutDetail.summary.campPlan"),
                                value: linkedPlan ? (
                                    <Link href={routes.coach.plan(linkedPlan.id)} className="text-primary-soft-fg hover:underline">
                                        {linkedPlan.title}
                                    </Link>
                                ) : (
                                    t("boutDetail.summary.notLinked")
                                ),
                            },
                            ...(bout.notes ? [{ label: t("boutDetail.common.notes"), value: bout.notes, wide: true }] : []),
                        ]}
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <NextStepCard bout={bout} todayOn={todayOn} gateMissing={gate.missing.length} campPlans={campPlans} fighterName={fighterName} lang={lang} />
                    {track && isRunningPhase(bout.phase) && <CampWeightCard track={track} wayOff={wayOff} locale={locale} />}
                    <MedicalChecklist
                        boutId={bout.id}
                        requirements={bout.requirements}
                        boutDay={boutOn(bout)}
                        dueOn={dueOn}
                        overdue={overdue}
                        locked={checklistLocked(bout)}
                        canUnlock={bout.phase === "FIGHT_WEEK" || bout.phase === "WEIGHED_IN"}
                        unlock={bout.checklistUnlock}
                        editable={isRunningPhase(bout.phase)}
                    />
                    {isRunningPhase(bout.phase) && (
                        <Card>
                            <CardHeader title={t("boutDetail.mealPlan.title")} description={t("boutDetail.mealPlan.description")} />
                            <CardContent>
                                <NutritionPlanForm boutId={bout.id} plan={bout.nutritionPlan} authorName={user.name} />
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <GateCard bout={bout} todayOn={todayOn} lang={lang} />
                    {(bout.weighIn || bout.outcome) && <ResultCard bout={bout} lang={lang} />}
                    {bout.phase === "COMPLETED" && (
                        <SuspensionCard bout={bout} suspensions={boutSuspensions} todayOn={todayOn} ruleset={ruleset} priorKnockouts={priorKnockouts} lang={lang} />
                    )}
                    <HistoryCard bout={bout} lang={lang} />
                </div>
            </div>
        </>
    );
}

/* ─── Next step by phase ──────────────────────────────────────────────────── */

function NextStepCard({
    bout,
    todayOn,
    gateMissing,
    campPlans,
    fighterName,
    lang: { t, locale },
}: {
    bout: CampBout;
    todayOn: string;
    gateMissing: number;
    campPlans: { id: string; title: string; period: string }[];
    fighterName: string;
    lang: Lang;
}) {
    if (bout.phase === "SCHEDULED") {
        return (
            <Card>
                <CardHeader title={t("boutDetail.next.startCamp.title")} description={t("boutDetail.next.startCamp.description")} />
                <CardContent>
                    <LinkCampButton bout={bout} plans={campPlans} fighterName={fighterName} />
                </CardContent>
            </Card>
        );
    }
    if (bout.phase === "CAMP") {
        const check = canEnterFightWeek(bout, todayOn);
        const opensOn = fightWeekOpensOn(bout);
        const early = !check.ok && check.reason === "TOO_EARLY";
        return (
            <Card>
                <CardHeader
                    title={t("boutDetail.next.fightWeek.title")}
                    description={
                        early
                            ? t("boutDetail.next.fightWeek.opensOn", { date: formatDate(opensOn, locale), days: bout.fightWeekDays })
                            : t("boutDetail.next.fightWeek.openSince", { date: formatDate(opensOn, locale) })
                    }
                    action={<Gate1Badge missing={gateMissing} overdue={requirementsOverdue(bout, todayOn)} locale={locale} />}
                />
                <CardContent>
                    <EnterFightWeekForm boutId={bout.id} />
                </CardContent>
            </Card>
        );
    }
    if (bout.phase === "FIGHT_WEEK") {
        return (
            <Card>
                <CardHeader title={t("boutDetail.weighIn.title")} description={t("boutDetail.next.weighIn.description", { date: formatDateTime(bout.weighInAt, locale) })} />
                <CardContent>
                    <WeighInButton bout={bout} />
                </CardContent>
            </Card>
        );
    }
    if (bout.phase === "WEIGHED_IN") {
        const check = canRecordResult(bout, todayOn);
        return (
            <Card>
                <CardHeader title={t("boutDetail.common.result")} description={t("boutDetail.next.result.description", { date: formatDateTime(bout.boutAt, locale) })} />
                <CardContent>
                    {check.ok ? (
                        <ResultButton bout={bout} />
                    ) : (
                        <InlineNote icon={CalendarClock}>{t("boutDetail.next.result.notYet", { date: formatDate(bout.boutAt, locale) })}</InlineNote>
                    )}
                </CardContent>
            </Card>
        );
    }
    if (bout.phase === "CANCELLED") {
        return (
            <Callout
                tone="neutral"
                icon={CircleSlash}
                title={bout.cancelReason ? t("boutDetail.next.cancelledWithReason", { reason: t(`boutLabel.cancelReason.${bout.cancelReason}`) }) : t("boutDetail.next.cancelled")}
            >
                {bout.cancelNote ?? t("boutDetail.next.cancelledKept")}
            </Callout>
        );
    }
    return null;
}

/* ─── Side column ─────────────────────────────────────────────────────────── */

function GateCard({ bout, todayOn, lang: { t, locale } }: { bout: CampBout; todayOn: string; lang: Lang }) {
    const gate = boutGate1(bout);
    const relevant = bout.phase === "SCHEDULED" || bout.phase === "CAMP";
    if (!relevant) return null;
    if (bout.requirements.length === 0) {
        return (
            <Callout tone="info" icon={Info} title={t("boutDetail.gate.noDocuments.title")}>
                {t("boutDetail.gate.noDocuments.text")}
            </Callout>
        );
    }
    return gate.passed ? (
        <Callout tone="success" icon={ShieldCheck} title={t("boutDetail.gate.met.title")}>
            {t("boutDetail.gate.met.text", { date: formatDate(bout.boutAt, locale) })}
        </Callout>
    ) : (
        <Callout tone={requirementsOverdue(bout, todayOn) ? "danger" : "warning"} icon={ShieldAlert} title={t("boutDetail.gate.notMet.title")}>
            <ul className="mt-1 list-disc pl-5">
                {gate.missing.map((gap) => (
                    <li key={gap.requirement.code}>
                        {gap.requirement.label}: {t(`boutLabel.gate1Reason.${gap.reason}`)}
                    </li>
                ))}
            </ul>
        </Callout>
    );
}

function ResultCard({ bout, lang: { t } }: { bout: CampBout; lang: Lang }) {
    const items = [];
    if (bout.weighIn) {
        items.push({
            label: t("boutDetail.common.officialWeight"),
            value: `${formatNumber(bout.weighIn.weightKg, 1)} kg · ${bout.weighIn.madeWeight ? t("boutDetail.resultCard.madeWeight") : t("boutDetail.resultCard.missed")}`,
        });
        if (bout.weighIn.hydrationCheck) items.push({ label: t("boutDetail.common.hydrationCheck"), value: t(`boutLabel.hydration.${bout.weighIn.hydrationCheck}`) });
        if (bout.weighIn.catchweightNote) items.push({ label: t("boutDetail.resultCard.catchweightNote"), value: bout.weighIn.catchweightNote });
    }
    if (bout.outcome) {
        const outcome = bout.outcome;
        items.push({
            label: t("boutDetail.common.result"),
            value: `${t(`boutLabel.result.${outcome.result}`)} · ${t(`boutLabel.method.${outcome.method}`)}${outcome.round ? `, ${t("boutDetail.resultCard.round", { n: outcome.round })}` : ""}`,
        });
        if (outcome.lossOfConsciousness) items.push({ label: t("boutDetail.resultCard.lostConsciousness"), value: t(`boutLabel.loc.${outcome.lossOfConsciousness}`) });
        if (outcome.stoppedByHeadStrikes !== null)
            items.push({ label: t("boutDetail.resultCard.stoppedByHeadStrikes"), value: outcome.stoppedByHeadStrikes ? t("boutDetail.common.yes") : t("boutDetail.common.no") });
        items.push({ label: t("boutDetail.resultCard.knockedDown"), value: outcome.knockedDown ? t("boutDetail.common.yes") : t("boutDetail.common.no") });
        if (outcome.injuryNote) items.push({ label: t("boutDetail.resultCard.injuries"), value: outcome.injuryNote });
        if (outcome.notes) items.push({ label: t("boutDetail.common.notes"), value: outcome.notes });
    }
    return (
        <Card>
            <CardHeader title={bout.outcome ? t("boutDetail.common.result") : t("boutDetail.resultCard.weighInTitle")} />
            <CardContent>
                <DescriptionList columns={1} items={items} />
            </CardContent>
        </Card>
    );
}

function SuspensionCard({
    bout,
    suspensions,
    todayOn,
    ruleset,
    priorKnockouts,
    lang: { t, locale },
}: {
    bout: CampBout;
    suspensions: Suspension[];
    todayOn: string;
    ruleset: Awaited<ReturnType<typeof getRuleset>>;
    priorKnockouts: string[];
    lang: Lang;
}) {
    const reason = bout.outcome ? suspensionReasonFor(bout.outcome) : null;
    if (!reason && suspensions.length === 0) {
        return (
            <Callout tone="success" icon={CheckCircle2} title={t("boutDetail.suspension.none.title")}>
                {t("boutDetail.suspension.none.text")}
            </Callout>
        );
    }
    const needsConfirmation = reason !== null && !suspensions.some((item) => item.reason !== "MANDATORY_REST");
    const suggestion =
        needsConfirmation && reason && ruleset
            ? suggestSuspension(ruleset.suspensionRules, {
                  reason,
                  lossOfConsciousness: bout.outcome?.lossOfConsciousness ?? null,
                  priorKnockoutStarts: priorKnockouts,
                  on: boutOn(bout),
              })
            : null;

    return (
        <Card>
            <CardHeader
                title={t("boutDetail.suspension.title")}
                description={
                    needsConfirmation
                        ? suggestion
                            ? t("boutDetail.suspension.suggested", { days: suggestion.days, rule: describeRule(suggestion.rule, t) })
                            : t("boutDetail.suspension.noRule")
                        : undefined
                }
            />
            <CardContent className="flex flex-col gap-3">
                {suspensions.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                            {t(`boutLabel.suspensionReason.${item.reason}`)}: {formatDate(item.startsOn, locale)} – {formatDate(item.endsOn, locale)}
                            <SuspensionStateBadge state={suspensionState(item, todayOn)} size="sm" locale={locale} />
                        </p>
                        <p className="text-fg-muted">
                            {t("boutDetail.suspension.blocks", { types: item.blockedSessionTypes.map((type) => t(`trainingType.${type}`).toLowerCase()).join(", ") })}
                        </p>
                        {item.overrideReason && <p className="text-fg-muted">{t("boutDetail.suspension.changedFrom", { days: item.suggestedDays ?? "", reason: item.overrideReason })}</p>}
                    </div>
                ))}
                {needsConfirmation && reason ? (
                    <SuspensionDialogButton
                        bout={{ id: bout.id, reason, suggestedDays: suggestion?.days ?? null, rule: suggestion ? describeRule(suggestion.rule, t) : null }}
                        defaultBlocked={ruleset?.defaultBlockedSessionTypes ?? ["sparring"]}
                        startsOn={boutOn(bout)}
                        label={t("boutDetail.suspension.confirm")}
                    />
                ) : (
                    <Link href={routes.coach.suspensions} className="text-sm font-medium text-primary-soft-fg hover:underline">
                        {t("boutDetail.suspension.all")}
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}

function HistoryCard({ bout, lang: { t, locale } }: { bout: CampBout; lang: Lang }) {
    const entries = [...bout.history].reverse();
    return (
        <Card>
            <CardHeader title={t("boutDetail.history.title")} />
            <CardContent>
                <ol className="flex flex-col gap-3 text-sm">
                    {entries.map((entry, index) => (
                        <li key={`${entry.at}-${index}`} className="min-w-0">
                            <p className="font-medium text-fg">
                                {entry.from === entry.to
                                    ? t("boutDetail.history.changedIn", { phase: t(`boutLabel.phase.${entry.to}`).toLowerCase() })
                                    : entry.from
                                      ? `${t(`boutLabel.phase.${entry.from}`)} → ${t(`boutLabel.phase.${entry.to}`)}`
                                      : t("boutDetail.history.created")}
                            </p>
                            <p className="text-[13px] text-fg-muted">
                                {entry.by} · {formatDateTime(entry.at, locale)}
                            </p>
                            {entry.reason && <p className="text-[13px] break-words text-fg-muted">{entry.reason}</p>}
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
