"use client";

import { useDemoCopy } from "@/components/i18n/locale-provider";
import { Gauge, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { RESTRICTION_SEVERITY_META } from "./restriction-meta";
import { Badge } from "@/components/ui/badge";
import { TONE_SOFT, type Tone } from "@/components/ui/tone";
import { restrictionEffects, restrictionSeverity } from "@/lib/domain/clearance-rules";
import { BODY_REGION_LABELS, TECHNIQUE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { TrainingRestriction } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { TRAINING_TYPE_ICONS } from "./training-type-icon";

/**
 * Icon and tone per restriction severity, shared with RestrictionSummary. Severity follows the
 * scheduler rule: blocked training types block, RPE caps limit, techniques and regions warn.
 * Escalating technique restrictions to blocking is a product decision to make in rules.ts.
 */


export interface RestrictionListProps {
    restrictions: TrainingRestriction[];
    /** Shown when there are no restrictions. */
    emptyText?: string;
    className?: string;
}

/**
 * Training restrictions from a Medical Clearance: each label with its severity icon, then chips for
 * what is not allowed, what to avoid (the coach must acknowledge it), which areas to protect and
 * the intensity cap.
 */
export function RestrictionList({ restrictions, emptyText = "No training restrictions.", className }: RestrictionListProps) {
    const copy = useDemoCopy();
    if (restrictions.length === 0) {
        return <p className={cn("text-sm text-fg-muted", className)}>{copy(emptyText)}</p>;
    }

    return (
        <ul className={cn("flex flex-col gap-2.5", className)}>
            {restrictions.map((restriction) => {
                const { icon: Icon, tone } = RESTRICTION_SEVERITY_META[restrictionSeverity(restriction)];
                return (
                    <li key={restriction.id} className="flex gap-3 rounded-lg border border-border bg-surface-muted/60 px-3 py-2.5">
                        <span aria-hidden className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset", TONE_SOFT[tone])}>
                            <Icon className="size-3.5" strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-pretty break-words text-fg">{restriction.label}</p>
                            <RestrictionChips restriction={restriction} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function RestrictionChips({ restriction }: { restriction: TrainingRestriction }) {
    const copy = useDemoCopy();
    const { blocksTypes, avoidTechniques, protectRegions, maxRpe } = restrictionEffects(restriction);
    if (blocksTypes.length === 0 && avoidTechniques.length === 0 && protectRegions.length === 0 && maxRpe === null) return null;

    return (
        <div className="mt-2 flex flex-col gap-1.5">
            {blocksTypes.length > 0 && (
                <ChipRow caption={copy("Not allowed")}>
                    {blocksTypes.map((type) => (
                        <Chip key={type} tone="danger" icon={TRAINING_TYPE_ICONS[type]}>
                            {copy(TRAINING_TYPE_LABELS[type])}
                        </Chip>
                    ))}
                </ChipRow>
            )}
            {avoidTechniques.length > 0 && (
                <ChipRow caption={copy("Avoid — coach must acknowledge")}>
                    {avoidTechniques.map((technique) => (
                        <Chip key={technique} tone="warning" icon={TriangleAlert}>
                            {copy(TECHNIQUE_LABELS[technique])}
                        </Chip>
                    ))}
                </ChipRow>
            )}
            {protectRegions.length > 0 && (
                <ChipRow caption={copy("Protect")}>
                    {protectRegions.map((region) => (
                        <Chip key={region} tone="warning" icon={ShieldAlert}>
                            {copy(BODY_REGION_LABELS[region])}
                        </Chip>
                    ))}
                </ChipRow>
            )}
            {maxRpe !== null && (
                <ChipRow caption={copy("Intensity")}>
                    <Chip tone="warning" icon={Gauge}>
                        RPE ≤ {maxRpe}
                    </Chip>
                </ChipRow>
            )}
        </div>
    );
}

function Chip({ tone, icon, children }: { tone: Tone; icon: LucideIcon; children: ReactNode }) {
    return (
        <li>
            <Badge tone={tone} variant="outline" size="sm" icon={icon}>
                {children}
            </Badge>
        </li>
    );
}

function ChipRow({ caption, children }: { caption: string; children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span aria-hidden className="text-xs text-fg-subtle">
                {caption}:
            </span>
            <ul aria-label={caption} className="flex flex-wrap gap-1.5">
                {children}
            </ul>
        </div>
    );
}
