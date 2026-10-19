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
import {
    BOUT_METHOD_LABELS,
    BOUT_PHASE_LABELS,
    BOUT_RESULT_LABELS,
    CANCEL_REASON_LABELS,
    GATE1_REASON_LABELS,
    HYDRATION_CHECK_LABELS,
    LOSS_OF_CONSCIOUSNESS_LABELS,
    SUSPENSION_REASON_LABELS,
    TRAINING_TYPE_LABELS,
} from "@/lib/domain/labels";
import { weighInCountdown } from "@/lib/domain/nutrition";
import { describeRule, suggestSuspension, suspensionReasonFor, suspensionState } from "@/lib/domain/suspension-rules";
import { kgLabel } from "@/lib/domain/weight-input";
import { dayKey, daysBetweenKeys, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getCampBout, getRuleset, getWeightTrack, knockoutHistory, listSuspensions, wayOffForBout } from "@/lib/services/bouts";
import { getFighter } from "@/lib/services/people";
import { getPlan, listPlans } from "@/lib/services/training";
import { param } from "@/lib/utils";
import { CancelBoutButton, EditBoutButton, EnterFightWeekForm, LinkCampButton, ResultButton, WeighInButton } from "./bout-actions";
import { MedicalChecklist } from "./medical-checklist";
import { SuspensionDialogButton } from "../suspension-dialogs";

const loadBout = cache(getCampBout);

const NOTICES = {
    created: { title: "Bout created", description: "Link a camp plan to start the camp." },
    "created-suspended": { title: "Bout created", description: "The fighter is suspended past the bout day. Check their suspension." },
    "fight-week": { title: "Fight week started", description: "The checklist is locked and the fighter now sees the fight-week meal plan." },
    plan: { title: "Meal plan saved" },
} as const;

export async function generateMetadata({ params }: PageProps<"/coach/bouts/[boutId]">): Promise<Metadata> {
    const bout = await loadBout((await params).boutId);
    return { title: bout ? bout.event : "Bout" };
}

