"use client";

import { Ban, Check } from "lucide-react";

import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { fieldDescribedBy } from "@/components/ui/form";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface TechniqueCheckboxesProps {
    /** Form field name; one value per checked technique. */
    name: string;
    /** Base id for hint and error elements. */
    id: string;
    legend: string;
    value: Technique[];
    onChange: (value: Technique[]) => void;
    /** Techniques the current Medical Clearance restricts; they stay selectable but are marked. */
    restricted?: Technique[];
    hint?: string;
    error?: string;
    required?: boolean;
    optional?: boolean;
}

/** Multi-select techniques as toggle chips. Native checkboxes keep keyboard and screen-reader support. */
export function TechniqueCheckboxes({ name, id, legend, value, onChange, restricted = [], hint, error, required, optional }: TechniqueCheckboxesProps) {
    const describedBy = fieldDescribedBy(id, { hint, error });
    const toggle = (technique: Technique, checked: boolean) => {
        onChange(checked ? TECHNIQUES.filter((t) => t === technique || value.includes(t)) : value.filter((t) => t !== technique));
    };

    return (
        <fieldset data-invalid={error ? "true" : undefined} aria-describedby={describedBy} className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-fg">
                {legend}
                {required && (
                    <>
                        <span className="ml-0.5 text-danger-fg" aria-hidden>
                            *
                        </span>
                        <span className="sr-only"> (required)</span>
                    </>
                )}
                {optional && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(optional)</span>}
            </legend>
            <ul className="flex flex-wrap gap-2">
                {TECHNIQUES.map((technique) => {
                    const isRestricted = restricted.includes(technique);
                    return (
                        <li key={technique}>
                            <label
                                className={cn(
                                    "group inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-surface px-2.5 text-[13px] font-medium text-fg shadow-card transition-colors select-none",
                                    error ? "border-danger-solid" : "border-border hover:border-control-border",
                                    "has-checked:border-primary/40 has-checked:bg-primary-soft has-checked:text-primary-soft-fg",
                                    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                                )}
                            >
                                <input
                                    type="checkbox"
                                    name={name}
                                    value={technique}
                                    checked={value.includes(technique)}
                                    onChange={(event) => toggle(technique, event.target.checked)}
                                    aria-invalid={error ? true : undefined}
                                    aria-required={required || undefined}
                                    aria-describedby={describedBy}
                                    className="sr-only"
                                />
                                <Check aria-hidden className="hidden size-3.5 group-has-checked:block" strokeWidth={2.5} />
                                <span
                                    aria-hidden
                                    className="size-2 shrink-0 rounded-[2px] group-has-checked:hidden"
                                    style={{ backgroundColor: TECHNIQUE_COLOR[technique] }}
                                />
                                {TECHNIQUE_LABELS[technique]}
                                {isRestricted && (
                                    <>
                                        <Ban aria-hidden className="size-3.5 text-warning-fg" />
                                        <span className="sr-only">(restricted by Medical Clearance)</span>
                                    </>
                                )}
                            </label>
                        </li>
                    );
                })}
            </ul>
            {hint && !error && (
                <p id={`${id}-hint`} className="text-[13px] text-fg-subtle">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="text-[13px] font-medium text-danger-fg">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
