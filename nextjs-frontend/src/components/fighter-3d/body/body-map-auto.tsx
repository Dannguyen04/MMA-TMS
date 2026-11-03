"use client";

import { useMemo } from "react";

import { BodyMap, type BodyMapProps } from "@/components/domain/body-map";
import { TONE_SOLID } from "@/components/ui/tone";
import { bodyRegionLabel } from "@/lib/domain/labels";
import type { BodyRegion } from "@/lib/domain/types";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { figureParams, type FigureSource } from "../figure-params";
import { useWebGL } from "../use-graphics";
import { BodyStage, type StageHighlight } from "./body-stage";
import { bodyModelFor, figureBuild } from "./build";

/** Pins at most this many labels; the other regions still light up on the body and in the legend. */
const MAX_PINS = 3;

export interface BodyMapAutoProps extends BodyMapProps {
    /** The fighter whose body this is: picks the model and scales it. Without it, a standard figure. */
    figure?: FigureSource | null;
    /** Region the camera flies to (an injury's detail page). */
    focus?: BodyRegion | null;
    /** Height of the 3D stage. */
    stageClassName?: string;
}

/**
 * The body map as a 3D figure where the browser can draw WebGL, the 2D map everywhere else (server
 * render, no WebGL, print). Same props as `BodyMap`, so a page swaps one for the other; every fact on
 * the figure is also in the legend below it.
 */
export function BodyMapAuto({ highlights, size = "md", showLegend = true, className, locale = "en", figure, focus = null, stageClassName }: BodyMapAutoProps) {
    const webgl = useWebGL();
    const t = createTranslator(locale);
    const { sex, heightCm, weightKg, bodyFatPct, stance, healthStatus } = figure ?? {};
    const build = useMemo(
        () => (heightCm || weightKg ? figureBuild(figureParams({ sex, heightCm, weightKg, bodyFatPct, stance, healthStatus } as FigureSource)) : undefined),
        [sex, heightCm, weightKg, bodyFatPct, stance, healthStatus],
    );
    const stageHighlights = useMemo<StageHighlight[]>(
        () =>
            highlights.map((h, i) => ({
                region: h.region,
                tone: h.tone,
                label: h.label,
                pulse: h.tone === "danger",
                pinned: focus ? h.region === focus : i < MAX_PINS,
            })),
        [highlights, focus],
    );

    if (webgl !== true) {
        return <BodyMap highlights={highlights} size={size} showLegend={showLegend} className={className} locale={locale} />;
    }

    const summary =
        highlights.length === 0
            ? t("figure3d.bodyAria.none")
            : t("bodyMap.summary", {
                  count: highlights.length,
                  areas: highlights.length === 1 ? t("bodyMap.area") : t("bodyMap.areas"),
                  details: highlights.map((h, i) => `${i + 1}, ${bodyRegionLabel(h.region, locale)}: ${h.label}`).join("; "),
              });

    return (
        <div className={cn("flex w-full flex-col gap-3", className)}>
            <BodyStage
                model={bodyModelFor(sex)}
                build={build}
                highlights={stageHighlights}
                selected={focus}
                zoomOnSelect={Boolean(focus)}
                ariaLabel={t("figure3d.bodyAria", { summary })}
                className={cn("h-[420px] w-full print:hidden", stageClassName)}
            />
            <div className="hidden justify-center print:flex">
                <BodyMap highlights={highlights} size={size} showLegend={false} locale={locale} />
            </div>
            {showLegend && highlights.length > 0 && (
                <ul className="flex flex-col gap-1.5" aria-label={t("bodyMap.legendLabel")}>
                    {highlights.map((h, i) => (
                        <li key={`${h.region}-${i}`} className="flex items-start gap-2 text-[13px]">
                            <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-full", TONE_SOLID[h.tone])} />
                            <span className="min-w-0">
                                <span className="font-medium text-fg">{bodyRegionLabel(h.region, locale)}</span>
                                <span className="text-fg-muted"> — {h.label}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
