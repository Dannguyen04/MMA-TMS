"use client";

import { LayoutTemplate, ListChecks, Plus, Sparkle } from "lucide-react";
import { useRef, useState } from "react";

import { InjuryCard } from "@/components/domain/injury-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormMessage, FormSection, Input, Select } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createRecoveryPlanAction } from "@/lib/actions/clinical";
import { BODY_REGION_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { addDaysToKey, dayKey, daysBetweenKeys, formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { injuryPhrase } from "./clinical-copy";
import { PhaseBuilder, type PhaseDraft } from "./phase-builder";
import { RECOVERY_TEMPLATES, recommendedTemplate, type RecoveryTemplate } from "./recovery-templates";

export interface RecoveryInjuryOption {
    injury: Injury;
    fighterName: string;
}

export interface RecoveryPlanFormProps {
    /** Open injuries of assigned fighters without a plan in progress. */
    injuries: RecoveryInjuryOption[];
    defaultInjuryId: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    /** Server time (ISO) for relative dates on the injury card. */
    now: string;
    cancelHref: string;
}

type KeyFactory = () => number;

/** Sequential React keys; deterministic for the initial render so server and client ids match. */
function keySequence(start = 0): KeyFactory {
    let value = start;
    return () => {
        value += 1;
        return value;
    };
}

function phasesFromTemplate(template: RecoveryTemplate, startDate: string, makeKey: KeyFactory): PhaseDraft[] {
    let offset = 0;
    return template.phases.map((phase) => {
        const draft: PhaseDraft = {
            key: makeKey(),
            name: phase.name,
            goal: phase.goal,
            startDate: addDaysToKey(startDate, offset),
            endDate: addDaysToKey(startDate, offset + phase.durationDays),
            milestones: phase.milestones.map((text) => ({ key: makeKey(), text })),
        };
        offset += phase.durationDays;
        return draft;
    });
}

function blankPhase(startDate: string, makeKey: KeyFactory): PhaseDraft {
    return { key: makeKey(), name: "", goal: "", startDate, endDate: addDaysToKey(startDate, 7), milestones: [{ key: makeKey(), text: "" }] };
}

function defaultTitle(injury: Injury): string {
    if (injury.type === "concussion") return "Concussion — graded return to training";
    return `${BODY_REGION_LABELS[injury.bodyRegion]} ${INJURY_TYPE_LABELS[injury.type].toLowerCase()} — return to training`;
}

/** Creates a phased recovery plan for an open injury, optionally starting from a template. */
export function RecoveryPlanForm({ injuries, defaultInjuryId, today, now, cancelHref }: RecoveryPlanFormProps) {
    const form = useActionForm(createRecoveryPlanAction, { id: "recovery" });
    const { control, error, markEdited } = form;
    const id = (name: string) => `recovery-${name}`;
    const keyFactory = useRef<KeyFactory | null>(null);
    /** Keys for phases and milestones added after the first render (event handlers only). */
    const makeKey = () => {
        keyFactory.current ??= keySequence(10_000);
        return keyFactory.current();
    };

    const initialInjury = injuries.find((option) => option.injury.id === defaultInjuryId)?.injury ?? null;
    const [injuryId, setInjuryId] = useState(initialInjury?.id ?? "");
    const [title, setTitle] = useState(initialInjury ? defaultTitle(initialInjury) : "");
    const [titleTouched, setTitleTouched] = useState(false);
    const [startDate, setStartDate] = useState(today);
    const [templateId, setTemplateId] = useState<RecoveryTemplate["id"] | null>(initialInjury ? recommendedTemplate(initialInjury.type).id : null);
    const [phases, setPhases] = useState<PhaseDraft[]>(() =>
        initialInjury ? phasesFromTemplate(recommendedTemplate(initialInjury.type), today, keySequence()) : [blankPhase(today, keySequence())],
    );
    const [phasesEdited, setPhasesEdited] = useState(false);
    const [targetReturnDate, setTargetReturnDate] = useState(() => phases.at(-1)?.endDate ?? addDaysToKey(today, 28));
    const [pendingTemplate, setPendingTemplate] = useState<RecoveryTemplate | null>(null);

    const selected = injuries.find((option) => option.injury.id === injuryId) ?? null;
    const recommended = selected ? recommendedTemplate(selected.injury.type) : null;
    const planDays = startDate && targetReturnDate ? daysBetweenKeys(startDate, targetReturnDate) : null;

    /** Adding, removing, moving or replacing phases shifts their indexes, so every phase error is stale. */
    const phasesChanged = () => markEdited("phases");

    const applyTemplate = (template: RecoveryTemplate) => {
        const next = phasesFromTemplate(template, startDate || today, makeKey);
        setPhases(next);
        phasesChanged();
        setTemplateId(template.id);
        setPhasesEdited(false);
        setTargetReturnDate(next.at(-1)?.endDate ?? targetReturnDate);
        setPendingTemplate(null);
    };

    const requestTemplate = (template: RecoveryTemplate) => {
        if (phasesEdited) setPendingTemplate(template);
        else applyTemplate(template);
    };

    const changeInjury = (nextId: string) => {
        setInjuryId(nextId);
        const injury = injuries.find((option) => option.injury.id === nextId)?.injury;
        if (!injury) return;
        if (!titleTouched) setTitle(defaultTitle(injury));
        if (!phasesEdited) applyTemplate(recommendedTemplate(injury.type));
    };

    const changeStart = (value: string) => {
        const shift = startDate && value ? daysBetweenKeys(startDate, value) : 0;
        setStartDate(value);
        if (shift === 0 || Number.isNaN(shift)) return;
        setPhases((current) =>
            current.map((phase) => ({ ...phase, startDate: addDaysToKey(phase.startDate, shift), endDate: addDaysToKey(phase.endDate, shift) })),
        );
        setTargetReturnDate((current) => addDaysToKey(current, shift));
    };

    const updatePhase = (key: number, patch: Partial<Omit<PhaseDraft, "key">>) => {
        const index = phases.findIndex((phase) => phase.key === key);
        setPhases((current) => current.map((phase) => (phase.key === key ? { ...phase, ...patch } : phase)));
        Object.keys(patch).forEach((field) => markEdited(`phases.${index}.${field}`));
        setPhasesEdited(true);
    };

    const movePhase = (key: number, offset: -1 | 1) => {
        setPhases((current) => {
            const index = current.findIndex((phase) => phase.key === key);
            const target = index + offset;
            if (index === -1 || target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        phasesChanged();
        setPhasesEdited(true);
    };

    const removePhase = (key: number) => {
        setPhases((current) => (current.length > 1 ? current.filter((phase) => phase.key !== key) : current));
        phasesChanged();
        setPhasesEdited(true);
    };

    const addMilestone = (key: number) => {
        const milestone = { key: makeKey(), text: "" };
        setPhases((current) => current.map((phase) => (phase.key === key ? { ...phase, milestones: [...phase.milestones, milestone] } : phase)));
        markEdited(`phases.${phases.findIndex((phase) => phase.key === key)}.milestones`);
        setPhasesEdited(true);
    };

    const addPhase = () => {
        const phase = blankPhase(phases.at(-1)?.endDate ?? (startDate || today), makeKey);
        setPhases((current) => [...current, phase]);
        phasesChanged();
        setPhasesEdited(true);
    };

    const lastPhaseEnd = phases.at(-1)?.endDate ?? "";
    const serializedPhases = JSON.stringify(
        phases.map(({ name, goal, startDate: phaseStart, endDate, milestones }) => ({
            name,
            goal,
            startDate: phaseStart,
            endDate,
            milestones: milestones.map((milestone) => milestone.text),
        })),
    );

    return (
        <form
            {...form.formProps}
            className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
            <input type="hidden" name="phases" value={serializedPhases} />
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <FormSection title="Injury & plan" description="The injury this plan treats, what to call it, and the planned return date.">
                    <Field
                        label="Injury"
                        htmlFor={id("injuryId")}
                        error={error("injuryId")}
                        required
                        hint={
                            injuries.length === 0
                                ? "Every open injury already has a recovery plan in progress."
                                : "Open injuries without a plan in progress."
                        }
                    >
                        <Select {...control("injuryId", { hint: true, required: true })} value={injuryId} onChange={(event) => changeInjury(event.target.value)}>
                            <option value="">Choose an injury…</option>
                            {injuries.map(({ injury, fighterName }) => (
                                <option key={injury.id} value={injury.id}>
                                    {fighterName} — {injuryPhrase(injury)} ({formatDate(injury.occurredAt)})
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Plan title" htmlFor={id("title")} error={error("title")} required hint="Shown to the fighter on their Health page.">
                        <Input
                            {...control("title", { hint: true, required: true })}
                            value={title}
                            maxLength={120}
                            onChange={(event) => {
                                setTitle(event.target.value);
                                setTitleTouched(true);
                            }}
                        />
                    </Field>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Start date" htmlFor={id("startDate")} error={error("startDate")} required hint="Moving it shifts every phase.">
                            <Input {...control("startDate", { hint: true, required: true })} type="date" value={startDate} onChange={(event) => changeStart(event.target.value)} />
                        </Field>
                        <Field
                            label="Target return"
                            htmlFor={id("targetReturnDate")}
                            error={error("targetReturnDate")}
                            required
                            hint={planDays !== null && planDays >= 0 ? `${pluralize(planDays, "day")} from the start` : undefined}
                        >
                            <Input
                                {...control("targetReturnDate", { hint: planDays !== null && planDays >= 0, required: true })}
                                type="date"
                                value={targetReturnDate}
                                min={startDate || undefined}
                                onChange={(event) => setTargetReturnDate(event.target.value)}
                            />
                        </Field>
                    </div>
                    {selected?.injury.expectedReturnAt && dayKey(selected.injury.expectedReturnAt) !== targetReturnDate && (
                        <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
                            The injury record expects a return on {formatDate(selected.injury.expectedReturnAt)}.
                            <Button
                                variant="ghost"
                                size="sm"
                                className="-my-1 h-7 px-2 text-primary-soft-fg"
                                onClick={() => {
                                    if (!selected.injury.expectedReturnAt) return;
                                    setTargetReturnDate(dayKey(selected.injury.expectedReturnAt));
                                    markEdited("targetReturnDate");
                                }}
                            >
                                Use that date
                            </Button>
                        </p>
                    )}
                </FormSection>

                <FormSection
                    title="Template"
                    description="Start from a typical protocol, then adjust it to the athlete. Applying a template replaces the phases below."
                >
                    <div role="group" aria-label="Recovery plan templates" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {RECOVERY_TEMPLATES.map((template) => {
                            const isApplied = template.id === templateId && !phasesEdited;
                            return (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => requestTemplate(template)}
                                    aria-pressed={isApplied}
                                    className={cn(
                                        "flex items-start gap-3 rounded-lg border bg-surface p-3 text-left transition-colors",
                                        isApplied
                                            ? "border-transparent ring-2 ring-primary"
                                            : "border-border hover:border-border-strong hover:bg-surface-muted/50",
                                    )}
                                >
                                    <LayoutTemplate aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                                    <span className="min-w-0">
                                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-fg">
                                            {template.label}
                                            {selected && recommended?.id === template.id && (
                                                <Badge tone="primary" size="sm" icon={Sparkle}>
                                                    Suggested for {INJURY_TYPE_LABELS[selected.injury.type].toLowerCase()}
                                                </Badge>
                                            )}
                                        </span>
                                        <span className="mt-0.5 block text-[13px] text-fg-muted">{template.summary}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </FormSection>

                <FormSection
                    title="Phases"
                    description="Each phase has a goal and milestones. Progress counts completed phases plus milestones done in the current phase."
                >
                    <PhaseBuilder
                        phases={phases}
                        error={error}
                        idPrefix={id("phase")}
                        onChange={updatePhase}
                        onMove={movePhase}
                        onRemove={removePhase}
                        onAddMilestone={addMilestone}
                    />
                    {error("phases") && <p className="text-[13px] font-medium text-danger-fg">{error("phases")}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={addPhase} disabled={phases.length >= 10}>
                            <Plus aria-hidden />
                            Add phase
                        </Button>
                        {lastPhaseEnd && targetReturnDate && lastPhaseEnd !== targetReturnDate && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary-soft-fg"
                                onClick={() => {
                                    setTargetReturnDate(lastPhaseEnd);
                                    markEdited("targetReturnDate");
                                }}
                            >
                                Set target return to the last phase end ({formatDate(`${lastPhaseEnd}T12:00:00Z`)})
                            </Button>
                        )}
                    </div>
                </FormSection>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <ButtonLink href={cancelHref} variant="secondary" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Cancel
                        </ButtonLink>
                        <Button type="submit" size="lg" loading={form.pending} disabled={injuries.length === 0} className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {form.pending ? "Creating plan…" : "Create recovery plan"}
                        </Button>
                    </div>
                </div>
            </Card>

            <aside aria-label="Selected injury" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
                {selected ? (
                    <section aria-labelledby="recovery-injury-heading" className="flex flex-col gap-2">
                        <h2 id="recovery-injury-heading" className="text-sm font-semibold text-fg">
                            {selected.fighterName}
                        </h2>
                        <InjuryCard injury={selected.injury} now={now} />
                    </section>
                ) : null}
                <Card>
                    <CardHeader title="Plan overview" icon={<ListChecks />} />
                    <CardContent>
                        <ol className="flex flex-col gap-2">
                            {phases.map((phase, index) => (
                                <li key={phase.key} className="flex items-start gap-2.5 text-[13px]">
                                    <span
                                        aria-hidden
                                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-fg-muted ring-1 ring-border"
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className={cn("block font-medium", phase.name ? "text-fg" : "text-fg-subtle")}>
                                            {phase.name || "Unnamed phase"}
                                        </span>
                                        <span className="text-fg-muted">
                                            {pluralize(phase.milestones.filter((m) => m.text.trim()).length, "milestone")}
                                            {phase.startDate &&
                                                phase.endDate &&
                                                ` · ${pluralize(Math.max(0, daysBetweenKeys(phase.startDate, phase.endDate)), "day")}`}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-4 border-t border-border pt-3 text-[13px] text-fg-muted">
                            The first phase starts as current. The fighter is notified and coaches are told a return-to-training plan has started —
                            without clinical detail.
                        </p>
                    </CardContent>
                </Card>
            </aside>

            <ConfirmDialog
                open={pendingTemplate !== null}
                onClose={() => setPendingTemplate(null)}
                onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
                title="Replace your phases?"
                description={`Applying the ${pendingTemplate?.label.toLowerCase() ?? ""} template replaces the phases and milestones you've edited. This can't be undone.`}
                confirmLabel="Replace phases"
            />
        </form>
    );
}
