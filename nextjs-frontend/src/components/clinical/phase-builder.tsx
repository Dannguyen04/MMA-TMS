"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { daysBetweenKeys, pluralize } from "@/lib/format";

export interface MilestoneDraft {
    key: number;
    text: string;
}

export interface PhaseDraft {
    key: number;
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    milestones: MilestoneDraft[];
}

export interface PhaseBuilderProps {
    phases: PhaseDraft[];
    /** Field error by action name, e.g. "phases.0.name" (hidden once edited). */
    error: (name: string) => string | undefined;
    idPrefix: string;
    onChange: (key: number, patch: Partial<Omit<PhaseDraft, "key">>) => void;
    onMove: (key: number, offset: -1 | 1) => void;
    onRemove: (key: number) => void;
    onAddMilestone: (key: number) => void;
}

/** Ordered list of editable recovery phases with dates, goal and milestones. */
export function PhaseBuilder({ phases, error: errorFor, idPrefix, onChange, onMove, onRemove, onAddMilestone }: PhaseBuilderProps) {
    return (
        <ol className="flex flex-col gap-4" aria-label="Recovery phases">
            {phases.map((phase, index) => {
                const id = (name: string) => `${idPrefix}-${phase.key}-${name}`;
                const error = (name: string) => errorFor(`phases.${index}.${name}`);
                const length = phase.startDate && phase.endDate ? daysBetweenKeys(phase.startDate, phase.endDate) : null;
                const milestonesError = error("milestones");

                return (
                    <li key={phase.key} className="rounded-xl border border-border bg-surface-muted/40 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                                <span
                                    aria-hidden
                                    className="flex size-7 items-center justify-center rounded-full bg-info-soft text-xs text-info-fg ring-1 ring-info-border"
                                >
                                    {index + 1}
                                </span>
                                Phase {index + 1}
                                {length !== null && length >= 0 && (
                                    <span className="text-[13px] font-normal text-fg-muted">· {pluralize(length, "day")}</span>
                                )}
                            </h3>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onMove(phase.key, -1)}
                                    disabled={index === 0}
                                    aria-label={`Move phase ${index + 1} up`}
                                >
                                    <ArrowUp />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onMove(phase.key, 1)}
                                    disabled={index === phases.length - 1}
                                    aria-label={`Move phase ${index + 1} down`}
                                >
                                    <ArrowDown />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onRemove(phase.key)}
                                    disabled={phases.length === 1}
                                    aria-label={`Remove phase ${index + 1}`}
                                    className="hover:text-danger-fg"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Phase name" htmlFor={id("name")} error={error("name")} required className="sm:col-span-2">
                                <Input
                                    id={id("name")}
                                    value={phase.name}
                                    onChange={(event) => onChange(phase.key, { name: event.target.value })}
                                    maxLength={80}
                                />
                            </Field>
                            <Field label="Starts" htmlFor={id("startDate")} error={error("startDate")} required>
                                <Input
                                    id={id("startDate")}
                                    type="date"
                                    value={phase.startDate}
                                    onChange={(event) => onChange(phase.key, { startDate: event.target.value })}
                                />
                            </Field>
                            <Field label="Ends" htmlFor={id("endDate")} error={error("endDate")} required>
                                <Input
                                    id={id("endDate")}
                                    type="date"
                                    value={phase.endDate}
                                    min={phase.startDate || undefined}
                                    onChange={(event) => onChange(phase.key, { endDate: event.target.value })}
                                />
                            </Field>
                            <Field label="Goal" htmlFor={id("goal")} error={error("goal")} required className="sm:col-span-2">
                                <Textarea
                                    id={id("goal")}
                                    rows={2}
                                    value={phase.goal}
                                    onChange={(event) => onChange(phase.key, { goal: event.target.value })}
                                    maxLength={300}
                                    className="min-h-16"
                                />
                            </Field>
                        </div>

                        <fieldset className="mt-4 min-w-0" data-invalid={milestonesError ? "true" : undefined}>
                            <legend className="mb-2 text-sm font-medium text-fg">
                                Milestones
                                <span className="ml-1.5 text-xs font-normal text-fg-subtle">what must be true before moving on</span>
                            </legend>
                            <ul className="flex flex-col gap-2">
                                {phase.milestones.map((milestone, milestoneIndex) => {
                                    const milestoneId = id(`milestone-${milestone.key}`);
                                    return (
                                        <li key={milestone.key} className="flex items-center gap-2">
                                            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                            <label htmlFor={milestoneId} className="sr-only">
                                                Phase {index + 1} milestone {milestoneIndex + 1}
                                            </label>
                                            <Input
                                                id={milestoneId}
                                                value={milestone.text}
                                                maxLength={160}
                                                placeholder="e.g. Pain-free walking"
                                                onChange={(event) =>
                                                    onChange(phase.key, {
                                                        milestones: phase.milestones.map((m) =>
                                                            m.key === milestone.key ? { ...m, text: event.target.value } : m,
                                                        ),
                                                    })
                                                }
                                                aria-invalid={milestonesError && !milestone.text.trim() ? true : undefined}
                                                aria-describedby={milestonesError ? `${id("milestones")}-error` : undefined}
                                                className="flex-1"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() =>
                                                    onChange(phase.key, { milestones: phase.milestones.filter((m) => m.key !== milestone.key) })
                                                }
                                                aria-label={`Remove milestone ${milestoneIndex + 1} from phase ${index + 1}`}
                                            >
                                                <X />
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                            {milestonesError && (
                                <p id={`${id("milestones")}-error`} className="mt-1.5 text-[13px] font-medium text-danger-fg">
                                    {milestonesError}
                                </p>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => onAddMilestone(phase.key)} className="mt-2 -ml-2 text-primary-soft-fg">
                                <Plus aria-hidden />
                                Add milestone
                            </Button>
                        </fieldset>
                    </li>
                );
            })}
        </ol>
    );
}