export default async function CoachBoutPage({ params, searchParams }: PageProps<"/coach/bouts/[boutId]">) {
    const user = await requireRole("coach");
    const { boutId } = await params;
    const query = await searchParams;
    const bout = await loadBout(boutId);
    if (!bout || !canAccessFighter(user, bout.fighterId)) notFound();

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
    const fighterName = fighter?.name ?? "Fighter";
    const gate = boutGate1(bout);
    const dueOn = requirementsDueOn(bout);
    const overdue = requirementsOverdue(bout, todayOn);
    const limit = boutLimitKg(bout);
    const notice = param(query.notice);
    const flash = notice && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;
    const campPlans = plans
        .filter((plan) => plan.phase === "fight_camp" && plan.status !== "archived")
        .map((plan) => ({ id: plan.id, title: plan.title, period: `${formatDate(plan.startDate)} – ${plan.endDate ? formatDate(plan.endDate) : "open"}` }));
    const boutSuspensions = suspensions.filter((item) => item.boutId === bout.id);

    return (
        <>
            <FlashToast notice={flash ? { ...flash, tone: "success" } : null} cleanHref={routes.coach.bout(bout.id)} />
            <PageHeader
                eyebrow="Bout"
                back={{ href: routes.coach.bouts, label: "Bouts" }}
                title={bout.event}
                description={`${fighterName} · ${bout.opponent ?? "Opponent TBA"}`}
                meta={
                    <>
                        <BoutPhaseBadge phase={bout.phase} />
                        {track && isRunningPhase(bout.phase) && <WeightStatusBadge status={track.status} />}
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
                                label: bout.catchweightKg === null ? "Weight class" : "Catchweight",
                                value: bout.catchweightKg === null ? `${bout.weightClassLabel}${limit === null ? " (no upper limit)" : ""}` : `${kgLabel(bout.catchweightKg)} (class ${bout.weightClassLabel})`,
                            },
                            { label: "Weigh-in", value: formatDateTime(bout.weighInAt) },
                            { label: "Bout", value: formatDateTime(bout.boutAt) },
                            { label: "Countdown", value: isRunningPhase(bout.phase) ? weighInCountdown(daysBetweenKeys(todayOn, weighInOn(bout))) : "—" },
                            { label: "Documents due", value: <>{formatDate(dueOn)}{overdue && <span className="text-danger-fg"> · late</span>}</> },
                            { label: "Acute-loss limit", value: `${formatNumber(bout.acuteLossLimitPct)}% in the last ${bout.acuteWindowDays} days` },
                            {
                                label: "Ruleset",
                                value: (
                                    <>
                                        {bout.rulesetName}
                                        {!bout.rulesetVerified && <span className="block text-[13px] font-normal text-fg-muted">{ruleset?.weightClasses.length ? "Reference only, not verified with the organiser" : "Coach-entered, not verified"}</span>}
                                    </>
                                ),
                            },
                            { label: "Venue", value: bout.venue ?? "—" },
                            {
                                label: "Camp plan",
                                value: linkedPlan ? (
                                    <Link href={routes.coach.plan(linkedPlan.id)} className="text-primary-soft-fg hover:underline">
                                        {linkedPlan.title}
                                    </Link>
                                ) : (
                                    "Not linked"
                                ),
                            },
                            ...(bout.notes ? [{ label: "Notes", value: bout.notes, wide: true }] : []),
                        ]}
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <NextStepCard bout={bout} todayOn={todayOn} gateMissing={gate.missing.length} campPlans={campPlans} fighterName={fighterName} />
                    {track && isRunningPhase(bout.phase) && <CampWeightCard track={track} wayOff={wayOff} />}
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
                            <CardHeader title="Meal plan" description="Camp, fight week, and after the official weigh-in. The fighter sees the current phase." />
                            <CardContent>
                                <NutritionPlanForm boutId={bout.id} plan={bout.nutritionPlan} authorName={user.name} />
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    <GateCard bout={bout} todayOn={todayOn} />
                    {(bout.weighIn || bout.outcome) && <ResultCard bout={bout} />}
                    {bout.phase === "COMPLETED" && (
                        <SuspensionCard bout={bout} suspensions={boutSuspensions} todayOn={todayOn} ruleset={ruleset} priorKnockouts={priorKnockouts} />
                    )}
                    <HistoryCard bout={bout} />
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
}: {
    bout: CampBout;
    todayOn: string;
    gateMissing: number;
    campPlans: { id: string; title: string; period: string }[];
    fighterName: string;
}) {
    if (bout.phase === "SCHEDULED") {
        return (
            <Card>
                <CardHeader title="Start the camp" description="Link the fighter's fight-camp plan. The camp's weights count from the plan's first day." />
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
                    title="Fight week"
                    description={early ? `Opens on ${formatDate(opensOn)}, ${bout.fightWeekDays} days before weigh-in.` : `Open since ${formatDate(opensOn)}. Gate 1 checks the documents first.`}
                    action={<Gate1Badge missing={gateMissing} overdue={requirementsOverdue(bout, todayOn)} />}
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
                <CardHeader title="Official weigh-in" description={`${formatDateTime(bout.weighInAt)}. Record the scale weight; a miss asks for a catchweight or a cancellation.`} />
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
                <CardHeader title="Result" description={`Bout ${formatDateTime(bout.boutAt)}. The app does nothing during the bout itself.`} />
                <CardContent>
                    {check.ok ? (
                        <ResultButton bout={bout} />
                    ) : (
                        <InlineNote icon={CalendarClock}>The result can be recorded from {formatDate(bout.boutAt)}.</InlineNote>
                    )}
                </CardContent>
            </Card>
        );
    }
    if (bout.phase === "CANCELLED") {
        return (
            <Callout tone="neutral" icon={CircleSlash} title={`Cancelled${bout.cancelReason ? `: ${CANCEL_REASON_LABELS[bout.cancelReason]}` : ""}`}>
                {bout.cancelNote ?? "The camp plan and its sessions were kept."}
            </Callout>
        );
    }
    return null;
}

/* ─── Side column ─────────────────────────────────────────────────────────── */

function GateCard({ bout, todayOn }: { bout: CampBout; todayOn: string }) {
    const gate = boutGate1(bout);
    const relevant = bout.phase === "SCHEDULED" || bout.phase === "CAMP";
    if (!relevant) return null;
    if (bout.requirements.length === 0) {
        return (
            <Callout tone="info" icon={Info} title="No documents listed">
                Gate 1 has nothing to check yet. Add the documents the event&apos;s notice asks for.
            </Callout>
        );
    }
    return gate.passed ? (
        <Callout tone="success" icon={ShieldCheck} title="Gate 1 met">
            Every required document is in and valid through {formatDate(bout.boutAt)}.
        </Callout>
    ) : (
        <Callout tone={requirementsOverdue(bout, todayOn) ? "danger" : "warning"} icon={ShieldAlert} title="Gate 1 not met">
            <ul className="mt-1 list-disc pl-5">
                {gate.missing.map((gap) => (
                    <li key={gap.requirement.code}>
                        {gap.requirement.label}: {GATE1_REASON_LABELS[gap.reason]}
                    </li>
                ))}
            </ul>
        </Callout>
    );
}

