"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, FileText, Info, Plus, Scale, ShieldCheck, Swords, Trash2, TriangleAlert, UserRound } from "lucide-react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveOpponentAnalysisAction } from "@/lib/actions/bout-analysis";
import { trainingTypeLabel } from "@/lib/domain/labels";
import {
    MAX_OBSERVATIONS,
    MAX_TACTICS,
    nextAnalysisId,
    removeObservation,
    type OpponentAnalysisForm,
} from "@/lib/domain/opponent-analysis-form";
import {
    matchupNotes,
    planFindings,
    tacticInsights,
    type FighterSide,
    type MatchupNote,
    type PlanFinding,
} from "@/lib/domain/opponent-analysis-insights";
import type { OpponentAnalysis, OpponentObservation, OpponentProfile, OpponentTactic } from "@/lib/domain/round-advice";
import type { TrainingType } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export interface CampSessionOption {
    id: string;
    title: string;
    type: TrainingType;
    scheduledAt: string;
}

interface OpponentAnalysisViewProps {
    boutId: string;
    scheduledRounds: number | null;
    analysis: OpponentAnalysis;
    locked: boolean;
    canOpenCornerCard: boolean;
    fighterName: string;
    fighter: FighterSide;
    sessions: CampSessionOption[];
}

const KINDS: OpponentObservation["kind"][] = ["STRENGTH", "OPENING", "HABIT"];
const CONFIDENCES: OpponentObservation["confidence"][] = ["ONCE", "REPEATED"];
const STANCES = ["ORTHODOX", "SOUTHPAW", "SWITCH"] as const;
const STYLES = ["STRIKER", "WRESTLER", "GRAPPLER", "ALL_ROUND"] as const;

function allIds(form: OpponentAnalysisForm): string[] {
    return [...form.observations, ...form.tactics].map((x) => x.id);
}

/** Empty inputs drop the field so the backend's optional profile fields stay unset. */
function numberOrUndefined(value: string): number | undefined {
    const n = Number(value);
    return value.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n;
}

function findingText(t: Translator, f: PlanFinding): string {
    switch (f.code) {
        case "ROUND_GAP":
            return t("boutAnalysis.analysis.check.ROUND_GAP", { round: f.round });
        case "TOO_FEW_TACTICS":
            return t("boutAnalysis.analysis.check.TOO_FEW_TACTICS", { count: f.count });
        default:
            return t(`boutAnalysis.analysis.check.${f.code}`, { text: f.text || "—" });
    }
}

function matchupText(t: Translator, n: MatchupNote): string {
    switch (n.code) {
        case "OPPOSITE_STANCE":
            return t(`boutAnalysis.analysis.matchup.OPPOSITE_STANCE.${n.opponentStance}`);
        case "SWITCH_STANCE":
            return t("boutAnalysis.analysis.matchup.SWITCH_STANCE");
        case "REACH_GAP":
            return t(n.diffCm > 0 ? "boutAnalysis.analysis.matchup.REACH_LONGER" : "boutAnalysis.analysis.matchup.REACH_SHORTER", { cm: Math.abs(n.diffCm) });
        case "HEIGHT_GAP":
            return t(n.diffCm > 0 ? "boutAnalysis.analysis.matchup.HEIGHT_TALLER" : "boutAnalysis.analysis.matchup.HEIGHT_SHORTER", { cm: Math.abs(n.diffCm) });
        case "EXPERIENCE":
            return t("boutAnalysis.analysis.matchup.EXPERIENCE", { opponent: n.opponentBouts, fighter: n.fighterBouts });
    }
}

