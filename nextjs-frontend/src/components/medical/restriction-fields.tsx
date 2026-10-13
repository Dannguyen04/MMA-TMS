"use client";

import { Lock } from "lucide-react";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import type { ActionForm } from "@/components/ui/use-action-form";
import type { RestrictionLists } from "@/lib/domain/medical-bodies";
import {
    BODY_JOINTS,
    BODY_JOINT_LABELS,
    SESSION_TYPES,
    SESSION_TYPE_LABELS,
    TECHNIQUE_TYPES,
    TECHNIQUE_TYPE_LABELS,
    type BodyJoint,
    type SessionType,
    type TechniqueType,
} from "@/lib/domain/medical-contract";
import { cn } from "@/lib/utils";

/** What the pickers need from the form: its errors, and a way to hide them once a list changes. */
type RestrictionForm = Pick<ActionForm<unknown>, "error" | "markEdited">;

export interface RestrictionFieldsProps {
    form: RestrictionForm;
    /** Prefix for control ids. */
    idPrefix: string;
    /** Starting lists, e.g. the examination's when issuing a clearance from it. */
    defaults?: RestrictionLists | null;
    /**
     * The examination's lists when issuing a clearance: the doctor may only narrow them. Allowed types outside the
     * bound can't be picked, a bounded limit can't be switched off, and excluded joints stay excluded.
     */
    bound?: RestrictionLists | null;
}

/**
 * The medical service's restrictions as three pickers: session types the fighter may do, techniques they may use
 * (each an allow-list, off meaning "no limit") and joints to keep out of training.
 */
export function RestrictionFields({ form, idPrefix, defaults, bound }: RestrictionFieldsProps) {
    const [limitSessions, setLimitSessions] = useState(defaults?.allowedSessionTypes != null || bound?.allowedSessionTypes != null);
    const [sessions, setSessions] = useState<SessionType[]>([...(defaults?.allowedSessionTypes ?? [])]);
    const [limitTechniques, setLimitTechniques] = useState(defaults?.allowedTechniqueTypes != null || bound?.allowedTechniqueTypes != null);
    const [techniques, setTechniques] = useState<TechniqueType[]>([...(defaults?.allowedTechniqueTypes ?? [])]);
    const [joints, setJoints] = useState<BodyJoint[]>([...new Set([...(defaults?.excludedJoints ?? []), ...(bound?.excludedJoints ?? [])])]);

    const sessionsLocked = bound?.allowedSessionTypes != null;
    const techniquesLocked = bound?.allowedTechniqueTypes != null;
    const lockedJoints = bound?.excludedJoints ?? [];

    return (
        <div className="flex flex-col gap-5">
            <ListPicker
                form={form}
                id={`${idPrefix}-sessions`}
                name="allowedSessionTypes"
                switchName="limitSessions"
                switchLabel="Limit the session types"
                switchDescription={sessionsLocked ? "The examination limits session types, so this clearance must too." : "Off means every type of session is allowed."}
                on={limitSessions}
                locked={sessionsLocked}
                onToggle={setLimitSessions}
                legend="Session types the fighter may do"
                options={(bound?.allowedSessionTypes ?? SESSION_TYPES).map((value) => ({ value, label: SESSION_TYPE_LABELS[value] }))}
                selected={sessions}
                onSelect={setSessions}
            />
            <ListPicker
                form={form}
                id={`${idPrefix}-techniques`}
                name="allowedTechniqueTypes"
                switchName="limitTechniques"
                switchLabel="Limit the techniques"
                switchDescription={techniquesLocked ? "The examination limits techniques, so this clearance must too." : "Off means every technique is allowed."}
                on={limitTechniques}
                locked={techniquesLocked}
                onToggle={setLimitTechniques}
                legend="Techniques the fighter may use"
                options={(bound?.allowedTechniqueTypes ?? TECHNIQUE_TYPES).map((value) => ({ value, label: TECHNIQUE_TYPE_LABELS[value] }))}
                selected={techniques}
                onSelect={setTechniques}
            />
            <CheckboxChips
                form={form}
                id={`${idPrefix}-joints`}
                name="excludedJoints"
                legend="Joints to keep out of training"
                hint={lockedJoints.length > 0 ? "Joints the examination excluded stay excluded." : "Leave all unticked if no joint needs protecting."}
                options={BODY_JOINTS.map((value) => ({ value, label: BODY_JOINT_LABELS[value], locked: lockedJoints.includes(value) }))}
                selected={joints}
                onSelect={setJoints}
            />
        </div>
    );
}

interface ChipOption<T extends string> {
    value: T;
    label: string;
    /** Always ticked and can't be changed. */
    locked?: boolean;
}

function ListPicker<T extends string>({
    form,
    id,
    name,
    switchName,
    switchLabel,
    switchDescription,
    on,
    locked,
    onToggle,
    legend,
    options,
    selected,
    onSelect,
}: {
    form: RestrictionForm;
    id: string;
    name: string;
    switchName: string;
    switchLabel: string;
    switchDescription: string;
    on: boolean;
    locked: boolean;
    onToggle: (on: boolean) => void;
    legend: string;
    options: ChipOption<T>[];
    selected: T[];
    onSelect: (values: T[]) => void;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
            {/* A locked switch still submits "on": disabled inputs aren't sent. */}
            {locked && <input type="hidden" name={switchName} value="on" />}
            <Switch
                id={`${id}-switch`}
                name={locked ? undefined : switchName}
                label={switchLabel}
                description={switchDescription}
                checked={on}
                disabled={locked}
                onChange={(event) => {
                    onToggle(event.target.checked);
                    form.markEdited(name);
                }}
            />
            {on && <CheckboxChips form={form} id={id} name={name} legend={legend} options={options} selected={selected} onSelect={onSelect} />}
        </div>
    );
}

function CheckboxChips<T extends string>({
    form,
    id,
    name,
    legend,
    hint,
    options,
    selected,
    onSelect,
}: {
    form: RestrictionForm;
    id: string;
    name: string;
    legend: string;
    hint?: string;
    options: ChipOption<T>[];
    selected: T[];
    onSelect: (values: T[]) => void;
}) {
    const error = form.error(name);
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
        <fieldset aria-invalid={error ? true : undefined} data-invalid={error ? "true" : undefined} aria-describedby={describedBy} className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium text-fg">{legend}</legend>
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => {
                    const checked = option.locked || selected.includes(option.value);
                    return (
                        <label
                            key={option.value}
                            className={cn(
                                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors",
                                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                                checked ? "border-primary bg-primary-soft/50 font-medium text-fg" : "border-border bg-surface text-fg-muted hover:border-control-border",
                                option.locked && "cursor-not-allowed",
                                error && !checked && "border-danger-border",
                            )}
                        >
                            {option.locked && <input type="hidden" name={name} value={option.value} />}
                            <input
                                type="checkbox"
                                name={option.locked ? undefined : name}
                                value={option.value}
                                checked={checked}
                                disabled={option.locked}
                                onChange={(event) => {
                                    onSelect(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value));
                                    form.markEdited(name);
                                }}
                                className="size-3.5 shrink-0 accent-[var(--primary)]"
                            />
                            {option.label}
                            {option.locked && <Lock aria-label="Required by the examination" className="size-3 text-fg-subtle" />}
                        </label>
                    );
                })}
            </div>
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
