"use client";

import { useState, type ReactNode } from "react";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Flame,
    Pencil,
    ShieldAlert,
    TriangleAlert,
} from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordBoutRoundAction } from "@/lib/actions/bout-analysis";
import {
    hasExtraEntries,
    mainObservationId,
    openRoundNo,
    quickTacticIds,
    summarizeRound,
} from "@/lib/domain/rounds-view-model";
import { cn } from "@/lib/utils";
import { NextRoundPlanForm } from "./next-round-plan";
import type {
    ObservationMark,
    OpponentObservation,
    OpponentTactic,
    RoundAdvice,
    RoundRecord,
    SelfScore,
    TacticOutcome,
} from "@/lib/domain/round-advice";

interface RoundsViewProps {
    boutId: string;
    scheduledRounds: number;
    observations: OpponentObservation[];
    tactics: OpponentTactic[];
    rounds: RoundRecord[];
    advice: RoundAdvice | null;
}

const SELF_SCORES: SelfScore[] = ["WIN", "LOSS", "CLOSE"];
const TACTIC_OUTCOMES: TacticOutcome[] = ["EFFECTIVE", "INEFFECTIVE", "NOT_USED"];
const OBSERVATION_MARKS: ObservationMark[] = ["SEEN", "NOT_SEEN"];

