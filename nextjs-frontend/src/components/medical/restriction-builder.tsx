"use client";

import { Ban, Gauge, Info, Plus, ShieldMinus, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { BODY_REGION_LABELS, TECHNIQUE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, Technique, TrainingType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { RESTRICTION_PRESETS, customRestriction, maxRpeRestriction, protectRegionRestriction, type RestrictionFields } from "./restriction-presets";

export interface RestrictionDraft extends RestrictionFields {
    key: number;
}

const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const TECHNIQUES = Object.keys(TECHNIQUE_LABELS) as Technique[];
const REGIONS = Object.keys(BODY_REGION_LABELS) as BodyRegion[];
const RPE_VALUES = [3, 4, 5, 6, 7, 8, 9];

export interface RestrictionBuilderProps {
    drafts: RestrictionDraft[];
    onChange: (drafts: RestrictionDraft[]) => void;
    /** Field error by action name: "restrictions", "restrictions.0.label" (hidden once edited). */
    error: (name: string) => string | undefined;
    /** Marks errors stale: "restrictions" after add/remove, the label after an edit. */
    markEdited: (name: string) => void;
}

/** Builds Medical Clearance restrictions from presets or from scratch, with editable labels and enforced limits. */
export function RestrictionBuilder({ drafts, onChange, error, markEdited }: RestrictionBuilderProps) {
    const baseId = useId();
    const [nextKey, setNextKey] = useState(() => drafts.reduce((max, draft) => Math.max(max, draft.key), 0) + 1);
    const [rpe, setRpe] = useState("7");
    const [region, setRegion] = useState<BodyRegion | "">("");

    const replace = (next: RestrictionDraft[]) => {
        onChange(next);
        markEdited("restrictions");
    };
    const add = (restriction: RestrictionFields) => {
        replace([...drafts, { ...restriction, key: nextKey }]);
        setNextKey((key) => key + 1);
    };
    const update = (index: number, patch: Partial<RestrictionFields>) => {
        onChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
        markEdited(patch.label === undefined ? "restrictions" : `restrictions.${index}.label`);
    };
    const labels = new Set(drafts.map((draft) => draft.label.trim().toLowerCase()));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3">
                <p id={`${baseId}-presets`} className="text-[13px] font-medium text-fg">
                    Add a common restriction
                </p>
                <ul aria-labelledby={`${baseId}-presets`} className="flex flex-wrap gap-2">
                    {RESTRICTION_PRESETS.map(({ id, restriction }) => {
                        const added = labels.has(restriction.label.toLowerCase());
                        return (
                            <li key={id}>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={added}
                                    onClick={() => add(restriction)}
                                    aria-pressed={added}
                                    className="h-auto min-h-8 py-1 text-left whitespace-normal"
                                >
                                    <Plus aria-hidden />
                                    {restriction.label}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <label htmlFor={`${baseId}-rpe`} className="text-xs text-fg-muted">
                                Intensity cap
                            </label>
                            <Select id={`${baseId}-rpe`} value={rpe} onChange={(event) => setRpe(event.target.value)} className="w-28">
                                {RPE_VALUES.map((value) => (
                                    <option key={value} value={value}>
                                        RPE {value}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <Button variant="secondary" onClick={() => add(maxRpeRestriction(Number(rpe)))} disabled={drafts.some((draft) => draft.maxRpe !== null)}>
                            <Gauge aria-hidden />
                            Add max RPE
                        </Button>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <label htmlFor={`${baseId}-region`} className="text-xs text-fg-muted">
                                Body region
                            </label>
                            <Select id={`${baseId}-region`} value={region} onChange={(event) => setRegion(event.target.value as BodyRegion | "")} className="w-44">
                                <option value="">Choose…</option>
                                {REGIONS.map((value) => (
                                    <option key={value} value={value}>
                                        {BODY_REGION_LABELS[value]}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <Button
                            variant="secondary"
                            disabled={!region}
                            onClick={() => {
                                if (!region) return;
                                add(protectRegionRestriction(region));
                                setRegion("");
                            }}
                        >
                            <ShieldMinus aria-hidden />
                            Add protect
                        </Button>
                    </div>
                    <Button variant="ghost" onClick={() => add(customRestriction())}>
                        <Plus aria-hidden />
                        Custom restriction
                    </Button>
                </div>
            </div>

            {error("restrictions") && <p className="text-[13px] font-medium text-danger-fg">{error("restrictions")}</p>}

            {drafts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-sm text-fg-muted">
                    No restrictions yet. Add at least one — coaches plan sessions against each of them.
                </p>
            ) : (
                <ol className="flex flex-col gap-3" aria-label="Restrictions on this clearance">
                    {drafts.map((draft, index) => (
                        <DraftEditor
                            key={draft.key}
                            draft={draft}
                            index={index}
                            idPrefix={`${baseId}-${draft.key}`}
                            labelError={error(`restrictions.${index}.label`)}
                            onChange={(patch) => update(index, patch)}
                            onRemove={() => replace(drafts.filter((candidate) => candidate.key !== draft.key))}
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}

function DraftEditor({
    draft,
    index,
    idPrefix,
    labelError,
    onChange,
    onRemove,
}: {
    draft: RestrictionDraft;
    index: number;
    idPrefix: string;
    labelError?: string;
    onChange: (patch: Partial<RestrictionFields>) => void;
    onRemove: () => void;
}) {
    const name = draft.label.trim() || `restriction ${index + 1}`;
    const hasLimits = draft.blockedTrainingTypes.length + draft.blockedTechniques.length + draft.blockedRegions.length > 0 || draft.maxRpe !== null;
    const toggleList = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

    return (
        <li className={cn("rounded-lg border bg-surface p-3", labelError ? "border-danger-border" : "border-border")}>
            <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <label htmlFor={`${idPrefix}-label`} className="text-xs text-fg-muted">
                        Label coaches will read
                        <span className="ml-0.5 text-danger-fg" aria-hidden>
                            *
                        </span>
                    </label>
                    <Input
                        id={`${idPrefix}-label`}
                        required
                        value={draft.label}
                        onChange={(event) => onChange({ label: event.target.value })}
                        placeholder="e.g. Protect left knee — no sharp cutting drills"
                        aria-invalid={labelError ? true : undefined}
                        aria-describedby={labelError ? `${idPrefix}-label-error` : undefined}
                        className="font-medium"
                    />
                    {labelError && (
                        <p id={`${idPrefix}-label-error`} className="text-[13px] font-medium text-danger-fg">
                            {labelError}
                        </p>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${name}`} className="mt-5">
                    <X />
                </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
                <p className="text-xs text-fg-muted">Checked when coaches plan sessions:</p>
                {hasLimits ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`Limits for ${name}`}>
                        {draft.blockedTrainingTypes.map((type) => (
                            <Chip key={type} tone="danger" icon={<Ban />} label={`No ${TRAINING_TYPE_LABELS[type].toLowerCase()}`} onRemove={() => onChange({ blockedTrainingTypes: toggleList(draft.blockedTrainingTypes, type) })} />
                        ))}
                        {draft.blockedTechniques.map((technique) => (
                            <Chip
                                key={technique}
                                tone="danger"
                                icon={<Ban />}
                                label={`No ${TECHNIQUE_LABELS[technique].toLowerCase()}`}
                                onRemove={() => onChange({ blockedTechniques: toggleList(draft.blockedTechniques, technique) })}
                            />
                        ))}
                        {draft.blockedRegions.map((region) => (
                            <Chip
                                key={region}
                                tone="neutral"
                                icon={<ShieldMinus />}
                                label={`Protect ${BODY_REGION_LABELS[region].toLowerCase()}`}
                                onRemove={() => onChange({ blockedRegions: toggleList(draft.blockedRegions, region) })}
                            />
                        ))}
                        {draft.maxRpe !== null && <Chip tone="warning" icon={<Gauge />} label={`Max RPE ${draft.maxRpe}`} onRemove={() => onChange({ maxRpe: null })} />}
                    </ul>
                ) : (
                    <p className="flex items-start gap-1.5 text-[13px] text-fg-muted">
                        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        Nothing is checked automatically yet — coaches will only see the label. Add a limit below if planning should enforce it.
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    <AddLimitSelect
                        id={`${idPrefix}-type`}
                        label={`Block a training type for ${name}`}
                        placeholder="+ Training type"
                        options={TRAINING_TYPES.filter((type) => !draft.blockedTrainingTypes.includes(type)).map((type) => ({ value: type, label: TRAINING_TYPE_LABELS[type] }))}
                        onPick={(value) => onChange({ blockedTrainingTypes: [...draft.blockedTrainingTypes, value as TrainingType] })}
                    />
                    <AddLimitSelect
                        id={`${idPrefix}-technique`}
                        label={`Block a technique for ${name}`}
                        placeholder="+ Technique"
                        options={TECHNIQUES.filter((technique) => !draft.blockedTechniques.includes(technique)).map((technique) => ({
                            value: technique,
                            label: TECHNIQUE_LABELS[technique],
                        }))}
                        onPick={(value) => onChange({ blockedTechniques: [...draft.blockedTechniques, value as Technique] })}
                    />
                    <AddLimitSelect
                        id={`${idPrefix}-region`}
                        label={`Protect a body region for ${name}`}
                        placeholder="+ Protect region"
                        options={REGIONS.filter((region) => !draft.blockedRegions.includes(region)).map((region) => ({ value: region, label: BODY_REGION_LABELS[region] }))}
                        onPick={(value) => onChange({ blockedRegions: [...draft.blockedRegions, value as BodyRegion] })}
                    />
                    {draft.maxRpe === null && (
                        <AddLimitSelect
                            id={`${idPrefix}-rpe`}
                            label={`Cap session intensity for ${name}`}
                            placeholder="+ Max RPE"
                            options={RPE_VALUES.map((value) => ({ value: String(value), label: `RPE ${value}` }))}
                            onPick={(value) => onChange({ maxRpe: Number(value) })}
                        />
                    )}
                </div>
            </div>
        </li>
    );
}

function AddLimitSelect({
    id,
    label,
    placeholder,
    options,
    onPick,
}: {
    id: string;
    label: string;
    placeholder: string;
    options: { value: string; label: string }[];
    onPick: (value: string) => void;
}) {
    return (
        <div>
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <Select
                id={id}
                value=""
                onChange={(event) => {
                    if (event.target.value) onPick(event.target.value);
                }}
                className="w-44 [&_select]:h-8 [&_select]:text-[13px]"
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </Select>
        </div>
    );
}

function Chip({ tone, icon, label, onRemove }: { tone: "danger" | "warning" | "neutral"; icon: ReactNode; label: string; onRemove: () => void }) {
    return (
        <li
            className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md pr-0.5 pl-2 text-xs font-medium ring-1 ring-inset",
                tone === "danger" && "text-danger-fg ring-danger-border",
                tone === "warning" && "text-warning-fg ring-warning-border",
                tone === "neutral" && "text-neutral-fg ring-neutral-border",
            )}
        >
            <span aria-hidden className="[&_svg]:size-3.5">
                {icon}
            </span>
            {label}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="ml-0.5 inline-flex size-6 items-center justify-center rounded text-current opacity-70 hover:bg-surface-hover hover:opacity-100"
            >
                <X aria-hidden className="size-3.5" />
            </button>
        </li>
    );
}
