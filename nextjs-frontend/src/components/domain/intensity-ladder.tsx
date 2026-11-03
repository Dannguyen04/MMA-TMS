"use client";

import type { KeyboardEvent } from "react";
import {
    computeLadderSegments,
    getTierName,
    handleLadderKeyDown,
    type LadderSegmentStatus,
    type SessionIntensityTier,
} from "@/lib/domain/intensity-tiers";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { TRAINING_TYPE_ICONS } from "./training-type-icon";

export interface IntensityLadderProps {
    maxAllowedTier: number;
    ceiling?: 3 | 4;
    size?: "sm" | "md" | "lg";
    interactive?: boolean;
    value?: number;
    onChange?: (tier: SessionIntensityTier) => void;
    locale?: Locale;
    className?: string;
    id?: string;
    "aria-label"?: string;
}

const HEIGHT_CLASSES: Record<"sm" | "md" | "lg", Record<SessionIntensityTier, string>> = {
    sm: {
        1: "h-2",
        2: "h-3",
        3: "h-4",
        4: "h-5",
        5: "h-6",
    },
    md: {
        1: "h-10",
        2: "h-13",
        3: "h-16",
        4: "h-19",
        5: "h-22",
    },
    lg: {
        1: "h-12",
        2: "h-16",
        3: "h-20",
        4: "h-24",
        5: "h-28",
    },
};

const SEGMENT_CLASSES: Record<LadderSegmentStatus, string> = {
    allowed: "bg-success-solid text-white border-success-solid",
    blocked: "ladder-pattern-blocked text-neutral-fg border-neutral-border",
    blocked_ceiling: "ladder-pattern-ceiling text-info-fg border-info-border",
};

const STAGGER_DELAY_CLASSES: Record<SessionIntensityTier, string> = {
    1: "motion-safe:delay-0",
    2: "motion-safe:delay-[40ms]",
    3: "motion-safe:delay-[80ms]",
    4: "motion-safe:delay-[120ms]",
    5: "motion-safe:delay-[160ms]",
};

export function IntensityLadder({
    maxAllowedTier,
    ceiling,
    size = "md",
    interactive = false,
    value,
    onChange,
    locale = "vi",
    className,
    id,
    "aria-label": ariaLabelProp,
}: IntensityLadderProps) {
    const t = createTranslator(locale);

    // In interactive mode, clamped strictly between 1 and 5 (never 0)
    const rawActive = interactive ? (value ?? (maxAllowedTier > 0 ? maxAllowedTier : 1)) : maxAllowedTier;
    const clampedActive = Math.max(1, Math.min(5, rawActive)) as SessionIntensityTier;
    const effectiveAllowedTier = interactive ? clampedActive : maxAllowedTier;

    const segments = computeLadderSegments(effectiveAllowedTier, ceiling, locale);

    const activeTierName = getTierName(clampedActive, locale);
    const activeTierLabel = t(`intensityTier.${clampedActive}.label` as MessageKey);
    const valueText = `${activeTierLabel}: ${activeTierName}`;

    const summaryLabel =
        ariaLabelProp ??
        (effectiveAllowedTier === 0
            ? t("intensityLadder.summaryBlocked")
            : t("intensityLadder.summary", {
                  tier: effectiveAllowedTier,
                  label: t(`intensityTier.${effectiveAllowedTier}.label` as MessageKey),
                  name: getTierName(effectiveAllowedTier as SessionIntensityTier, locale),
              }));

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!interactive) return;
        const handled = handleLadderKeyDown(e.key, clampedActive, onChange);
        if (handled) {
            e.preventDefault();
        }
    };

    return (
        <div className={cn("inline-flex flex-col w-full", className)}>
            <div
                id={id}
                role={interactive ? "slider" : "img"}
                tabIndex={interactive ? 0 : undefined}
                aria-valuemin={interactive ? 1 : undefined}
                aria-valuemax={interactive ? 5 : undefined}
                aria-valuenow={interactive ? clampedActive : undefined}
                aria-valuetext={interactive ? valueText : undefined}
                aria-label={interactive ? (ariaLabelProp ?? t("intensityLadder.sliderLabel")) : summaryLabel}
                onKeyDown={interactive ? handleKeyDown : undefined}
                className={cn(
                    "flex items-end w-full",
                    size === "sm" && "gap-1 h-7",
                    size === "md" && "gap-1.5 h-24",
                    size === "lg" && "gap-2 h-30",
                    interactive &&
                        "rounded-md p-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                )}
            >
                {segments.map((seg) => {
                    const Icon = TRAINING_TYPE_ICONS[seg.trainingType];
                    const heightClass = HEIGHT_CLASSES[size][seg.tier];
                    const isSelected = interactive && seg.tier === clampedActive;

                    return (
                        <span
                            key={seg.tier}
                            title={seg.screenReaderLabel}
                            aria-hidden={!interactive ? "true" : undefined}
                            onClick={interactive ? () => onChange?.(seg.tier) : undefined}
                            className={cn(
                                "relative flex flex-1 flex-col items-center justify-between rounded-t border",
                                "motion-safe:transition-all motion-safe:duration-200",
                                STAGGER_DELAY_CLASSES[seg.tier],
                                heightClass,
                                SEGMENT_CLASSES[seg.status],
                                interactive && "cursor-pointer hover:opacity-95 active:scale-[0.98]",
                                interactive && isSelected && "ring-2 ring-[var(--ring)] ring-offset-1",
                            )}
                        >
                            <span className="sr-only">{seg.screenReaderLabel}</span>

                            {size !== "sm" && (
                                <span aria-hidden="true" className={cn("flex items-center justify-center", size === "lg" ? "mt-1" : "mt-0.5")}>
                                    <Icon className={size === "lg" ? "size-5" : "size-3.5"} />
                                </span>
                            )}

                            {size !== "sm" && (
                                <span aria-hidden="true" className={cn("font-bold select-none", size === "lg" ? "mb-1 text-[11px]" : "mb-0.5 text-[10px]")}>
                                    {seg.tier}
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>

            {size === "lg" && (
                <div className="mt-2 grid grid-cols-5 gap-2 text-center" aria-hidden="true">
                    {segments.map((seg) => (
                        <div
                            key={seg.tier}
                            className={cn(
                                "flex flex-col text-[11px] leading-tight",
                                interactive && seg.tier === clampedActive ? "font-semibold text-fg" : "text-fg-muted",
                            )}
                        >
                            <span className="font-medium">{seg.label}</span>
                            <span className="line-clamp-2 text-[10px] text-fg-subtle">{seg.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
