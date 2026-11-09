"use client";

import { Plus, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveNextRoundPlanAction } from "@/lib/actions/bout-analysis";
import {
    NEXT_ROUND_TEXT_MAX,
    type Instruction,
    type NextRoundPlan,
    type OpponentObservation,
    type RoundAdvice,
} from "@/lib/domain/round-advice";
import type { Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const MAX_INSTRUCTIONS = 3;
const MAX_FOCUS = 2;
const MAX_ADDED = 2;

type AddedTactic = NextRoundPlan["addedTactics"][number];

const keyOf = (instruction: Instruction) => `${instruction.code}:${instruction.tacticId ?? ""}`;

/** A free id for a tactic added at this break, in the analysis id format (`r2-a1`). */
function nextAddedId(recordedRoundNo: number, taken: ReadonlySet<string>): string {
    let n = 1;
    while (taken.has(`r${recordedRoundNo}-a${n}`)) n++;
    return `r${recordedRoundNo}-a${n}`;
}

/** The sentence for an instruction code; tactic codes name the tactic. */
export function instructionText(instruction: Instruction, tacticName: (id: string) => string, t: Translator): string {
    if (instruction.code === "CUSTOM") return instruction.text ?? "";
    return t(`boutAnalysis.nextRound.instruction.${instruction.code}`, { tactic: instruction.tacticId ? tacticName(instruction.tacticId) : "" });
}

/**
 * T-037 B: "Round n: what to do", in the 60 s break. The coach taps up to three instructions (the app's suggestions
 * or one of their own), up to two focus tactics, and may add up to two tactics. Saved on the round just recorded.
 */
export function NextRoundPlanForm({
    boutId,
    recordedRoundNo,
    advice,
    observations,
}: {
    boutId: string;
    recordedRoundNo: number;
    advice: RoundAdvice;
    observations: OpponentObservation[];
}) {
    const t = useT();
    const form = useActionForm(saveNextRoundPlanAction, { id: `next-round-${recordedRoundNo}` });
    const saved = advice.nextRound.plan;
    const savedChoices = (saved?.instructions ?? []).filter((instruction) => instruction.code !== "CUSTOM");
    const choices = [...advice.nextRound.suggested, ...savedChoices.filter((s) => !advice.nextRound.suggested.some((x) => keyOf(x) === keyOf(s)))];

    const [picked, setPicked] = useState<string[]>(() =>
        saved ? savedChoices.map(keyOf) : advice.nextRound.suggested.filter((s) => s.code === "SAFETY_CHECK").map(keyOf),
    );
    const [custom, setCustom] = useState(() => saved?.instructions.find((i) => i.code === "CUSTOM")?.text ?? "");
    const [focus, setFocus] = useState<string[]>(() => saved?.focusTacticIds ?? []);
    const [added, setAdded] = useState<AddedTactic[]>(() => saved?.addedTactics ?? []);

    const tacticName = (id: string) => advice.tactics.find((x) => x.id === id)?.text ?? added.find((x) => x.id === id)?.text ?? id;
    const instructionCount = picked.length + (custom.trim() ? 1 : 0);
    const plan: NextRoundPlan = {
        focusTacticIds: focus,
        addedTactics: added.filter((tactic) => tactic.text.trim()).map((tactic) => ({ ...tactic, text: tactic.text.trim() })),
        instructions: [
            ...choices.filter((choice) => picked.includes(keyOf(choice))),
            ...(custom.trim() ? [{ code: "CUSTOM" as const, text: custom.trim() }] : []),
        ],
    };
    const takenIds = new Set([...advice.tactics.map((x) => x.id), ...observations.map((o) => o.id), ...added.map((x) => x.id)]);
    const toggle = (list: string[], id: string, max: number) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list);

    return (
        <form {...form.formProps} className="flex min-w-0 flex-col gap-4 rounded-xl border border-primary/30 bg-primary-soft/40 p-3.5">
            <input type="hidden" name="boutId" value={boutId} />
            <input type="hidden" name="roundNo" value={recordedRoundNo} />
            <input type="hidden" name="nextRoundPlan" value={JSON.stringify(plan)} />
            <div className="min-w-0">
                <p className="text-sm font-bold text-fg">{t("boutAnalysis.nextRound.title", { roundNo: advice.nextRound.roundNo })}</p>
                <p className="text-xs text-fg-muted">{t("boutAnalysis.nextRound.description", { recorded: recordedRoundNo })}</p>
            </div>

            <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-2 flex w-full items-center justify-between gap-2 text-xs font-semibold text-fg">
                    <span>{t("boutAnalysis.nextRound.suggestedTitle")}</span>
                    <span className="font-normal text-fg-muted tabular-nums">{t("boutAnalysis.nextRound.limitHint", { count: instructionCount })}</span>
                </legend>
                {choices.length === 0 && <p className="text-xs text-fg-muted">{t("boutAnalysis.nextRound.noSuggestions")}</p>}
                {choices.map((choice) => {
                    const key = keyOf(choice);
                    const active = picked.includes(key);
                    const safety = choice.code === "SAFETY_CHECK";
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            disabled={!active && instructionCount >= MAX_INSTRUCTIONS}
                            onClick={() => setPicked((prev) => toggle(prev, key, MAX_INSTRUCTIONS - (custom.trim() ? 1 : 0)))}
                            className={cn(
                                "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition disabled:opacity-50",
                                safety
                                    ? active
                                        ? "border-danger-solid bg-danger-solid text-white"
                                        : "border-danger-border bg-danger-soft text-danger-fg"
                                    : active
                                      ? "border-primary bg-primary text-primary-fg"
                                      : "border-border bg-surface text-fg hover:bg-surface-muted",
                            )}
                        >
                            {safety && <ShieldAlert aria-hidden className="size-4 shrink-0" />}
                            <span className="min-w-0 break-words">{instructionText(choice, tacticName, t)}</span>
                        </button>
                    );
                })}
                <Field label={t("boutAnalysis.nextRound.customLabel")} htmlFor={`next-round-${recordedRoundNo}-custom`} optional>
                    <Input
                        id={`next-round-${recordedRoundNo}-custom`}
                        value={custom}
                        maxLength={NEXT_ROUND_TEXT_MAX}
                        disabled={!custom.trim() && instructionCount >= MAX_INSTRUCTIONS}
                        placeholder={t("boutAnalysis.nextRound.customPlaceholder")}
                        onChange={(event) => setCustom(event.target.value)}
                        className="min-h-11"
                    />
                </Field>
            </fieldset>

            {advice.tactics.length > 0 && (
                <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="mb-2 text-xs font-semibold text-fg">{t("boutAnalysis.nextRound.focusTitle")}</legend>
                    <div className="flex min-w-0 flex-wrap gap-2">
                        {advice.tactics.map((tactic) => {
                            const active = focus.includes(tactic.id);
                            return (
                                <button
                                    key={tactic.id}
                                    type="button"
                                    aria-pressed={active}
                                    disabled={!active && focus.length >= MAX_FOCUS}
                                    onClick={() => setFocus((prev) => toggle(prev, tactic.id, MAX_FOCUS))}
                                    className={cn(
                                        "min-h-11 max-w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold break-words transition disabled:opacity-50",
                                        active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-muted",
                                    )}
                                >
                                    {tactic.text}
                                    {active && tactic.dropped && (
                                        <span className="mt-1 flex items-center gap-1 font-normal">
                                            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                                            {t("boutAnalysis.nextRound.droppedWarning")}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}

            <div className="flex min-w-0 flex-col gap-3">
                {added.map((tactic, index) => (
                    <div key={tactic.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                        <div className="flex items-end gap-2">
                            <Field label={t("boutAnalysis.nextRound.addedTacticLabel")} htmlFor={`added-${tactic.id}`} className="min-w-0 flex-1">
                                <Input
                                    id={`added-${tactic.id}`}
                                    value={tactic.text}
                                    maxLength={NEXT_ROUND_TEXT_MAX}
                                    placeholder={t("boutAnalysis.nextRound.addedTacticPlaceholder")}
                                    className="min-h-11"
                                    onChange={(event) =>
                                        setAdded((prev) => prev.map((x, i) => (i === index ? { ...x, text: event.target.value } : x)))
                                    }
                                />
                            </Field>
                            <Button
                                type="button"
                                variant="ghost"
                                className="min-h-11 min-w-11"
                                aria-label={t("boutAnalysis.nextRound.removeTactic")}
                                onClick={() => {
                                    setAdded((prev) => prev.filter((_, i) => i !== index));
                                    setFocus((prev) => prev.filter((id) => id !== tactic.id));
                                }}
                            >
                                <X aria-hidden />
                            </Button>
                        </div>
                        {observations.length > 0 && (
                            <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label={t("boutAnalysis.nextRound.basisLabel")}>
                                {observations.map((observation) => {
                                    const active = tactic.observationIds.includes(observation.id);
                                    return (
                                        <button
                                            key={observation.id}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() =>
                                                setAdded((prev) =>
                                                    prev.map((x, i) => (i === index ? { ...x, observationIds: toggle(x.observationIds, observation.id, 3) } : x)),
                                                )
                                            }
                                            className={cn(
                                                "min-h-11 max-w-full rounded-lg border px-3 py-2 text-left text-xs break-words transition",
                                                active ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface-muted text-fg-muted",
                                            )}
                                        >
                                            {observation.text}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {added.length < MAX_ADDED && (
                    <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 self-start"
                        onClick={() => setAdded((prev) => [...prev, { id: nextAddedId(recordedRoundNo, takenIds), text: "", observationIds: [] }])}
                    >
                        <Plus aria-hidden />
                        {t("boutAnalysis.nextRound.addTactic")}
                    </Button>
                )}
            </div>

            <FormMessage {...form.message} />
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel={t("boutAnalysis.nextRound.saving")}>
                {t("boutAnalysis.nextRound.submit", { roundNo: advice.nextRound.roundNo })}
            </SubmitButton>
        </form>
    );
}
