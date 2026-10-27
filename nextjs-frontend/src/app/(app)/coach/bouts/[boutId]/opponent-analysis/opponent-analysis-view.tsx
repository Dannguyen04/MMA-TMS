"use client";

import { useMemo, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    FileText,
    Info,
    Link2,
    NotebookPen,
    Pencil,
    Play,
    Plus,
    ShieldCheck,
    Sparkles,
    Trash2,
    TriangleAlert,
} from "lucide-react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm, type ActionForm } from "@/components/ui/use-action-form";
import { saveOpponentAnalysisAction, suggestObservationsFromVideoAction, type VideoSuggestionsData } from "@/lib/actions/bout-analysis";
import type { ActionState } from "@/lib/actions/state";
import { suggestionToObservation, videoUrlAt, type VideoSuggestion } from "@/lib/domain/opponent-video-suggestions";
import { trainingTypeLabel } from "@/lib/domain/labels";
import {
    MAX_OBSERVATIONS,
    MAX_TACTICS,
    nextAnalysisId,
    removeObservation,
    type OpponentAnalysisForm,
} from "@/lib/domain/opponent-analysis-form";
import {
    matchupRows,
    planFindings,
    tacticInsights,
    type FighterSide,
    type MatchupRow,
    type PlanFinding,
    type TacticInsight,
} from "@/lib/domain/opponent-analysis-insights";
import type { OpponentAnalysis, OpponentObservation, OpponentProfile, OpponentTactic } from "@/lib/domain/round-advice";
import type { TrainingType } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface CampSessionOption {
    id: string;
    title: string;
    type: TrainingType;
    scheduledAt: string;
    completed: boolean;
}

interface OpponentAnalysisViewProps {
    boutId: string;
    scheduledRounds: number | null;
    analysis: OpponentAnalysis;
    locked: boolean;
    canOpenCornerCard: boolean;
    fighterName: string;
    opponentName: string;
    fighter: FighterSide;
    sessions: CampSessionOption[];
}

type OpenItem = { kind: "profile" } | { kind: "obs" | "tac"; id: string } | null;
type Form = ActionForm<undefined>;

const KINDS: OpponentObservation["kind"][] = ["STRENGTH", "OPENING", "HABIT"];
const CONFIDENCES: OpponentObservation["confidence"][] = ["ONCE", "REPEATED"];
const STANCES = ["ORTHODOX", "SOUTHPAW", "SWITCH"] as const;
const STYLES = ["STRIKER", "WRESTLER", "GRAPPLER", "ALL_ROUND"] as const;
const FIGHTER_STANCE_KEY = { orthodox: "ORTHODOX", southpaw: "SOUTHPAW", switch: "SWITCH" } as const;
const KIND_TONE = { STRENGTH: "danger", OPENING: "success", HABIT: "info" } as const;

/** Rows and toggles share one touch-sized style (44px min height). */
const TOGGLE =
    "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

function allIds(form: OpponentAnalysisForm): string[] {
    return [...form.observations, ...form.tactics].map((x) => x.id);
}

/** Empty inputs drop the field so the backend's optional profile fields stay unset. */
function numberOrUndefined(value: string): number | undefined {
    const n = Number(value);
    return value.trim() === "" || !Number.isFinite(n) || n <= 0 ? undefined : n;
}