export function OpponentAnalysisView({
    boutId,
    scheduledRounds,
    analysis,
    locked,
    canOpenCornerCard,
    fighterName,
    fighter,
    sessions,
}: OpponentAnalysisViewProps) {
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const [draft, setDraft] = useState<OpponentAnalysisForm>(() => ({
        profile: analysis.profile ?? {},
        observations: analysis.observations ?? [],
        tactics: analysis.tactics ?? [],
    }));
    // Validation runs in the server action (same helper), which returns per-row field errors.
    // Saving revalidates this page and remounts the form, so success is a toast rather than form state.
    const form = useActionForm(saveOpponentAnalysisAction, {
        id: "opponent-analysis-form",
        onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("boutAnalysis.analysis.action.saved") }),
    });
    const roundNumbers = Array.from({ length: scheduledRounds ?? 0 }, (_, idx) => idx + 1);
    const sessionIds = new Set(sessions.map((s) => s.id));

    const insights = useMemo(() => tacticInsights(draft), [draft]);
    const findings = useMemo(() => planFindings(draft, scheduledRounds), [draft, scheduledRounds]);
    const matchup = useMemo(() => matchupNotes(draft.profile, fighter), [draft.profile, fighter]);

    function updateProfile(patch: Partial<OpponentProfile>) {
        setDraft((d) => {
            const next = { ...(d.profile ?? {}), ...patch };
            for (const key of Object.keys(next) as (keyof OpponentProfile)[]) {
                if (next[key] === undefined) delete next[key];
            }
            return { ...d, profile: next };
        });
    }

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

    function toggleIn(list: string[], id: string, checked: boolean): string[] {
        return checked ? [...list, id] : list.filter((x) => x !== id);
    }

    const profile = draft.profile ?? {};

    return (
        <form {...form.formProps} className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-3">
            <input type="hidden" name="boutId" value={boutId} />
            <input type="hidden" name="analysis" value={JSON.stringify(draft)} />

            <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
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

                {/* E2 part 1: opponent profile */}
                <Card className="min-w-0">
                    <CardHeader
                        title={t("boutAnalysis.analysis.profileTitle")}
                        description={t("boutAnalysis.analysis.profileDesc", { fighter: fighterName })}
                        icon={<UserRound aria-hidden />}
                    />
                    <CardContent>
                        <fieldset disabled={locked} className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                            {(["wins", "losses", "draws"] as const).map((key) => (
                                <Field key={key} label={t(`boutAnalysis.analysis.${key}`)} htmlFor={`profile-${key}`}>
                                    <Input
                                        id={`profile-${key}`}
                                        type="number"
                                        min={0}
                                        inputMode="numeric"
                                        value={profile[key] ?? ""}
                                        onChange={(e) => updateProfile({ [key]: numberOrUndefined(e.target.value) })}
                                    />
                                </Field>
                            ))}
                            <Field label={t("boutAnalysis.analysis.stance")} htmlFor="profile-stance">
                                <Select
                                    id="profile-stance"
                                    value={profile.stance ?? ""}
                                    onChange={(e) => updateProfile({ stance: (e.target.value || undefined) as OpponentProfile["stance"] })}
                                >
                                    <option value="">{t("boutAnalysis.analysis.unknown")}</option>
                                    {STANCES.map((s) => (
                                        <option key={s} value={s}>{t(`boutAnalysis.analysis.stance.${s}`)}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label={t("boutAnalysis.analysis.style")} htmlFor="profile-style">
                                <Select
                                    id="profile-style"
                                    value={profile.style ?? ""}
                                    onChange={(e) => updateProfile({ style: (e.target.value || undefined) as OpponentProfile["style"] })}
                                >
                                    <option value="">{t("boutAnalysis.analysis.unknown")}</option>
                                    {STYLES.map((s) => (
                                        <option key={s} value={s}>{t(`boutAnalysis.analysis.style.${s}`)}</option>
                                    ))}
                                </Select>
                            </Field>
                            {(["heightCm", "reachCm"] as const).map((key) => (
                                <Field key={key} label={t(`boutAnalysis.analysis.${key}`)} htmlFor={`profile-${key}`}>
                                    <Input
                                        id={`profile-${key}`}
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        value={profile[key] ?? ""}
                                        onChange={(e) => updateProfile({ [key]: numberOrUndefined(e.target.value) || undefined })}
                                    />
                                </Field>
                            ))}
                            <Field label={t("boutAnalysis.analysis.source")} htmlFor="profile-source" className="col-span-2 sm:col-span-4" optional>
                                <Input
                                    id="profile-source"
                                    value={profile.source ?? ""}
                                    placeholder={t("boutAnalysis.analysis.sourcePlaceholder")}
                                    onChange={(e) => updateProfile({ source: e.target.value || undefined })}
                                />
                            </Field>
                        </fieldset>
                    </CardContent>
                </Card>

                {/* E2 part 2: observations */}
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

                {/* E2 parts 3–4: tactics and the sessions that train them */}
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
                            const insight = insights.get(tactic.id);
                            const otherSessions = tactic.sessionIds.filter((id) => !sessionIds.has(id)).length;
                            return (
                                <fieldset key={tactic.id} disabled={locked} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <legend className="text-sm font-semibold text-fg">
                                            {t("boutAnalysis.analysis.tacticLabel", { n: i + 1 })}
                                        </legend>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {insight && tactic.observationIds.length > 0 && (
                                                <>
                                                    <Badge tone="info" variant="outline">
                                                        {t("boutAnalysis.analysis.cardOrder", { n: insight.cardOrder })}
                                                    </Badge>
                                                    <Badge tone={insight.basis === "REPEATED" ? "success" : "neutral"} variant="outline">
                                                        {t(`boutAnalysis.cornerCard.basis.${insight.basis}`)}
                                                    </Badge>
                                                </>
                                            )}
                                            {insight && (insight.trained ? (
                                                <Badge tone="neutral" variant="outline">{t("boutAnalysis.cornerCard.trainedBadge")}</Badge>
                                            ) : (
                                                <Badge tone="warning" icon={TriangleAlert}>{t("boutAnalysis.cornerCard.untrainedBadge")}</Badge>
                                            ))}
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
                                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
                                                            onChange={(e) => {
                                                                updateTactic(i, { observationIds: toggleIn(tactic.observationIds, o.id, e.target.checked) });
                                                                form.markEdited(`tactics.${i}.observationIds`);
                                                            }}
                                                        />
                                                        <span className="min-w-0 break-words">
                                                            {t("boutAnalysis.analysis.observationLabel", { n: oi + 1 })}: {o.text || "—"}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                            {basisError && <p role="alert" className="text-xs text-danger-fg">{basisError}</p>}
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <p className="text-xs font-medium text-fg">{t("boutAnalysis.analysis.sessions")}</p>
                                            {sessions.length === 0 ? (
                                                <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.sessionsEmpty")}</p>
                                            ) : (
                                                <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                                                    {sessions.map((s) => (
                                                        <label key={s.id} className="flex min-w-0 items-start gap-2 text-xs text-fg">
                                                            <input
                                                                type="checkbox"
                                                                className="mt-0.5"
                                                                checked={tactic.sessionIds.includes(s.id)}
                                                                onChange={(e) => updateTactic(i, { sessionIds: toggleIn(tactic.sessionIds, s.id, e.target.checked) })}
                                                            />
                                                            <span className="min-w-0 break-words">
                                                                {formatDate(s.scheduledAt, locale)} · {trainingTypeLabel(t, s.type)} · {s.title}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                            {otherSessions > 0 && (
                                                <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.sessionsOther", { count: otherSessions })}</p>
                                            )}
                                        </div>
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
            </div>

            {/* What the app derives from the draft, live */}
            <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4">
                <Card className="min-w-0 border-primary/40">
                    <CardHeader
                        title={t("boutAnalysis.analysis.checkTitle")}
                        description={t("boutAnalysis.analysis.checkDesc")}
                        icon={<ShieldCheck aria-hidden />}
                    />
                    <CardContent>
                        {findings.length === 0 ? (
                            <p className="flex items-start gap-2 text-xs text-success-fg">
                                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                                <span>{t("boutAnalysis.analysis.checkOk")}</span>
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2" aria-live="polite">
                                {findings.map((f, idx) => (
                                    <li
                                        key={`${f.code}-${idx}`}
                                        className={f.level === "warning" ? "flex items-start gap-2 text-xs text-warning-fg" : "flex items-start gap-2 text-xs text-fg-muted"}
                                    >
                                        {f.level === "warning" ? (
                                            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                                        ) : (
                                            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                                        )}
                                        <span className="min-w-0 break-words">{findingText(t, f)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0">
                    <CardHeader title={t("boutAnalysis.analysis.matchupTitle")} icon={<Scale aria-hidden />} />
                    <CardContent>
                        {matchup.length === 0 ? (
                            <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.matchupEmpty")}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {matchup.map((n) => (
                                    <li key={n.code} className="flex items-start gap-2 text-xs text-fg">
                                        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
                                        <span className="min-w-0 break-words">{matchupText(t, n)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {canOpenCornerCard && (
                    <Link
                        href={`${routes.coach.bout(boutId)}/corner-card`}
                        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-fg transition hover:bg-surface-muted"
                    >
                        <FileText aria-hidden className="size-3.5 shrink-0" />
                        <span>{t("boutAnalysis.nav.cornerCard")}</span>
                    </Link>
                )}
            </div>
        </form>
    );
}
