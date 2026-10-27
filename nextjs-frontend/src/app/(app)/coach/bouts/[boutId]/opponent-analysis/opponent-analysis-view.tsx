"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileText, Plus, Swords, Trash2, TriangleAlert } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveOpponentAnalysisAction } from "@/lib/actions/bout-analysis";
import {
    MAX_OBSERVATIONS,
    MAX_TACTICS,
    nextAnalysisId,
    removeObservation,
    type OpponentAnalysisForm,
} from "@/lib/domain/opponent-analysis-form";
import type { OpponentAnalysis, OpponentObservation, OpponentTactic } from "@/lib/domain/round-advice";
import { routes } from "@/lib/routes";

interface OpponentAnalysisViewProps {
    boutId: string;
    scheduledRounds: number | null;
    analysis: OpponentAnalysis;
    locked: boolean;
    canOpenCornerCard: boolean;
}

const KINDS: OpponentObservation["kind"][] = ["STRENGTH", "OPENING", "HABIT"];
const CONFIDENCES: OpponentObservation["confidence"][] = ["ONCE", "REPEATED"];

function allIds(form: OpponentAnalysisForm): string[] {
    return [...form.observations, ...form.tactics].map((x) => x.id);
}

export function OpponentAnalysisView({
    boutId,
    scheduledRounds,
    analysis,
    locked,
    canOpenCornerCard,
}: OpponentAnalysisViewProps) {
    const t = useT();
    const [draft, setDraft] = useState<OpponentAnalysisForm>(() => ({
        observations: analysis.observations ?? [],
        tactics: analysis.tactics ?? [],
    }));
    const toast = useToast();
    // Validation runs in the server action (same helper), which returns per-row field errors.
    // Saving revalidates this page and remounts the form, so success is a toast rather than form state.
    const form = useActionForm(saveOpponentAnalysisAction, {
        id: "opponent-analysis-form",
        onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("boutAnalysis.analysis.action.saved") }),
    });
    const roundNumbers = Array.from({ length: scheduledRounds ?? 0 }, (_, idx) => idx + 1);

    function updateObservation(index: number, patch: Partial<OpponentObservation>) {
        setDraft((d) => ({ ...d, observations: d.observations.map((o, i) => (i === index ? { ...o, ...patch } : o)) }));
    }

    function updateTactic(index: number, patch: Partial<OpponentTactic>) {
        setDraft((d) => ({ ...d, tactics: d.tactics.map((x, i) => (i === index ? { ...x, ...patch } : x)) }));
    }

    function addObservation() {
        setDraft((d) => ({
            ...d,
            observations: [
                ...d.observations,
                { id: nextAnalysisId("obs", allIds(d)), kind: "OPENING", text: "", evidenceUrl: null, evidenceNote: null, confidence: "ONCE" },
            ],
        }));
    }

    function addTactic() {
        setDraft((d) => ({
            ...d,
            tactics: [
                ...d.tactics,
                { id: nextAnalysisId("tac", allIds(d)), text: "", round: null, observationIds: [], sessionIds: [], partnerBrief: null },
            ],
        }));
    }

    function toggleBasis(index: number, observationId: string, checked: boolean) {
        const current = draft.tactics[index]?.observationIds ?? [];
        updateTactic(index, {
            observationIds: checked ? [...current, observationId] : current.filter((id) => id !== observationId),
        });
        form.markEdited(`tactics.${index}.observationIds`);
    }

    return (
        <form {...form.formProps} className="flex min-w-0 flex-col gap-5">
            <input type="hidden" name="boutId" value={boutId} />
            <input type="hidden" name="analysis" value={JSON.stringify(draft)} />

            {locked && (
                <Card className="min-w-0 border-warning-border bg-warning-soft">
                    <CardContent className="flex items-start gap-3 p-5 text-xs text-warning-fg">
                        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">{t("boutAnalysis.analysis.lockedTitle")}</p>
                            <p className="mt-1 break-words leading-relaxed">{t("boutAnalysis.analysis.lockedText")}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <FormMessage {...form.message} />
            {canOpenCornerCard && (
                <Link
                    href={`${routes.coach.bout(boutId)}/corner-card`}
                    className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-fg transition hover:bg-surface-muted"
                >
                    <FileText aria-hidden className="size-3.5 shrink-0" />
                    <span>{t("boutAnalysis.nav.cornerCard")}</span>
                </Link>
            )}

            <Card className="min-w-0">
                <CardHeader
                    title={t("boutAnalysis.analysis.observationsTitle", { count: draft.observations.length, max: MAX_OBSERVATIONS })}
                    description={t("boutAnalysis.analysis.observationsDesc")}
                    icon={<Eye aria-hidden />}
                />
                <CardContent className="flex min-w-0 flex-col gap-4">
                    {draft.observations.length === 0 && (
                        <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.noObservations")}</p>
                    )}
                    {draft.observations.map((o, i) => {
                        const textControl = form.control(`observations.${i}.text`);
                        const urlControl = form.control(`observations.${i}.evidenceUrl`);
                        const noteControl = form.control(`observations.${i}.evidenceNote`);
                        const kindControl = form.control(`observations.${i}.kind`);
                        const confidenceControl = form.control(`observations.${i}.confidence`);
                        return (
                            <fieldset key={o.id} disabled={locked} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <legend className="text-sm font-semibold text-fg">
                                        {t("boutAnalysis.analysis.observationLabel", { n: i + 1 })}
                                    </legend>
                                    {!locked && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setDraft((d) => removeObservation(d, o.id));
                                                form.markEdited("observations");
                                                form.markEdited("tactics");
                                            }}
                                        >
                                            <Trash2 aria-hidden className="size-3.5" />
                                            {t("boutAnalysis.analysis.remove")}
                                        </Button>
                                    )}
                                </div>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Field label={t("boutAnalysis.analysis.kind")} htmlFor={kindControl.id} error={form.error(kindControl.name)}>
                                        <Select
                                            {...kindControl}
                                            value={o.kind}
                                            onChange={(e) => updateObservation(i, { kind: e.target.value as OpponentObservation["kind"] })}
                                        >
                                            {KINDS.map((k) => (
                                                <option key={k} value={k}>{t(`boutAnalysis.analysis.kind.${k}`)}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <Field label={t("boutAnalysis.analysis.confidence")} htmlFor={confidenceControl.id} error={form.error(confidenceControl.name)}>
                                        <Select
                                            {...confidenceControl}
                                            value={o.confidence}
                                            onChange={(e) => updateObservation(i, { confidence: e.target.value as OpponentObservation["confidence"] })}
                                        >
                                            {CONFIDENCES.map((c) => (
                                                <option key={c} value={c}>{t(`boutAnalysis.analysis.confidence.${c}`)}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>
                                <Field label={t("boutAnalysis.analysis.text")} htmlFor={textControl.id} error={form.error(textControl.name)}>
                                    <Input
                                        {...textControl}
                                        maxLength={300}
                                        value={o.text}
                                        placeholder={t("boutAnalysis.analysis.textPlaceholder")}
                                        onChange={(e) => updateObservation(i, { text: e.target.value })}
                                    />
                                </Field>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Field label={t("boutAnalysis.analysis.evidenceUrl")} htmlFor={urlControl.id} error={form.error(urlControl.name)} optional>
                                        <Input
                                            {...urlControl}
                                            type="url"
                                            value={o.evidenceUrl ?? ""}
                                            placeholder="https://"
                                            onChange={(e) => updateObservation(i, { evidenceUrl: e.target.value || null })}
                                        />
                                    </Field>
                                    <Field label={t("boutAnalysis.analysis.evidenceNote")} htmlFor={noteControl.id} error={form.error(noteControl.name)} optional>
                                        <Input
                                            {...noteControl}
                                            value={o.evidenceNote ?? ""}
                                            placeholder={t("boutAnalysis.analysis.evidenceNotePlaceholder")}
                                            onChange={(e) => updateObservation(i, { evidenceNote: e.target.value || null })}
                                        />
                                    </Field>
                                </div>
                            </fieldset>
                        );
                    })}
                    {!locked && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-fit"
                            disabled={draft.observations.length >= MAX_OBSERVATIONS}
                            onClick={addObservation}
                        >
                            <Plus aria-hidden className="size-3.5" />
                            {t("boutAnalysis.analysis.addObservation")}
                        </Button>
                    )}
                </CardContent>
            </Card>

            <Card className="min-w-0">
                <CardHeader
                    title={t("boutAnalysis.analysis.tacticsTitle", { count: draft.tactics.length, max: MAX_TACTICS })}
                    description={t("boutAnalysis.analysis.tacticsDesc")}
                    icon={<Swords aria-hidden />}
                />
                <CardContent className="flex min-w-0 flex-col gap-4">
                    {draft.tactics.length === 0 && (
                        <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.noTactics")}</p>
                    )}
                    {draft.tactics.map((tactic, i) => {
                        const textControl = form.control(`tactics.${i}.text`);
                        const roundControl = form.control(`tactics.${i}.round`);
                        const briefControl = form.control(`tactics.${i}.partnerBrief`);
                        const basisError = form.error(`tactics.${i}.observationIds`);
                        return (
                            <fieldset key={tactic.id} disabled={locked} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <legend className="text-sm font-semibold text-fg">
                                        {t("boutAnalysis.analysis.tacticLabel", { n: i + 1 })}
                                    </legend>
                                    {!locked && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setDraft((d) => ({ ...d, tactics: d.tactics.filter((x) => x.id !== tactic.id) }));
                                                form.markEdited("tactics");
                                            }}
                                        >
                                            <Trash2 aria-hidden className="size-3.5" />
                                            {t("boutAnalysis.analysis.remove")}
                                        </Button>
                                    )}
                                </div>
                                <Field label={t("boutAnalysis.analysis.tacticText")} htmlFor={textControl.id} error={form.error(textControl.name)}>
                                    <Input
                                        {...textControl}
                                        value={tactic.text}
                                        placeholder={t("boutAnalysis.analysis.tacticPlaceholder")}
                                        onChange={(e) => updateTactic(i, { text: e.target.value })}
                                    />
                                </Field>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Field label={t("boutAnalysis.analysis.round")} htmlFor={roundControl.id} error={form.error(roundControl.name)}>
                                        <Select
                                            {...roundControl}
                                            value={tactic.round === null ? "" : String(tactic.round)}
                                            onChange={(e) => updateTactic(i, { round: e.target.value ? Number(e.target.value) : null })}
                                        >
                                            <option value="">{t("boutAnalysis.analysis.allRounds")}</option>
                                            {roundNumbers.map((r) => (
                                                <option key={r} value={r}>{t("boutAnalysis.analysis.roundOption", { round: r })}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <Field label={t("boutAnalysis.analysis.partnerBrief")} htmlFor={briefControl.id} error={form.error(briefControl.name)} optional>
                                        <Input
                                            {...briefControl}
                                            value={tactic.partnerBrief ?? ""}
                                            placeholder={t("boutAnalysis.analysis.partnerBriefPlaceholder")}
                                            onChange={(e) => updateTactic(i, { partnerBrief: e.target.value || null })}
                                        />
                                    </Field>
                                </div>
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <p className="text-xs font-medium text-fg">{t("boutAnalysis.analysis.basis")}</p>
                                    {draft.observations.length === 0 ? (
                                        <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.basisEmpty")}</p>
                                    ) : (
                                        draft.observations.map((o, oi) => (
                                            <label key={o.id} className="flex min-w-0 items-start gap-2 text-xs text-fg">
                                                <input
                                                    type="checkbox"
                                                    className="mt-0.5"
                                                    checked={tactic.observationIds.includes(o.id)}
                                                    onChange={(e) => toggleBasis(i, o.id, e.target.checked)}
                                                />
                                                <span className="min-w-0 break-words">
                                                    {t("boutAnalysis.analysis.observationLabel", { n: oi + 1 })}: {o.text || "—"}
                                                </span>
                                            </label>
                                        ))
                                    )}
                                    {basisError && <p role="alert" className="text-xs text-danger-fg">{basisError}</p>}
                                </div>
                            </fieldset>
                        );
                    })}
                    {!locked && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-fit"
                            disabled={draft.tactics.length >= MAX_TACTICS}
                            onClick={addTactic}
                        >
                            <Plus aria-hidden className="size-3.5" />
                            {t("boutAnalysis.analysis.addTactic")}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {!locked && (
                <SubmitButton size="lg" className="w-full sm:w-fit" pending={form.pending} pendingLabel={t("boutAnalysis.analysis.saving")}>
                    {t("boutAnalysis.analysis.save")}
                </SubmitButton>
            )}
        </form>
    );
}