/** Lower-cases the first letter so an observation reads inside "When the opponent …". */
function asClause(text: string): string {
    const trimmed = text.trim().replace(/\.+$/, "");
    return trimmed.charAt(0).toLocaleLowerCase() + trimmed.slice(1);
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

function matchupCells(t: Translator, row: MatchupRow): [label: string, opponent: string, fighter: string, diff: string] {
    if (row.field === "stance") {
        return [
            t("boutAnalysis.analysis.stance"),
            t(`boutAnalysis.analysis.stance.${row.opponent}`),
            t(`boutAnalysis.analysis.stance.${FIGHTER_STANCE_KEY[row.fighter]}`),
            "",
        ];
    }
    const diff = row.diffCm === 0 ? "0" : `${row.diffCm > 0 ? "+" : "−"}${Math.abs(row.diffCm)}`;
    return [t(`boutAnalysis.analysis.${row.field}`), String(row.opponent), String(row.fighter), diff];
}

export function OpponentAnalysisView({
    boutId,
    scheduledRounds,
    analysis,
    locked,
    canOpenCornerCard,
    fighterName,
    opponentName,
    fighter,
    sessions,
}: OpponentAnalysisViewProps) {
    const t = useT();
    const toast = useToast();
    const [initial] = useState<OpponentAnalysisForm>(() => ({
        profile: analysis.profile ?? {},
        observations: analysis.observations ?? [],
        tactics: analysis.tactics ?? [],
    }));
    const [draft, setDraft] = useState<OpponentAnalysisForm>(initial);
    const [open, setOpen] = useState<OpenItem>(null);
    const [showTips, setShowTips] = useState(false);
    const [showAi, setShowAi] = useState(false);
    // Validation runs in the server action (same helper), which returns per-row field errors.
    // Saving revalidates this page and remounts the form, so success is a toast rather than form state.
    const form = useActionForm(saveOpponentAnalysisAction, {
        id: "opponent-analysis-form",
        onSuccess: (state) => toast({ tone: "success", title: state.message ?? t("boutAnalysis.analysis.action.saved") }),
    });

    const completedSessionIds = useMemo(() => new Set(sessions.filter((s) => s.completed).map((s) => s.id)), [sessions]);
    const insights = useMemo(() => tacticInsights(draft, completedSessionIds), [draft, completedSessionIds]);
    const findings = useMemo(() => planFindings(draft, scheduledRounds, completedSessionIds), [draft, scheduledRounds, completedSessionIds]);
    const matchup = useMemo(() => matchupRows(draft.profile, fighter), [draft.profile, fighter]);
    const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

    const errorKeys = form.state.status === "error" ? Object.keys(form.state.fieldErrors ?? {}) : [];
    const hasError = (prefix: string) => errorKeys.some((k) => k.startsWith(prefix) && form.error(k));
    const obsNumber = new Map(draft.observations.map((o, i) => [o.id, i + 1]));
    const tacNumber = new Map(draft.tactics.map((x, i) => [x.id, i + 1]));
    const isOpen = (kind: "obs" | "tac", id: string) => open?.kind === kind && open.id === id;

    function updateProfile(patch: Partial<OpponentProfile>) {
        setDraft((d) => {
            const next = { ...(d.profile ?? {}), ...patch };
            for (const key of Object.keys(next) as (keyof OpponentProfile)[]) {
                if (next[key] === undefined) delete next[key];
            }
            return { ...d, profile: next };
        });
    }

    function updateObservation(id: string, patch: Partial<OpponentObservation>) {
        setDraft((d) => ({ ...d, observations: d.observations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
    }

    function updateTactic(id: string, patch: Partial<OpponentTactic>) {
        setDraft((d) => ({ ...d, tactics: d.tactics.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    }

    function reveal(kind: "obs" | "tac", id: string) {
        setOpen({ kind, id });
        window.requestAnimationFrame(() => {
            const row = document.getElementById(`${kind}-${id}`);
            row?.scrollIntoView({ behavior: "smooth", block: "start" });
            row?.querySelector<HTMLElement>("textarea, input")?.focus({ preventScroll: true });
        });
    }

    function addObservation() {
        const id = nextAnalysisId("obs", allIds(draft));
        setDraft((d) => ({
            ...d,
            observations: [...d.observations, { id, kind: "OPENING", text: "", evidenceUrl: null, evidenceNote: null, confidence: "ONCE" }],
        }));
        reveal("obs", id);
    }

    function acceptSuggestion(s: VideoSuggestion, url: string) {
        setDraft((d) => ({
            ...d,
            observations: [...d.observations, suggestionToObservation(s, url, nextAnalysisId("obs", allIds(d)), t("boutAnalysis.analysis.ai.note"))],
        }));
    }

    function addTactic(seed?: { text: string; observationId: string }) {
        const id = nextAnalysisId("tac", allIds(draft));
        setDraft((d) => ({
            ...d,
            tactics: [
                ...d.tactics,
                { id, text: seed?.text ?? "", round: null, observationIds: seed ? [seed.observationId] : [], sessionIds: [], partnerBrief: null },
            ],
        }));
        reveal("tac", id);
    }

    function fixAction(f: PlanFinding): ReactNode {
        if (locked) return null;
        if (f.code === "OPENING_UNUSED" || f.code === "STRENGTH_UNANSWERED") {
            return (
                <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-11 sm:min-h-9"
                    disabled={draft.tactics.length >= MAX_TACTICS}
                    onClick={() => addTactic({ observationId: f.observationId, text: t("boutAnalysis.analysis.tacticFrom", { text: asClause(f.text) }) })}
                >
                    <Plus aria-hidden className="size-4" />
                    {t("boutAnalysis.analysis.fix.createTactic")}
                </Button>
            );
        }
        if (f.code === "UNTRAINED" || f.code === "NOT_YET_PRACTISED" || f.code === "WEAK_BASIS") {
            return (
                <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-9" onClick={() => reveal("tac", f.tacticId)}>
                    {t("boutAnalysis.analysis.fix.goTo")}
                    <ChevronRight aria-hidden className="size-4" />
                </Button>
            );
        }
        return null;
    }

    const toFix = findings.filter((f) => f.level === "warning");
    const tips = findings.filter((f) => f.level === "info");
    const profile = draft.profile ?? {};

    return (
        <form {...form.formProps} className="flex min-w-0 flex-col gap-5">
            <input type="hidden" name="boutId" value={boutId} />
            <input type="hidden" name="analysis" value={JSON.stringify(draft)} />

            {locked && (
                <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning-fg ring-1 ring-inset ring-warning-border">
                    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>{t("boutAnalysis.analysis.lockedText")}</span>
                </p>
            )}
            <FormMessage {...form.message} />

            <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
                {/* 1. What the app derives — first on every screen size */}
                <section aria-labelledby="plan-health" className="min-w-0 lg:sticky lg:top-4 lg:order-2">
                    <Card className={cn("min-w-0", toFix.length > 0 ? "border-warning-border" : "border-success-border")}>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-start gap-2.5">
                                {toFix.length > 0 ? (
                                    <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-warning-fg" />
                                ) : (
                                    <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success-fg" />
                                )}
                                <div className="min-w-0">
                                    <h2 id="plan-health" className="text-base font-semibold text-fg">
                                        {toFix.length === 0 && tips.length === 0
                                            ? t("boutAnalysis.analysis.healthOkTitle")
                                            : t("boutAnalysis.analysis.healthTitle", { fix: toFix.length, tips: tips.length })}
                                    </h2>
                                    <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.checkDesc")}</p>
                                </div>
                            </div>

                            {toFix.length === 0 && tips.length === 0 && (
                                <p className="text-sm text-success-fg">{t("boutAnalysis.analysis.checkOk")}</p>
                            )}

                            {toFix.length > 0 && (
                                <ul className="flex flex-col gap-3" aria-live="polite">
                                    {toFix.map((f, idx) => (
                                        <li key={`${f.code}-${idx}`} className="flex min-w-0 flex-col items-start gap-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
                                            <span className="flex items-start gap-2 text-sm text-fg">
                                                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
                                                <span className="min-w-0 break-words">{findingText(t, f)}</span>
                                            </span>
                                            <span className="pl-6">{fixAction(f)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {tips.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        aria-expanded={showTips}
                                        onClick={() => setShowTips((v) => !v)}
                                        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary sm:min-h-9"
                                    >
                                        <ChevronDown aria-hidden className={cn("size-4 transition", showTips && "rotate-180")} />
                                        {showTips ? t("boutAnalysis.analysis.hideTips") : t("boutAnalysis.analysis.showTips", { count: tips.length })}
                                    </button>
                                    {showTips && (
                                        <ul className="flex flex-col gap-3">
                                            {tips.map((f, idx) => (
                                                <li key={`${f.code}-${idx}`} className="flex min-w-0 flex-col items-start gap-1.5">
                                                    <span className="flex items-start gap-2 text-sm text-fg-muted">
                                                        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                                                        <span className="min-w-0 break-words">{findingText(t, f)}</span>
                                                    </span>
                                                    <span className="pl-6">{fixAction(f)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {canOpenCornerCard && (
                                <Link
                                    href={`${routes.coach.bout(boutId)}/corner-card`}
                                    className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-primary underline-offset-2 hover:underline sm:min-h-9"
                                >
                                    <FileText aria-hidden className="size-4" />
                                    {t("boutAnalysis.nav.cornerCard")}
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <div className="flex min-w-0 flex-col gap-5 lg:order-1">
                    {/* 2. Opponent: one summary line, edit on demand */}
                    <ProfileSection
                        t={t}
                        opponentName={opponentName}
                        fighterName={fighterName}
                        profile={profile}
                        matchup={matchup}
                        editing={open?.kind === "profile"}
                        locked={locked}
                        onToggle={() => setOpen(open?.kind === "profile" ? null : { kind: "profile" })}
                        onChange={updateProfile}
                    />

                    {/* 3. Observations */}
                    <section aria-labelledby="obs-heading" className="flex min-w-0 flex-col gap-2">
                        <SectionHeading
                            id="obs-heading"
                            title={t("boutAnalysis.analysis.observationsTitle", { count: draft.observations.length, max: MAX_OBSERVATIONS })}
                            description={t("boutAnalysis.analysis.observationsDesc")}
                            action={
                                !locked && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="min-h-11 sm:min-h-9"
                                            aria-expanded={showAi}
                                            onClick={() => setShowAi((v) => !v)}
                                        >
                                            <Sparkles aria-hidden className="size-4" />
                                            {t("boutAnalysis.analysis.ai.open")}
                                        </Button>
                                        <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-9" disabled={draft.observations.length >= MAX_OBSERVATIONS} onClick={addObservation}>
                                            <Plus aria-hidden className="size-4" />
                                            {t("boutAnalysis.analysis.addObservation")}
                                        </Button>
                                    </div>
                                )
                            }
                        />
                        {showAi && !locked && (
                            <VideoSuggestPanel
                                t={t}
                                boutId={boutId}
                                full={draft.observations.length >= MAX_OBSERVATIONS}
                                onAccept={acceptSuggestion}
                            />
                        )}
                        {draft.observations.length === 0 && <EmptyLine>{t("boutAnalysis.analysis.noObservations")}</EmptyLine>}
                        <ul className="flex flex-col gap-2">
                            {draft.observations.map((o, i) => {
                                const users = draft.tactics.filter((x) => x.observationIds.includes(o.id)).map((x) => `#${tacNumber.get(x.id)}`);
                                const opened = isOpen("obs", o.id) || hasError(`observations.${i}.`);
                                return (
                                    <li key={o.id} id={`obs-${o.id}`} className="scroll-mt-20">
                                        <Card className={cn("min-w-0", hasError(`observations.${i}.`) && "border-danger-border")}>
                                            <RowSummary
                                                expanded={opened}
                                                onClick={() => setOpen(opened ? null : { kind: "obs", id: o.id })}
                                                lead={t("boutAnalysis.analysis.obsShort", { n: i + 1 })}
                                                title={o.text || t("boutAnalysis.analysis.untitledObs")}
                                                muted={!o.text}
                                                meta={
                                                    <>
                                                        <Badge tone={KIND_TONE[o.kind]} size="sm">{t(`boutAnalysis.analysis.kind.${o.kind}`)}</Badge>
                                                        <Badge tone={o.confidence === "REPEATED" ? "success" : "neutral"} variant="outline" size="sm">
                                                            {t(`boutAnalysis.analysis.confidence.${o.confidence}`)}
                                                        </Badge>
                                                        {o.evidenceUrl ? (
                                                            <Badge tone="neutral" variant="outline" size="sm" icon={Link2}>{t("boutAnalysis.analysis.hasLink")}</Badge>
                                                        ) : o.evidenceNote ? (
                                                            <Badge tone="neutral" variant="outline" size="sm" icon={NotebookPen}>{t("boutAnalysis.analysis.hasNote")}</Badge>
                                                        ) : (
                                                            <Badge tone="warning" size="sm">{t("boutAnalysis.analysis.noEvidence")}</Badge>
                                                        )}
                                                        <span className="text-xs text-fg-muted">
                                                            {users.length > 0 ? t("boutAnalysis.analysis.usedBy", { list: users.join(", ") }) : t("boutAnalysis.analysis.notUsed")}
                                                        </span>
                                                    </>
                                                }
                                                errorText={hasError(`observations.${i}.`) ? t("boutAnalysis.analysis.rowError") : undefined}
                                            />
                                            {opened && (
                                                <ObservationEditor
                                                    t={t}
                                                    form={form}
                                                    index={i}
                                                    observation={o}
                                                    locked={locked}
                                                    onChange={(patch) => updateObservation(o.id, patch)}
                                                    onRemove={() => {
                                                        setDraft((d) => removeObservation(d, o.id));
                                                        form.markEdited("observations");
                                                        form.markEdited("tactics");
                                                        setOpen(null);
                                                    }}
                                                    onDone={() => setOpen(null)}
                                                />
                                            )}
                                        </Card>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    {/* 4. Tactics */}
                    <section aria-labelledby="tac-heading" className="flex min-w-0 flex-col gap-2">
                        <SectionHeading
                            id="tac-heading"
                            title={t("boutAnalysis.analysis.tacticsTitle", { count: draft.tactics.length, max: MAX_TACTICS })}
                            description={t("boutAnalysis.analysis.tacticsDesc")}
                            action={
                                !locked && (
                                    <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-9" disabled={draft.tactics.length >= MAX_TACTICS} onClick={() => addTactic()}>
                                        <Plus aria-hidden className="size-4" />
                                        {t("boutAnalysis.analysis.addTactic")}
                                    </Button>
                                )
                            }
                        />
                        {draft.tactics.length === 0 && <EmptyLine>{t("boutAnalysis.analysis.noTactics")}</EmptyLine>}
                        <ul className="flex flex-col gap-2">
                            {draft.tactics.map((tactic, i) => {
                                const insight = insights.get(tactic.id);
                                const errored = hasError(`tactics.${i}.`);
                                const opened = isOpen("tac", tactic.id) || errored;
                                return (
                                    <li key={tactic.id} id={`tac-${tactic.id}`} className="scroll-mt-20">
                                        <Card className={cn("min-w-0", errored && "border-danger-border")}>
                                            <RowSummary
                                                expanded={opened}
                                                onClick={() => setOpen(opened ? null : { kind: "tac", id: tactic.id })}
                                                lead={`#${i + 1}`}
                                                title={tactic.text || t("boutAnalysis.analysis.untitledTactic")}
                                                muted={!tactic.text}
                                                meta={<TacticMeta t={t} tactic={tactic} insight={insight} obsNumber={obsNumber} />}
                                                errorText={errored ? t("boutAnalysis.analysis.rowError") : undefined}
                                            />
                                            {opened && (
                                                <TacticEditor
                                                    t={t}
                                                    form={form}
                                                    index={i}
                                                    tactic={tactic}
                                                    observations={draft.observations}
                                                    scheduledRounds={scheduledRounds}
                                                    sessions={sessions}
                                                    locked={locked}
                                                    onChange={(patch) => updateTactic(tactic.id, patch)}
                                                    onRemove={() => {
                                                        setDraft((d) => ({ ...d, tactics: d.tactics.filter((x) => x.id !== tactic.id) }));
                                                        form.markEdited("tactics");
                                                        setOpen(null);
                                                    }}
                                                    onDone={() => setOpen(null)}
                                                />
                                            )}
                                        </Card>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>
            </div>

            {/* 5. Save bar stays in reach above the mobile tab bar */}
            {!locked && (
                <div className="sticky bottom-20 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
                    <span className={cn("text-sm", dirty ? "font-semibold text-fg" : "text-fg-muted")} aria-live="polite">
                        {dirty ? t("boutAnalysis.analysis.unsaved") : t("boutAnalysis.analysis.allSaved")}
                    </span>
                    <SubmitButton size="lg" className="min-h-11" pending={form.pending} pendingLabel={t("boutAnalysis.analysis.saving")}>
                        {t("boutAnalysis.analysis.save")}
                    </SubmitButton>
                </div>
            )}
        </form>
    );
}

/** AI drafts; nothing enters the analysis until the coach accepts it. Sits inside the analysis form, so it calls the action directly. */
function VideoSuggestPanel({
    t,
    boutId,
    full,
    onAccept,
}: {
    t: Translator;
    boutId: string;
    full: boolean;
    onAccept(s: VideoSuggestion, url: string): void;
}) {
    const locale = useLocale();
    const [url, setUrl] = useState("");
    const [who, setWho] = useState("");
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<ActionState<VideoSuggestionsData> | null>(null);
    const [analysedUrl, setAnalysedUrl] = useState("");
    const [handled, setHandled] = useState<Record<number, "accepted" | "dismissed">>({});

    function run() {
        if (pending || !url.trim()) return;
        const target = url.trim();
        startTransition(async () => {
            const next = await suggestObservationsFromVideoAction(boutId, target, who);
            setResult(next);
            setAnalysedUrl(target);
            setHandled({});
        });
    }

    const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            run();
        }
    };
    const data = result?.status === "success" ? result.data : undefined;

    return (
        <Card className="min-w-0 border-ai-border bg-ai-soft">
            <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-start gap-2.5">
                    <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-ai-fg" />
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-fg">{t("boutAnalysis.analysis.ai.title")}</h3>
                        <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.ai.desc")}</p>
                    </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Field label={t("boutAnalysis.analysis.ai.url")} htmlFor="ai-video-url" error={result?.fieldErrors?.videoUrl}>
                        <Input
                            id="ai-video-url"
                            type="url"
                            inputMode="url"
                            value={url}
                            placeholder="https://www.youtube.com/watch?v=…"
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </Field>
                    <Field label={t("boutAnalysis.analysis.ai.who")} htmlFor="ai-video-who" optional>
                        <Input
                            id="ai-video-who"
                            value={who}
                            placeholder={t("boutAnalysis.analysis.ai.whoPlaceholder")}
                            onChange={(e) => setWho(e.target.value)}
                            onKeyDown={onEnter}
                        />
                    </Field>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button className="min-h-11" disabled={pending || !url.trim()} loading={pending} onClick={run}>
                        <Sparkles aria-hidden className="size-4" />
                        {t("boutAnalysis.analysis.ai.run")}
                    </Button>
                    {pending && (
                        <span role="status" className="text-sm text-fg-muted">
                            {t("boutAnalysis.analysis.ai.running")}
                        </span>
                    )}
                </div>

                {!pending && result?.status === "error" && (
                    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-fg ring-1 ring-inset ring-danger-border">
                        {result.message}
                    </p>
                )}

                {!pending && data && (
                    <div className="flex flex-col gap-2">
                        <p role="status" className="text-xs text-fg-muted">
                            {result?.message} {t("boutAnalysis.analysis.ai.analyzedAt", { time: formatDateTime(data.analyzedAt, locale) })}
                            {data.cached && ` (${t("boutAnalysis.analysis.ai.cachedNote")})`}
                        </p>
                        <p className="text-xs font-medium text-warning-fg">{t("boutAnalysis.analysis.ai.disclaimer")}</p>
                        <ul className="flex flex-col gap-2">
                            {data.suggestions.map((s, idx) => {
                                const state = handled[idx];
                                if (state === "dismissed") return null;
                                return (
                                    <li key={idx} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                                        <p className="break-words text-sm font-medium text-fg">{s.text}</p>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge tone={KIND_TONE[s.kind]} size="sm">{t(`boutAnalysis.analysis.kind.${s.kind}`)}</Badge>
                                            <Badge tone={s.confidence === "REPEATED" ? "success" : "neutral"} variant="outline" size="sm">
                                                {t(`boutAnalysis.analysis.confidence.${s.confidence}`)}
                                            </Badge>
                                            <a
                                                href={videoUrlAt(analysedUrl, s.time)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                                            >
                                                <Play aria-hidden className="size-3.5" />
                                                {t("boutAnalysis.analysis.ai.watch", { time: s.time })}
                                            </a>
                                        </div>
                                        {state === "accepted" ? (
                                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-fg">
                                                <Check aria-hidden className="size-4" />
                                                {t("boutAnalysis.analysis.ai.accepted")}
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    className="min-h-11 sm:min-h-9"
                                                    disabled={full}
                                                    onClick={() => {
                                                        onAccept(s, analysedUrl);
                                                        setHandled((h) => ({ ...h, [idx]: "accepted" }));
                                                    }}
                                                >
                                                    <Check aria-hidden className="size-4" />
                                                    {t("boutAnalysis.analysis.ai.accept")}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="min-h-11 sm:min-h-9"
                                                    onClick={() => setHandled((h) => ({ ...h, [idx]: "dismissed" }))}
                                                >
                                                    {t("boutAnalysis.analysis.ai.dismiss")}
                                                </Button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {full && <p className="text-xs text-fg-muted">{t("boutAnalysis.analysis.ai.full")}</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SectionHeading({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
                <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
                <p className="text-xs text-fg-muted">{description}</p>
            </div>
            {action}
        </div>
    );
}

function EmptyLine({ children }: { children: ReactNode }) {
    return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-fg-muted">{children}</p>;
}

/** Collapsed, read-first row; the whole row is the toggle. */
function RowSummary({
    expanded,
    onClick,
    lead,
    title,
    muted,
    meta,
    errorText,
}: {
    expanded: boolean;
    onClick(): void;
    lead: string;
    title: string;
    muted?: boolean;
    meta: ReactNode;
    errorText?: string;
}) {
    return (
        <button
            type="button"
            aria-expanded={expanded}
            onClick={onClick}
            className="flex min-h-11 w-full min-w-0 items-start gap-3 rounded-xl p-3 text-left transition hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <span className="mt-0.5 inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted px-1.5 text-xs font-bold text-fg">
                {lead}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cn("break-words text-sm font-medium", muted ? "italic text-fg-muted" : "text-fg")}>{title}</span>
                <span className="flex flex-wrap items-center gap-1.5">{meta}</span>
                {errorText && <span className="text-xs font-semibold text-danger-fg">{errorText}</span>}
            </span>
            <ChevronDown aria-hidden className={cn("mt-0.5 size-5 shrink-0 text-fg-muted transition", expanded && "rotate-180")} />
        </button>
    );
}

function TacticMeta({
    t,
    tactic,
    insight,
    obsNumber,
}: {
    t: Translator;
    tactic: OpponentTactic;
    insight: TacticInsight | undefined;
    obsNumber: Map<string, number>;
}) {
    return (
        <>
            {tactic.observationIds.map((id) => (
                <Badge key={id} tone="neutral" variant="outline" size="sm">
                    {t("boutAnalysis.analysis.obsShort", { n: obsNumber.get(id) ?? "?" })}
                </Badge>
            ))}
            <Badge tone="neutral" variant="outline" size="sm">
                {tactic.round === null ? t("boutAnalysis.analysis.allRounds") : t("boutAnalysis.analysis.roundOption", { round: tactic.round })}
            </Badge>
            {insight?.practice === "PRACTISED" && <Badge tone="success" size="sm" icon={Check}>{t("boutAnalysis.cornerCard.trainedBadge")}</Badge>}
            {insight?.practice === "SCHEDULED" && <Badge tone="info" size="sm">{t("boutAnalysis.analysis.practice.SCHEDULED")}</Badge>}
            {insight?.practice === "NONE" && <Badge tone="warning" size="sm" icon={TriangleAlert}>{t("boutAnalysis.cornerCard.untrainedBadge")}</Badge>}
            {insight && tactic.observationIds.length > 0 && (
                <span className="text-xs text-fg-muted">
                    {t(`boutAnalysis.cornerCard.basis.${insight.basis}`)} · {t("boutAnalysis.analysis.cardOrder", { n: insight.cardOrder })}
                </span>
            )}
        </>
    );
}

function EditorFooter({ t, locked, onRemove, onDone }: { t: Translator; locked: boolean; onRemove(): void; onDone(): void }) {
    return (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            {!locked ? (
                <Button variant="ghost" size="sm" className="min-h-11 text-danger-fg sm:min-h-9" onClick={onRemove}>
                    <Trash2 aria-hidden className="size-4" />
                    {t("boutAnalysis.analysis.remove")}
                </Button>
            ) : (
                <span />
            )}
            <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-9" onClick={onDone}>
                {t("boutAnalysis.analysis.done")}
            </Button>
        </div>
    );
}

/** Segmented choice for short enums: one tap, no dropdown. */
function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    error,
    name,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange(value: T): void;
    error?: string;
    name: string;
}) {
    return (
        <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
                {options.map((o) => {
                    const selected = o.value === value;
                    return (
                        <button
                            key={o.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            name={name}
                            onClick={() => onChange(o.value)}
                            className={cn(
                                "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-9",
                                selected ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-surface-hover",
                            )}
                        >
                            {o.label}
                        </button>
                    );
                })}
            </div>
            {error && <p role="alert" className="text-xs text-danger-fg">{error}</p>}
        </fieldset>
    );
}

function ObservationEditor({
    t,
    form,
    index,
    observation: o,
    locked,
    onChange,
    onRemove,
    onDone,
}: {
    t: Translator;
    form: Form;
    index: number;
    observation: OpponentObservation;
    locked: boolean;
    onChange(patch: Partial<OpponentObservation>): void;
    onRemove(): void;
    onDone(): void;
}) {
    const textControl = form.control(`observations.${index}.text`);
    const urlControl = form.control(`observations.${index}.evidenceUrl`);
    const noteControl = form.control(`observations.${index}.evidenceNote`);
    return (
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-t border-border px-3 pb-3 pt-4">
            <Field label={t("boutAnalysis.analysis.text")} htmlFor={textControl.id} error={form.error(textControl.name)}>
                <Textarea
                    {...textControl}
                    rows={2}
                    maxLength={300}
                    value={o.text}
                    placeholder={t("boutAnalysis.analysis.textPlaceholder")}
                    onChange={(e) => onChange({ text: e.target.value })}
                />
            </Field>
            <Segmented
                label={t("boutAnalysis.analysis.kind")}
                name={`observations.${index}.kind`}
                value={o.kind}
                options={KINDS.map((k) => ({ value: k, label: t(`boutAnalysis.analysis.kind.${k}`) }))}
                onChange={(kind) => onChange({ kind })}
            />
            <Segmented
                label={t("boutAnalysis.analysis.confidence")}
                name={`observations.${index}.confidence`}
                value={o.confidence}
                options={CONFIDENCES.map((c) => ({ value: c, label: t(`boutAnalysis.analysis.confidence.${c}`) }))}
                onChange={(confidence) => onChange({ confidence })}
            />
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("boutAnalysis.analysis.evidenceNote")} htmlFor={noteControl.id} error={form.error(noteControl.name)} optional>
                    <Input
                        {...noteControl}
                        value={o.evidenceNote ?? ""}
                        placeholder={t("boutAnalysis.analysis.evidenceNotePlaceholder")}
                        onChange={(e) => onChange({ evidenceNote: e.target.value || null })}
                    />
                </Field>
                <Field label={t("boutAnalysis.analysis.evidenceUrl")} htmlFor={urlControl.id} error={form.error(urlControl.name)} optional>
                    <Input
                        {...urlControl}
                        type="url"
                        inputMode="url"
                        value={o.evidenceUrl ?? ""}
                        placeholder="https://"
                        onChange={(e) => onChange({ evidenceUrl: e.target.value || null })}
                    />
                </Field>
            </div>
            <EditorFooter t={t} locked={locked} onRemove={onRemove} onDone={onDone} />
        </fieldset>
    );
}

function TacticEditor({
    t,
    form,
    index,
    tactic,
    observations,
    scheduledRounds,
    sessions,
    locked,
    onChange,
    onRemove,
    onDone,
}: {
    t: Translator;
    form: Form;
    index: number;
    tactic: OpponentTactic;
    observations: OpponentObservation[];
    scheduledRounds: number | null;
    sessions: CampSessionOption[];
    locked: boolean;
    onChange(patch: Partial<OpponentTactic>): void;
    onRemove(): void;
    onDone(): void;
}) {
    const locale = useLocale();
    const textControl = form.control(`tactics.${index}.text`);
    const briefControl = form.control(`tactics.${index}.partnerBrief`);
    const basisError = form.error(`tactics.${index}.observationIds`);
    const roundError = form.error(`tactics.${index}.round`);
    const known = new Set(sessions.map((s) => s.id));
    const linked = tactic.sessionIds.filter((id) => known.has(id));
    const otherLinked = tactic.sessionIds.length - linked.length;
    const doneCount = sessions.filter((s) => s.completed && tactic.sessionIds.includes(s.id)).length;
    const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const groups = [
        { key: "done", label: t("boutAnalysis.analysis.sessionsDoneGroup"), items: sessions.filter((s) => s.completed) },
        { key: "upcoming", label: t("boutAnalysis.analysis.sessionsUpcomingGroup"), items: sessions.filter((s) => !s.completed) },
    ].filter((g) => g.items.length > 0);

    return (
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-t border-border px-3 pb-3 pt-4">
            <Field label={t("boutAnalysis.analysis.tacticText")} htmlFor={textControl.id} error={form.error(textControl.name)}>
                <Textarea
                    {...textControl}
                    rows={2}
                    value={tactic.text}
                    placeholder={t("boutAnalysis.analysis.tacticPlaceholder")}
                    onChange={(e) => onChange({ text: e.target.value })}
                />
            </Field>

            <fieldset className="flex min-w-0 flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium text-fg">{t("boutAnalysis.analysis.basis")}</legend>
                {observations.length === 0 ? (
                    <p className="text-sm text-fg-muted">{t("boutAnalysis.analysis.basisEmpty")}</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {observations.map((o, oi) => {
                            const on = tactic.observationIds.includes(o.id);
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => {
                                        onChange({ observationIds: toggle(tactic.observationIds, o.id) });
                                        form.markEdited(`tactics.${index}.observationIds`);
                                    }}
                                    className={cn(TOGGLE, on ? "border-primary bg-primary-soft text-fg" : "border-border bg-surface text-fg hover:bg-surface-hover")}
                                >
                                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-fg" : "border-border")}>
                                        {on && <Check aria-hidden className="size-3.5" />}
                                    </span>
                                    <span className="shrink-0 text-xs font-bold">{t("boutAnalysis.analysis.obsShort", { n: oi + 1 })}</span>
                                    <span className="min-w-0 truncate">{o.text || t("boutAnalysis.analysis.untitledObs")}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
                {basisError && <p role="alert" className="text-xs text-danger-fg">{basisError}</p>}
            </fieldset>

            <Segmented
                label={t("boutAnalysis.analysis.round")}
                name={`tactics.${index}.round`}
                value={tactic.round === null ? "all" : String(tactic.round)}
                options={[
                    { value: "all", label: t("boutAnalysis.analysis.allRounds") },
                    ...Array.from({ length: scheduledRounds ?? 0 }, (_, r) => ({ value: String(r + 1), label: t("boutAnalysis.analysis.roundOption", { round: r + 1 }) })),
                ]}
                onChange={(v) => onChange({ round: v === "all" ? null : Number(v) })}
                error={roundError}
            />

            <details className="group min-w-0 rounded-lg border border-border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0">
                        <span className="font-medium text-fg">{t("boutAnalysis.analysis.chooseSessions")}</span>
                        <span className="block text-xs text-fg-muted">
                            {t("boutAnalysis.analysis.sessionsSummary", { linked: tactic.sessionIds.length, done: doneCount })}
                            {otherLinked > 0 && ` · ${t("boutAnalysis.analysis.sessionsOther", { count: otherLinked })}`}
                        </span>
                    </span>
                    <ChevronDown aria-hidden className="size-5 shrink-0 text-fg-muted transition group-open:rotate-180" />
                </summary>
                <div className="flex max-h-80 flex-col gap-3 overflow-y-auto border-t border-border p-2">
                    {groups.length === 0 && <p className="px-1 text-sm text-fg-muted">{t("boutAnalysis.analysis.sessionsEmpty")}</p>}
                    {groups.map((g) => (
                        <div key={g.key} role="group" aria-labelledby={`sessions-${tactic.id}-${g.key}`} className="flex flex-col gap-1.5">
                            <p id={`sessions-${tactic.id}-${g.key}`} className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{g.label}</p>
                            {g.items.map((s) => {
                                const on = tactic.sessionIds.includes(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => onChange({ sessionIds: toggle(tactic.sessionIds, s.id) })}
                                        className={cn(TOGGLE, on ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-hover")}
                                    >
                                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-fg" : "border-border")}>
                                            {on && <Check aria-hidden className="size-3.5" />}
                                        </span>
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-fg">{s.title}</span>
                                            <span className="text-xs text-fg-muted">
                                                {formatDate(s.scheduledAt, locale)} · {trainingTypeLabel(t, s.type)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </details>

            <Field label={t("boutAnalysis.analysis.partnerBrief")} htmlFor={briefControl.id} error={form.error(briefControl.name)} optional>
                <Input
                    {...briefControl}
                    value={tactic.partnerBrief ?? ""}
                    placeholder={t("boutAnalysis.analysis.partnerBriefPlaceholder")}
                    onChange={(e) => onChange({ partnerBrief: e.target.value || null })}
                />
            </Field>

            <EditorFooter t={t} locked={locked} onRemove={onRemove} onDone={onDone} />
        </fieldset>
    );
}

function ProfileSection({
    t,
    opponentName,
    fighterName,
    profile,
    matchup,
    editing,
    locked,
    onToggle,
    onChange,
}: {
    t: Translator;
    opponentName: string;
    fighterName: string;
    profile: OpponentProfile;
    matchup: MatchupRow[];
    editing: boolean;
    locked: boolean;
    onToggle(): void;
    onChange(patch: Partial<OpponentProfile>): void;
}) {
    const record = [profile.wins, profile.losses, profile.draws].some((v) => v !== undefined)
        ? `${profile.wins ?? 0}-${profile.losses ?? 0}-${profile.draws ?? 0}`
        : null;
    const summary = [
        record,
        profile.stance && t(`boutAnalysis.analysis.stance.${profile.stance}`),
        profile.style && t(`boutAnalysis.analysis.style.${profile.style}`),
    ].filter(Boolean);

    return (
        <section aria-labelledby="profile-heading">
            <Card className="min-w-0">
                <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h2 id="profile-heading" className="text-base font-semibold text-fg">{opponentName}</h2>
                            <p className="text-sm text-fg-muted">{summary.length > 0 ? summary.join(" · ") : t("boutAnalysis.analysis.profileEmpty")}</p>
                        </div>
                        {!locked && (
                            <Button variant="secondary" size="sm" className="min-h-11 shrink-0 sm:min-h-9" aria-expanded={editing} onClick={onToggle}>
                                {editing ? t("boutAnalysis.analysis.done") : (
                                    <>
                                        <Pencil aria-hidden className="size-4" />
                                        {t("boutAnalysis.analysis.edit")}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {matchup.length > 0 && (
                        <table className="w-full text-sm">
                            <caption className="sr-only">{t("boutAnalysis.analysis.matchupTitle")}</caption>
                            <thead>
                                <tr className="text-left text-xs text-fg-muted">
                                    <th scope="col" className="pb-1 font-medium"><span className="sr-only">{t("boutAnalysis.analysis.matchupTitle")}</span></th>
                                    <th scope="col" className="pb-1 font-medium">{t("boutAnalysis.analysis.matchupOpponent")}</th>
                                    <th scope="col" className="pb-1 font-medium">{fighterName}</th>
                                    <th scope="col" className="pb-1 text-right font-medium">{t("boutAnalysis.analysis.matchupDiff")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matchup.map((row) => {
                                    const [label, opponent, ours, diff] = matchupCells(t, row);
                                    return (
                                        <tr key={row.field} className={cn("border-t border-border", row.notable ? "font-semibold text-warning-fg" : "text-fg")}>
                                            <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                                                {label}
                                                {row.notable && <span className="sr-only"> ({t("boutAnalysis.analysis.matchupNotable")})</span>}
                                            </th>
                                            <td className="py-1.5 pr-2">{opponent}</td>
                                            <td className="py-1.5 pr-2">{ours}</td>
                                            <td className="py-1.5 text-right tabular-nums">
                                                {row.notable && <TriangleAlert aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />}
                                                {diff}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {editing && (
                        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
                            <Segmented
                                label={t("boutAnalysis.analysis.stance")}
                                name="profile.stance"
                                value={profile.stance ?? ""}
                                options={[{ value: "", label: t("boutAnalysis.analysis.unknown") }, ...STANCES.map((s) => ({ value: s, label: t(`boutAnalysis.analysis.stance.${s}`) }))]}
                                onChange={(v) => onChange({ stance: (v || undefined) as OpponentProfile["stance"] })}
                            />
                            <div className="grid min-w-0 grid-cols-2 gap-3">
                                {(["heightCm", "reachCm"] as const).map((key) => (
                                    <Field key={key} label={t(`boutAnalysis.analysis.${key}`)} htmlFor={`profile-${key}`}>
                                        <Input
                                            id={`profile-${key}`}
                                            type="number"
                                            min={1}
                                            inputMode="numeric"
                                            value={profile[key] ?? ""}
                                            onChange={(e) => onChange({ [key]: numberOrUndefined(e.target.value) })}
                                        />
                                    </Field>
                                ))}
                            </div>
                            <div className="grid min-w-0 grid-cols-3 gap-3">
                                {(["wins", "losses", "draws"] as const).map((key) => (
                                    <Field key={key} label={t(`boutAnalysis.analysis.${key}`)} htmlFor={`profile-${key}`}>
                                        <Input
                                            id={`profile-${key}`}
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            value={profile[key] ?? ""}
                                            onChange={(e) => {
                                                const n = Number(e.target.value);
                                                onChange({ [key]: e.target.value === "" || !Number.isInteger(n) || n < 0 ? undefined : n });
                                            }}
                                        />
                                    </Field>
                                ))}
                            </div>
                            <Field label={t("boutAnalysis.analysis.style")} htmlFor="profile-style">
                                <Select
                                    id="profile-style"
                                    value={profile.style ?? ""}
                                    onChange={(e) => onChange({ style: (e.target.value || undefined) as OpponentProfile["style"] })}
                                >
                                    <option value="">{t("boutAnalysis.analysis.unknown")}</option>
                                    {STYLES.map((s) => (
                                        <option key={s} value={s}>{t(`boutAnalysis.analysis.style.${s}`)}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label={t("boutAnalysis.analysis.source")} htmlFor="profile-source" optional>
                                <Input
                                    id="profile-source"
                                    value={profile.source ?? ""}
                                    placeholder={t("boutAnalysis.analysis.sourcePlaceholder")}
                                    onChange={(e) => onChange({ source: e.target.value || undefined })}
                                />
                            </Field>
                        </fieldset>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