export function RoundsView({
    boutId,
    scheduledRounds,
    observations,
    tactics,
    rounds,
    advice,
}: RoundsViewProps) {
    const t = useT();
    const [showRanking, setShowRanking] = useState(false);
    const roundNumbers = Array.from({ length: scheduledRounds }, (_, idx) => idx + 1);
    const recordedRoundNo = rounds.reduce((max, r) => Math.max(max, r.roundNo), 0);
    // T-037 B: only the round being recorded is open; recorded rounds collapse, later ones wait.
    const openNo = openRoundNo(advice, scheduledRounds);
    // Tactics added at a break (T-037) can be marked from the next round on, as the API allows.
    const tacticsFor = (roundNo: number): OpponentTactic[] => [
        ...tactics,
        ...rounds
            .filter((r) => r.roundNo < roundNo)
            .flatMap((r) => r.nextRoundPlan?.addedTactics ?? [])
            .map((added) => ({ ...added, round: null, sessionIds: [], partnerBrief: null })),
    ];

    return (
        <div className="flex min-w-0 flex-col gap-5">
            {/* Between-round advice panel (T-010B §5, R21–R24) */}
            {advice && (
                <Card className="min-w-0 border-primary/40 bg-surface">
                    <CardHeader
                        title={t("boutAnalysis.advice.title", { nextRound: advice.nextRound.roundNo })}
                        description={t("boutAnalysis.advice.coachDecisionNote")}
                        icon={<Flame aria-hidden />}
                    />
                    <CardContent className="flex min-w-0 flex-col gap-4">
                        {/* Safety RED alert (R24) */}
                        {advice.safety?.level === "RED" && (
                            <div
                                role="alert"
                                className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-soft p-4 text-xs text-danger-fg"
                            >
                                <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold leading-snug">
                                        {t("boutAnalysis.advice.safetyRedTitle")}
                                    </p>
                                    <ul className="mt-1.5 list-disc space-y-1 pl-4">
                                        {advice.safety.reasons.map((reason) => (
                                            <li key={reason} className="break-words">
                                                {t(`boutAnalysis.advice.safetyReason.${reason}`)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* T-037 B: what to tell the fighter for the next round, right under the safety alert */}
                        <NextRoundPlanForm
                            key={`plan-${recordedRoundNo}-${rounds.find((r) => r.roundNo === recordedRoundNo)?.updatedAt ?? ""}`}
                            boutId={boutId}
                            recordedRoundNo={recordedRoundNo}
                            advice={advice}
                            observations={observations}
                        />

                        {/* Standing and the re-ranked list fold away so the plan and the open round fit a phone */}
                        <button
                            type="button"
                            aria-expanded={showRanking}
                            aria-controls="round-advice-ranking"
                            onClick={() => setShowRanking((v) => !v)}
                            className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 text-left text-sm font-semibold text-fg transition hover:bg-surface-hover"
                        >
                            <span className="min-w-0">{t("boutAnalysis.advice.rankingToggle")}</span>
                            {showRanking ? <ChevronUp aria-hidden className="size-4 shrink-0" /> : <ChevronDown aria-hidden className="size-4 shrink-0" />}
                        </button>
                        {showRanking && (
                            <div id="round-advice-ranking" className="flex min-w-0 flex-col gap-4">
                                {/* Self-scored standing (R23) */}
                                <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-surface-muted p-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                            {t("boutAnalysis.advice.standingTitle")}
                                        </span>
                                        <Badge tone="info" variant="outline">
                                            {t("boutAnalysis.advice.selfScoredBadge")}
                                        </Badge>
                                    </div>
                                    <p className="break-words text-sm font-semibold text-fg">
                                        {advice.standing.kind === "AHEAD" &&
                                            t("boutAnalysis.advice.standing.AHEAD")}
                                        {advice.standing.kind === "NEED_WINS" &&
                                            t("boutAnalysis.advice.standing.NEED_WINS", {
                                                needed: advice.standing.needed,
                                                remaining: advice.standing.remaining,
                                            })}
                                        {advice.standing.kind === "HARD_TO_WIN_ON_POINTS" &&
                                            t("boutAnalysis.advice.standing.HARD_TO_WIN_ON_POINTS")}
                                    </p>
                                </div>

                                {/* Re-ranked tactics (R21, R22) */}
                                {advice.tactics.length > 0 && (
                                    <div className="flex min-w-0 flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                                            {t("boutAnalysis.advice.tacticsTitle")}
                                        </span>
                                        <ol className="flex min-w-0 flex-col gap-2">
                                            {advice.tactics.map((tactic, idx) => (
                                                <li
                                                    key={tactic.id}
                                                    className={`min-w-0 rounded-xl border p-3 text-xs ${
                                                        tactic.dropped || tactic.note
                                                            ? "border-border bg-surface-muted/70 opacity-80"
                                                            : "border-border bg-surface"
                                                    }`}
                                                >
                                                    <div className="flex min-w-0 items-start gap-2">
                                                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold tabular-nums text-fg">
                                                            {idx + 1}
                                                        </span>
                                                        <p
                                                            className={`min-w-0 flex-1 break-words font-semibold text-fg ${
                                                                tactic.dropped ? "line-through" : ""
                                                            }`}
                                                        >
                                                            {tactic.text}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                                                        <Badge tone="neutral" variant="outline">
                                                            {t("boutAnalysis.advice.scoreBadge", {
                                                                score: tactic.score > 0 ? `+${tactic.score}` : tactic.score,
                                                            })}
                                                        </Badge>
                                                        {tactic.focus && (
                                                            <Badge tone="primary">{t("boutAnalysis.nextRound.focusBadge")}</Badge>
                                                        )}
                                                        {tactic.addedRound !== null && (
                                                            <Badge tone="info">{t("boutAnalysis.nextRound.addedBadge", { round: tactic.addedRound })}</Badge>
                                                        )}
                                                        {!tactic.trained && tactic.addedRound === null && (
                                                            <Badge tone="warning" icon={TriangleAlert}>
                                                                {t("boutAnalysis.cornerCard.untrainedBadge")}
                                                            </Badge>
                                                        )}
                                                        {tactic.dropped && (
                                                            <Badge tone="danger">
                                                                {t("boutAnalysis.advice.droppedBadge")}
                                                            </Badge>
                                                        )}
                                                        {tactic.note === "OPPONENT_MAY_HAVE_CHANGED" && (
                                                            <Badge tone="warning">
                                                                {t("boutAnalysis.advice.opponentChangedBadge")}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Round cards (1..scheduledRounds): recorded rounds as one line, the open round, then the rounds to come */}
            <div className="flex min-w-0 flex-col gap-3">
                {roundNumbers.map((roundNo) => {
                    const existing = rounds.find((r) => r.roundNo === roundNo) ?? null;
                    if (!existing && roundNo !== openNo) {
                        return <LaterRoundRow key={roundNo} roundNo={roundNo} />;
                    }
                    const available = tacticsFor(roundNo);
                    const quick = quickTacticIds(roundNo, rounds, advice, available);
                    const mainObservation = mainObservationId(
                        observations,
                        available.filter((tactic) => quick.includes(tactic.id)),
                    );
                    const form = (
                        <RoundCardForm
                            key={`${roundNo}-${existing?.updatedAt ?? "new"}`}
                            boutId={boutId}
                            roundNo={roundNo}
                            observations={observations}
                            tactics={available}
                            quickTacticIds={quick}
                            mainObservationId={mainObservation}
                            existing={existing}
                        />
                    );
                    return existing ? (
                        <RecordedRound key={`${roundNo}-${existing.updatedAt}`} record={existing}>
                            {form}
                        </RecordedRound>
                    ) : (
                        form
                    );
                })}
            </div>
        </div>
    );
}

/** A round not reached yet: its number only, nothing to tap. */
function LaterRoundRow({ roundNo }: { roundNo: number }) {
    const t = useT();
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-fg-subtle">
            <h2 className="font-semibold">{t("boutAnalysis.rounds.roundTitle", { roundNo })}</h2>
            <span className="text-xs">{t("boutAnalysis.rounds.laterBadge")}</span>
        </div>
    );
}

/** A recorded round: one summary line; the edit button opens the full form. */
function RecordedRound({ record, children }: { record: RoundRecord; children: ReactNode }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const summary = summarizeRound(record);
    const parts = [
        t(`boutAnalysis.rounds.selfScore.${summary.selfScore ?? "NONE"}`),
        t("boutAnalysis.rounds.summary.knockdowns", { count: summary.knockdowns }),
        summary.conditions.length > 0
            ? summary.conditions.map((flag) => t(`boutAnalysis.rounds.${flag}`)).join(", ")
            : t("boutAnalysis.rounds.summary.noCondition"),
        t("boutAnalysis.rounds.summary.marks", { count: summary.marks }),
    ];
    const panelId = `round-${record.roundNo}-edit`;

    return (
        <Card className="min-w-0">
            <div className="flex min-w-0 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-bold text-fg">
                            {t("boutAnalysis.rounds.roundTitle", { roundNo: record.roundNo })}
                        </h2>
                        <Badge tone="success" icon={CheckCircle2}>
                            {t("boutAnalysis.rounds.recordedBadge")}
                        </Badge>
                    </div>
                    <p className="mt-0.5 break-words text-xs text-fg-muted">{parts.join(" · ")}</p>
                </div>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-fg transition hover:bg-surface-muted"
                >
                    {open ? <ChevronUp aria-hidden className="size-4" /> : <Pencil aria-hidden className="size-4" />}
                    {open
                        ? t("boutAnalysis.rounds.closeEdit")
                        : t("boutAnalysis.rounds.editRound", { roundNo: record.roundNo })}
                </button>
            </div>
            {open && (
                <div id={panelId} className="border-t border-border pt-3">
                    {children}
                </div>
            )}
        </Card>
    );
}

interface RoundCardFormProps {
    boutId: string;
    roundNo: number;
    observations: OpponentObservation[];
    tactics: OpponentTactic[];
    /** The two tactics shown by default (T-037 B). */
    quickTacticIds: string[];
    /** The one observation shown by default. */
    mainObservationId: string | null;
    existing: RoundRecord | null;
}

const toggleButton = "min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold leading-tight transition";
const idleButton = "border-border bg-surface text-fg hover:bg-surface-muted";
const sectionLabel = "text-xs font-semibold text-fg";

function RoundCardForm({
    boutId,
    roundNo,
    observations,
    tactics,
    quickTacticIds: quickIds,
    mainObservationId: mainObsId,
    existing,
}: RoundCardFormProps) {
    const t = useT();
    const form = useActionForm(recordBoutRoundAction, {
        id: `round-form-${roundNo}`,
    });

    const [selfScore, setSelfScore] = useState<SelfScore | "">(existing?.selfScore ?? "");
    const [knockdowns, setKnockdowns] = useState<string>(String(existing?.knockdownsAgainst ?? 0));
    const [stunned, setStunned] = useState<boolean>(existing?.stunned ?? false);
    const [bleeding, setBleeding] = useState<boolean>(existing?.bleeding ?? false);
    const [fatigued, setFatigued] = useState<boolean>(existing?.fatigued ?? false);
    const [tacticMarks, setTacticMarks] = useState<Record<string, TacticOutcome>>(
        () => ({ ...(existing?.tacticMarks ?? {}) }),
    );
    const [observationMarks, setObservationMarks] = useState<Record<string, ObservationMark>>(
        () => ({ ...(existing?.observationMarks ?? {}) }),
    );
    // "Record more" starts open when an edited round already holds entries outside the four default taps.
    const [more, setMore] = useState<boolean>(() => hasExtraEntries(existing, quickIds, mainObsId));

    const kdControl = form.control("knockdownsAgainst");
    const noteControl = form.control("note");
    const moreId = `round-form-${roundNo}-more`;

    const quickTactics = quickIds
        .map((id) => tactics.find((tactic) => tactic.id === id))
        .filter((tactic): tactic is OpponentTactic => Boolean(tactic));
    const otherTactics = tactics.filter((tactic) => !quickIds.includes(tactic.id));
    const mainObservation = observations.find((obs) => obs.id === mainObsId) ?? null;
    const otherObservations = observations.filter((obs) => obs.id !== mainObsId);
    const flags = [
        { flag: "stunned", on: stunned, set: setStunned, activeClass: "border-danger-border bg-danger-soft text-danger-fg" },
        { flag: "bleeding", on: bleeding, set: setBleeding, activeClass: "border-warning-border bg-warning-soft text-warning-fg" },
        { flag: "fatigued", on: fatigued, set: setFatigued, activeClass: "border-warning-border bg-warning-soft text-warning-fg" },
    ] as const;

    const toggleTactic = (id: string, outcome: TacticOutcome) =>
        setTacticMarks((prev) => {
            const next = { ...prev };
            if (next[id] === outcome) delete next[id];
            else next[id] = outcome;
            return next;
        });
    const toggleObservation = (id: string, mark: ObservationMark) =>
        setObservationMarks((prev) => {
            const next = { ...prev };
            if (next[id] === mark) delete next[id];
            else next[id] = mark;
            return next;
        });

    const tacticRow = (tactic: OpponentTactic) => {
        const current = tacticMarks[tactic.id];
        return (
            <div
                key={tactic.id}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-2.5"
            >
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <p className="min-w-0 flex-1 break-words text-sm font-medium text-fg">{tactic.text}</p>
                    {tactic.round !== null && (
                        <Badge tone="info" variant="outline">
                            {t("boutAnalysis.cornerCard.roundBadge", { round: tactic.round })}
                        </Badge>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {TACTIC_OUTCOMES.map((outcome) => {
                        const active = current === outcome;
                        return (
                            <button
                                key={outcome}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleTactic(tactic.id, outcome)}
                                className={cn(
                                    toggleButton,
                                    active
                                        ? outcome === "EFFECTIVE"
                                            ? "border-success-border bg-success-soft text-success-fg"
                                            : outcome === "INEFFECTIVE"
                                              ? "border-danger-border bg-danger-soft text-danger-fg"
                                              : "border-primary bg-primary text-primary-fg"
                                        : idleButton,
                                )}
                            >
                                {t(`boutAnalysis.rounds.tacticMark.${outcome}`)}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const observationRow = (obs: OpponentObservation) => {
        const current = observationMarks[obs.id];
        return (
            <div
                key={obs.id}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-2.5"
            >
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <p className="min-w-0 flex-1 break-words text-sm font-medium text-fg">{obs.text}</p>
                    <Badge tone="neutral" variant="outline">
                        {t(`boutAnalysis.rounds.obsKind.${obs.kind}`)}
                    </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    {OBSERVATION_MARKS.map((mark) => {
                        const active = current === mark;
                        return (
                            <button
                                key={mark}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleObservation(obs.id, mark)}
                                className={cn(
                                    toggleButton,
                                    active
                                        ? mark === "SEEN"
                                            ? "border-success-border bg-success-soft text-success-fg"
                                            : "border-warning-border bg-warning-soft text-warning-fg"
                                        : idleButton,
                                )}
                            >
                                {t(`boutAnalysis.rounds.observationMark.${mark}`)}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const body = (
        <form {...form.formProps} className="flex min-w-0 flex-col gap-3.5">
            <input type="hidden" name="boutId" value={boutId} />
            <input type="hidden" name="roundNo" value={roundNo} />
            <input type="hidden" name="selfScore" value={selfScore} />
            <input type="hidden" name="stunned" value={stunned ? "true" : "false"} />
            <input type="hidden" name="bleeding" value={bleeding ? "true" : "false"} />
            <input type="hidden" name="fatigued" value={fatigued ? "true" : "false"} />
            {Object.entries(tacticMarks).map(([id, mark]) => (
                <input key={id} type="hidden" name={`tacticMark_${id}`} value={mark} />
            ))}
            {Object.entries(observationMarks).map(([id, mark]) => (
                <input key={id} type="hidden" name={`observationMark_${id}`} value={mark} />
            ))}

            <FormMessage {...form.message} />

            {/* The four default taps (business flow 9): two coached tactics, one main observation, self-score */}
            {quickTactics.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2">
                    <span className={sectionLabel}>{t("boutAnalysis.rounds.quickTactics")}</span>
                    {quickTactics.map(tacticRow)}
                </div>
            )}

            {mainObservation && (
                <div className="flex min-w-0 flex-col gap-2">
                    <span className={sectionLabel}>{t("boutAnalysis.rounds.mainObservation")}</span>
                    {observationRow(mainObservation)}
                </div>
            )}

            {/* Coach self-score (R23) */}
            <div className="flex min-w-0 flex-col gap-1.5">
                <span className={sectionLabel}>{t("boutAnalysis.rounds.selfScoreLabel")}</span>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t("boutAnalysis.rounds.selfScoreLabel")}>
                    {SELF_SCORES.map((score) => {
                        const active = selfScore === score;
                        return (
                            <button
                                key={score}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setSelfScore(active ? "" : score)}
                                className={cn(toggleButton, active ? "border-primary bg-primary text-primary-fg" : idleButton)}
                            >
                                {t(`boutAnalysis.rounds.selfScore.${score}`)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <button
                type="button"
                aria-expanded={more}
                aria-controls={moreId}
                onClick={() => setMore((v) => !v)}
                className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-left text-sm font-semibold text-fg transition hover:bg-surface-muted"
            >
                <span className="min-w-0">
                    {t(more ? "boutAnalysis.rounds.recordLess" : "boutAnalysis.rounds.recordMore")}
                    {!more && (
                        <span className="block text-xs font-normal text-fg-muted">
                            {t("boutAnalysis.rounds.recordMoreHint")}
                        </span>
                    )}
                </span>
                {more ? <ChevronUp aria-hidden className="size-4 shrink-0" /> : <ChevronDown aria-hidden className="size-4 shrink-0" />}
            </button>

            {/* Behind "Record more": hidden, but still in the form and sent with it */}
            <div id={moreId} hidden={!more} className="flex min-w-0 flex-col gap-3.5">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span className={sectionLabel}>{t("boutAnalysis.rounds.flagsLabel")}</span>
                    <div className="grid grid-cols-3 gap-1.5">
                        {flags.map(({ flag, on, set, activeClass }) => (
                            <button
                                key={flag}
                                type="button"
                                aria-pressed={on}
                                onClick={() => set((v) => !v)}
                                className={cn(toggleButton, on ? activeClass : idleButton)}
                            >
                                {t(`boutAnalysis.rounds.${flag}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <Field
                    label={t("boutAnalysis.rounds.knockdownsLabel")}
                    htmlFor={kdControl.id}
                    error={form.error("knockdownsAgainst")}
                >
                    <Input
                        {...kdControl}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10}
                        value={knockdowns}
                        onChange={(e) => setKnockdowns(e.target.value)}
                        className="min-h-11 tabular-nums"
                    />
                </Field>

                {otherTactics.length > 0 && (
                    <div className="flex min-w-0 flex-col gap-2">
                        <span className={sectionLabel}>
                            {t(quickTactics.length > 0 ? "boutAnalysis.rounds.otherTactics" : "boutAnalysis.rounds.tacticsSection")}
                        </span>
                        {otherTactics.map(tacticRow)}
                    </div>
                )}

                {otherObservations.length > 0 && (
                    <div className="flex min-w-0 flex-col gap-2">
                        <span className={sectionLabel}>
                            {t(mainObservation ? "boutAnalysis.rounds.otherObservations" : "boutAnalysis.rounds.observationsSection")}
                        </span>
                        {otherObservations.map(observationRow)}
                    </div>
                )}

                <Field
                    label={t("boutAnalysis.rounds.noteLabel")}
                    htmlFor={noteControl.id}
                    error={form.error("note")}
                >
                    <Input
                        {...noteControl}
                        type="text"
                        maxLength={300}
                        defaultValue={existing?.note ?? ""}
                        placeholder={t("boutAnalysis.rounds.notePlaceholder")}
                        className="min-h-11"
                    />
                </Field>
            </div>

            <SubmitButton
                size="lg"
                className="w-full"
                pending={form.pending}
                pendingLabel={t("boutAnalysis.rounds.savingRound")}
            >
                {t(existing ? "boutAnalysis.rounds.updateRound" : "boutAnalysis.rounds.saveRound", { roundNo })}
            </SubmitButton>
        </form>
    );

    // A recorded round's form sits inside its summary card; the open round gets its own card.
    if (existing) return <div className="min-w-0 px-4 pb-4">{body}</div>;
    return (
        <Card className="min-w-0 border-primary/40">
            <CardHeader
                title={t("boutAnalysis.rounds.roundTitle", { roundNo })}
                action={
                    <Badge tone="primary" variant="outline">
                        {t("boutAnalysis.rounds.recordingBadge")}
                    </Badge>
                }
            />
            <CardContent className="min-w-0 px-4 pb-4">{body}</CardContent>
        </Card>
    );
}
