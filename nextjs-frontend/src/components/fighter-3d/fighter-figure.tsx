"use client";

import { useMemo, type ReactNode } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { WEIGHT_CLASS_LIMIT_KG, bodyRegionLabel, weightClassLabel } from "@/lib/domain/labels";
import type { BodyRegion, WeightClass } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BodyStage, type StageHighlight } from "./body/body-stage";
import { bodyModelFor, figureBuild } from "./body/build";
import { figureParams, type FigureSource } from "./figure-params";
import styles from "./fighter-figure.module.css";
import { useWebGL } from "./use-graphics";

export interface FighterFigureProps {
    name: string;
    figure: FigureSource;
    reachCm: number | null;
    weightClass: WeightClass;
    /** Regions the current clearance blocks (what a coach may see; never injury details). */
    restricted: { region: BodyRegion; label: string }[];
    /** Shown instead of the figure when the browser cannot draw WebGL. */
    fallback: ReactNode;
    className?: string;
}

/**
 * The fighter as a 3D figure built from their own record (sex, height, build), standing on the
 * page, with the measurements beside it: height, reach, and weight against the class limit. Regions
 * the clearance blocks glow amber. Turn it by dragging.
 */
export function FighterFigure({ name, figure, reachCm, weightClass, restricted, fallback, className }: FighterFigureProps) {
    const t = useT();
    const locale = useLocale();
    const webgl = useWebGL();
    const { sex, heightCm, weightKg, bodyFatPct, stance, healthStatus } = figure;
    const build = useMemo(() => figureBuild(figureParams({ sex, heightCm, weightKg, bodyFatPct, stance, healthStatus })), [sex, heightCm, weightKg, bodyFatPct, stance, healthStatus]);
    const highlights = useMemo<StageHighlight[]>(
        () => restricted.map((r, i) => ({ region: r.region, tone: "warning", label: r.label, pinned: i < 2 })),
        [restricted],
    );

    const limit = WEIGHT_CLASS_LIMIT_KG[weightClass];
    const gap = weightKg === null ? null : Math.round((weightKg - limit) * 10) / 10;
    const notRecorded = t("figure3d.profile.notRecorded");
    const cm = (value: number | null) => (value === null ? notRecorded : `${formatNumber(value)} cm`);
    const weightText = weightKg === null ? notRecorded : `${formatNumber(weightKg, 1)} kg`;
    const gapText = gap === null ? null : gap === 0 ? t("figure3d.profile.atLimit") : gap > 0 ? t("figure3d.profile.over", { kg: formatNumber(gap, 1) }) : t("figure3d.profile.under", { kg: formatNumber(-gap, 1) });
    const facts = [
        `${t("figure3d.profile.height")} ${cm(heightCm)}`,
        `${t("figure3d.profile.reach")} ${cm(reachCm)}`,
        `${t("figure3d.profile.weight")} ${weightText}${gapText ? `, ${gapText}` : ""}`,
        ...restricted.map((r) => `${bodyRegionLabel(r.region, locale)}: ${r.label}`),
    ].join("; ");

    if (webgl === false) return <>{fallback}</>;

    // Weight on a scale that ends 10 % above the class limit; the tick marks the limit.
    const span = limit * 1.1;
    const fill = weightKg === null ? 0 : Math.min(1, weightKg / span);

    return (
        <div className={cn("flex w-full shrink-0 flex-col gap-2 sm:w-[236px]", className)}>
            {webgl === null ? (
                <div aria-hidden className="h-[300px] w-full max-sm:h-[240px]" />
            ) : (
                <BodyStage
                    model={bodyModelFor(sex)}
                    build={build}
                    highlights={highlights}
                    bare
                    ariaLabel={t("figure3d.profile.aria", { name, facts })}
                    className="h-[300px] w-full max-sm:h-[240px]"
                />
            )}
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border text-center ring-1 ring-border">
                <Measure label={t("figure3d.profile.height")} value={heightCm === null ? "—" : formatNumber(heightCm)} unit="cm" />
                <Measure label={t("figure3d.profile.reach")} value={reachCm === null ? "—" : formatNumber(reachCm)} unit="cm" />
                <Measure label={t("figure3d.profile.weight")} value={weightKg === null ? "—" : formatNumber(weightKg, 1)} unit="kg" />
            </dl>
            <div className="flex flex-col gap-1">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-muted ring-1 ring-border ring-inset">
                    <div
                        className={cn("absolute inset-y-0 left-0 origin-left rounded-full", styles.fill, gap !== null && gap > 0 ? "bg-warning-solid" : "bg-primary")}
                        style={{ width: `${(fill * 100).toFixed(1)}%` }}
                    />
                    <div aria-hidden className="absolute inset-y-0 w-0.5 bg-fg" style={{ left: `${((limit / span) * 100).toFixed(1)}%` }} />
                </div>
                <p className="flex justify-between gap-2 text-[11px] text-fg-subtle">
                    <span>{t("figure3d.profile.classLimit", { weightClass: weightClassLabel(weightClass, locale), limit: formatNumber(limit, 1) })}</span>
                    {gapText && <span className={cn("font-medium", gap !== null && gap > 0 ? "text-warning-fg" : "text-fg-muted")}>{gapText}</span>}
                </p>
            </div>
        </div>
    );
}

function Measure({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <div className="bg-surface px-2 py-1.5">
            <dt className="truncate text-[11px] font-medium text-fg-subtle">{label}</dt>
            <dd className="font-display text-lg leading-tight font-bold text-fg tabular-nums">
                {value}
                {value !== "—" && <span className="ml-0.5 text-[11px] font-medium text-fg-muted">{unit}</span>}
            </dd>
        </div>
    );
}
