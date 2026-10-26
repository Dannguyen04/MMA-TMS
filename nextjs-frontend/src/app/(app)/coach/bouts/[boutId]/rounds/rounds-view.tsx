"use client";

import { useState } from "react";
import Link from "next/link";
import {
    CheckCircle2,
    FileText,
    Flame,
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
import type {
    ObservationMark,
    OpponentObservation,
    OpponentTactic,
    RoundAdvice,
    RoundRecord,
    SelfScore,
    TacticOutcome,
} from "@/lib/domain/round-advice";
import { routes } from "@/lib/routes";

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
    const roundNumbers = Array.from({ length: scheduledRounds }, (_, idx) => idx + 1);
    const nextRoundNo = rounds.length + 1;

    return (
        <div className="flex min-w-0 flex-col gap-5">
            {/* Quick link to Corner Card */}
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                    href={`${routes.coach.bout(boutId)}/corner-card`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-fg transition hover:bg-surface-muted"
                >
                    <FileText aria-hidden className="size-3.5 shrink-0" />
                    <span>{t("boutAnalysis.nav.cornerCard")}</span>
                </Link>
            </div>

            {/* Between-round advice panel (T-010B §5, R21–R24) */}
            {advice && (
                <Card className="min-w-0 border-primary/40 bg-surface">
                    <CardHeader
                        title={t("boutAnalysis.advice.title", { nextRound: nextRoundNo })}
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
                                                {!tactic.trained && (
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
                    </CardContent>
                </Card>
            )}

            {/* Round cards (1..scheduledRounds) */}
            <div className="flex min-w-0 flex-col gap-4">
                {roundNumbers.map((roundNo) => {
                    const existing = rounds.find((r) => r.roundNo === roundNo) ?? null;
                    return (
                        <RoundCardForm
                            key={`${roundNo}-${existing?.updatedAt ?? "new"}`}
                            boutId={boutId}
                            roundNo={roundNo}
                            observations={observations}
                            tactics={tactics}
                            existing={existing}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface RoundCardFormProps {
    boutId: string;
    roundNo: number;
    observations: OpponentObservation[];
    tactics: OpponentTactic[];
    existing: RoundRecord | null;
}

function RoundCardForm({
    boutId,
    roundNo,
    observations,
    tactics,
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

    const kdControl = form.control("knockdownsAgainst");
    const noteControl = form.control("note");

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("boutAnalysis.rounds.roundTitle", { roundNo })}
                action={
                    existing ? (
                        <Badge tone="success" icon={CheckCircle2}>
                            {t("boutAnalysis.rounds.recordedBadge")}
                        </Badge>
                    ) : (
                        <Badge tone="neutral" variant="outline">
                            {t("boutAnalysis.rounds.notRecordedBadge")}
                        </Badge>
                    )
                }
            />
            <CardContent className="min-w-0">
                <form {...form.formProps} className="flex min-w-0 flex-col gap-4">
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

                    {/* Coach self-score (R23) */}
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-xs font-semibold text-fg">
                            {t("boutAnalysis.rounds.selfScoreLabel")}
                        </span>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("boutAnalysis.rounds.selfScoreLabel")}>
                            {SELF_SCORES.map((score) => {
                                const active = selfScore === score;
                                return (
                                    <button
                                        key={score}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setSelfScore(active ? "" : score)}
                                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                            active
                                                ? "border-primary bg-primary text-primary-fg"
                                                : "border-border bg-surface text-fg hover:bg-surface-muted"
                                        }`}
                                    >
                                        {t(`boutAnalysis.rounds.selfScore.${score}`)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Knockdowns & Fighter condition flags */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                className="h-10 tabular-nums"
                            />
                        </Field>

                        <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="text-xs font-semibold text-fg">
                                {t("boutAnalysis.rounds.flagsLabel")}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    aria-pressed={stunned}
                                    onClick={() => setStunned((v) => !v)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        stunned
                                            ? "border-danger-border bg-danger-soft text-danger-fg"
                                            : "border-border bg-surface text-fg hover:bg-surface-muted"
                                    }`}
                                >
                                    {t("boutAnalysis.rounds.stunned")}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={bleeding}
                                    onClick={() => setBleeding((v) => !v)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        bleeding
                                            ? "border-warning-border bg-warning-soft text-warning-fg"
                                            : "border-border bg-surface text-fg hover:bg-surface-muted"
                                    }`}
                                >
                                    {t("boutAnalysis.rounds.bleeding")}
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={fatigued}
                                    onClick={() => setFatigued((v) => !v)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        fatigued
                                            ? "border-warning-border bg-warning-soft text-warning-fg"
                                            : "border-border bg-surface text-fg hover:bg-surface-muted"
                                    }`}
                                >
                                    {t("boutAnalysis.rounds.fatigued")}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tactic marks */}
                    {tactics.length > 0 && (
                        <div className="flex min-w-0 flex-col gap-2">
                            <span className="text-xs font-semibold text-fg">
                                {t("boutAnalysis.rounds.tacticsSection")}
                            </span>
                            <div className="flex min-w-0 flex-col gap-2">
                                {tactics.map((tactic) => {
                                    const current = tacticMarks[tactic.id];
                                    return (
                                        <div
                                            key={tactic.id}
                                            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-3"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-1.5">
                                                <p className="min-w-0 flex-1 break-words text-xs font-medium text-fg">
                                                    {tactic.text}
                                                </p>
                                                {tactic.round !== null && (
                                                    <Badge tone="info" variant="outline">
                                                        {t("boutAnalysis.cornerCard.roundBadge", { round: tactic.round })}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TACTIC_OUTCOMES.map((outcome) => {
                                                    const active = current === outcome;
                                                    return (
                                                        <button
                                                            key={outcome}
                                                            type="button"
                                                            aria-pressed={active}
                                                            onClick={() =>
                                                                setTacticMarks((prev) => {
                                                                    const next = { ...prev };
                                                                    if (next[tactic.id] === outcome) {
                                                                        delete next[tactic.id];
                                                                    } else {
                                                                        next[tactic.id] = outcome;
                                                                    }
                                                                    return next;
                                                                })
                                                            }
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                                                                active
                                                                    ? outcome === "EFFECTIVE"
                                                                        ? "border-success-border bg-success-soft text-success-fg"
                                                                        : outcome === "INEFFECTIVE"
                                                                          ? "border-danger-border bg-danger-soft text-danger-fg"
                                                                          : "border-primary bg-primary text-primary-fg"
                                                                    : "border-border bg-surface text-fg hover:bg-surface-muted"
                                                            }`}
                                                        >
                                                            {t(`boutAnalysis.rounds.tacticMark.${outcome}`)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Observation marks */}
                    {observations.length > 0 && (
                        <div className="flex min-w-0 flex-col gap-2">
                            <span className="text-xs font-semibold text-fg">
                                {t("boutAnalysis.rounds.observationsSection")}
                            </span>
                            <div className="flex min-w-0 flex-col gap-2">
                                {observations.map((obs) => {
                                    const current = observationMarks[obs.id];
                                    return (
                                        <div
                                            key={obs.id}
                                            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-3"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-1.5">
                                                <p className="min-w-0 flex-1 break-words text-xs font-medium text-fg">
                                                    {obs.text}
                                                </p>
                                                <Badge tone="neutral" variant="outline">
                                                    {t(`boutAnalysis.rounds.obsKind.${obs.kind}`)}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {OBSERVATION_MARKS.map((mark) => {
                                                    const active = current === mark;
                                                    return (
                                                        <button
                                                            key={mark}
                                                            type="button"
                                                            aria-pressed={active}
                                                            onClick={() =>
                                                                setObservationMarks((prev) => {
                                                                    const next = { ...prev };
                                                                    if (next[obs.id] === mark) {
                                                                        delete next[obs.id];
                                                                    } else {
                                                                        next[obs.id] = mark;
                                                                    }
                                                                    return next;
                                                                })
                                                            }
                                                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                                                                active
                                                                    ? mark === "SEEN"
                                                                        ? "border-success-border bg-success-soft text-success-fg"
                                                                        : "border-warning-border bg-warning-soft text-warning-fg"
                                                                    : "border-border bg-surface text-fg hover:bg-surface-muted"
                                                            }`}
                                                        >
                                                            {t(`boutAnalysis.rounds.observationMark.${mark}`)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Round note */}
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
                        />
                    </Field>

                    <SubmitButton
                        size="lg"
                        className="w-full"
                        pending={form.pending}
                        pendingLabel={t("boutAnalysis.rounds.savingRound")}
                    >
                        {t("boutAnalysis.rounds.saveRound", { roundNo })}
                    </SubmitButton>
                </form>
            </CardContent>
        </Card>
    );
}