function ResultCard({ bout }: { bout: CampBout }) {
    const items = [];
    if (bout.weighIn) {
        items.push({ label: "Official weight", value: `${formatNumber(bout.weighIn.weightKg, 1)} kg · ${bout.weighIn.madeWeight ? "made weight" : "missed"}` });
        if (bout.weighIn.hydrationCheck) items.push({ label: "Hydration check", value: HYDRATION_CHECK_LABELS[bout.weighIn.hydrationCheck] });
        if (bout.weighIn.catchweightNote) items.push({ label: "Catchweight note", value: bout.weighIn.catchweightNote });
    }
    if (bout.outcome) {
        const outcome = bout.outcome;
        items.push({ label: "Result", value: `${BOUT_RESULT_LABELS[outcome.result]} · ${BOUT_METHOD_LABELS[outcome.method]}${outcome.round ? `, round ${outcome.round}` : ""}` });
        if (outcome.lossOfConsciousness) items.push({ label: "Lost consciousness", value: LOSS_OF_CONSCIOUSNESS_LABELS[outcome.lossOfConsciousness] });
        if (outcome.stoppedByHeadStrikes !== null) items.push({ label: "Stopped for head strikes", value: outcome.stoppedByHeadStrikes ? "Yes" : "No" });
        items.push({ label: "Knocked down", value: outcome.knockedDown ? "Yes" : "No" });
        if (outcome.injuryNote) items.push({ label: "Injuries seen", value: outcome.injuryNote });
        if (outcome.notes) items.push({ label: "Notes", value: outcome.notes });
    }
    return (
        <Card>
            <CardHeader title={bout.outcome ? "Result" : "Weigh-in"} />
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
}: {
    bout: CampBout;
    suspensions: Suspension[];
    todayOn: string;
    ruleset: Awaited<ReturnType<typeof getRuleset>>;
    priorKnockouts: string[];
}) {
    const reason = bout.outcome ? suspensionReasonFor(bout.outcome) : null;
    if (!reason && suspensions.length === 0) {
        return (
            <Callout tone="success" icon={CheckCircle2} title="No suspension suggested">
                The ruleset suggests none for this result. Add one by hand under Suspensions if the fighter needs rest.
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
                title="Suspension"
                description={
                    needsConfirmation
                        ? suggestion
                            ? `Suggested: ${suggestion.days} days (${describeRule(suggestion.rule)}).`
                            : "The ruleset has no rule for this result. Enter the days."
                        : undefined
                }
            />
            <CardContent className="flex flex-col gap-3">
                {suspensions.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                            {SUSPENSION_REASON_LABELS[item.reason]}: {formatDate(item.startsOn)} – {formatDate(item.endsOn)}
                            <SuspensionStateBadge state={suspensionState(item, todayOn)} size="sm" />
                        </p>
                        <p className="text-fg-muted">Blocks {item.blockedSessionTypes.map((type) => TRAINING_TYPE_LABELS[type].toLowerCase()).join(", ")}.</p>
                        {item.overrideReason && (
                            <p className="text-fg-muted">
                                Changed from {item.suggestedDays} days: {item.overrideReason}
                            </p>
                        )}
                    </div>
                ))}
                {needsConfirmation && reason ? (
                    <SuspensionDialogButton
                        bout={{ id: bout.id, reason, suggestedDays: suggestion?.days ?? null, rule: suggestion ? describeRule(suggestion.rule) : null }}
                        defaultBlocked={ruleset?.defaultBlockedSessionTypes ?? ["sparring"]}
                        startsOn={boutOn(bout)}
                        label="Confirm suspension"
                    />
                ) : (
                    <Link href={routes.coach.suspensions} className="text-sm font-medium text-primary-soft-fg hover:underline">
                        All suspensions
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}

function HistoryCard({ bout }: { bout: CampBout }) {
    const entries = [...bout.history].reverse();
    return (
        <Card>
            <CardHeader title="History" />
            <CardContent>
                <ol className="flex flex-col gap-3 text-sm">
                    {entries.map((entry, index) => (
                        <li key={`${entry.at}-${index}`} className="min-w-0">
                            <p className="font-medium text-fg">
                                {entry.from === entry.to ? `Changed in ${BOUT_PHASE_LABELS[entry.to].toLowerCase()}` : entry.from ? `${BOUT_PHASE_LABELS[entry.from]} → ${BOUT_PHASE_LABELS[entry.to]}` : "Created"}
                            </p>
                            <p className="text-[13px] text-fg-muted">
                                {entry.by} · {formatDateTime(entry.at)}
                            </p>
                            {entry.reason && <p className="text-[13px] break-words text-fg-muted">{entry.reason}</p>}
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
