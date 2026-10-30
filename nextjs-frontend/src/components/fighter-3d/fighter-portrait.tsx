"use client";

import { useEffect, useMemo, useRef } from "react";

import { HEALTH_STATUS_META } from "@/components/domain/status-badges";
import type { Tone } from "@/components/ui/tone";
import { graphicsTier } from "@/lib/graphics-tier";
import { cn } from "@/lib/utils";
import { figureParams, type FigureSource } from "./figure-params";
import { portraitStudio, queuePaint } from "./portrait-studio";
import { useReducedMotion, useThemeTokens, useWebGL } from "./use-graphics";

const TONE_TOKEN: Record<Tone, string> = {
    neutral: "neutral-solid",
    primary: "primary",
    success: "success-solid",
    warning: "warning-solid",
    danger: "danger-solid",
    info: "info-solid",
    ai: "ai-solid",
};

const TOKENS = ["figure-body", "figure-rim", "neutral-solid", "primary", "success-solid", "warning-solid", "danger-solid", "info-solid", "ai-solid"] as const;

/** Three-quarter view from the lead side; a full turn while the card is hovered. */
const BASE_YAW = 0.55;
const SPIN_SPEED = 1.6;

export interface FighterPortraitProps {
    figure: FigureSource;
    className?: string;
}

/**
 * The fighter's own 3D figure standing straight on the card (transparent canvas): their sex, height,
 * build and stance, rim-lit in their health tone. Decorative (the card states every fact in text). Turns once round while its card is
 * hovered; still under reduced motion. Without WebGL the stage stays empty.
 */
export function FighterPortrait({ figure, className }: FighterPortraitProps) {
    const stage = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const webgl = useWebGL();
    const reduced = useReducedMotion();
    const tokens = useThemeTokens(TOKENS);
    const { sex, heightCm, weightKg, bodyFatPct, stance, healthStatus } = figure;
    const params = useMemo(
        () => figureParams({ sex, heightCm, weightKg, bodyFatPct, stance, healthStatus }),
        [sex, heightCm, weightKg, bodyFatPct, stance, healthStatus],
    );
    const side = params.lead === "left" ? 1 : -1;

    useEffect(() => {
        const host = stage.current;
        const target = canvas.current;
        const studio = webgl ? portraitStudio() : null;
        if (!host || !target || !studio || !tokens) return;

        const colors = {
            body: tokens["figure-body"],
            rim: tokens["figure-rim"],
            tone: tokens[TONE_TOKEN[HEALTH_STATUS_META[healthStatus].tone] as (typeof TOKENS)[number]],
        };
        let yaw = BASE_YAW * side;
        let frame = 0;
        let last = 0;
        let spinning = false;
        const paint = () => studio.paint(target, params, colors, yaw);

        const resize = () => {
            const ratio = graphicsTier() === "lite" ? 1 : Math.min(2, window.devicePixelRatio || 1);
            target.width = Math.round(host.clientWidth * ratio);
            target.height = Math.round(host.clientHeight * ratio);
            paint();
        };
        // Paint only once the card is on screen, in an idle slot; resizes go through the same queue.
        let cancelPaint = () => {};
        let shown = false;
        const schedule = () => {
            cancelPaint();
            cancelPaint = queuePaint(resize);
        };
        const sizes = new ResizeObserver(() => {
            if (shown) schedule();
        });
        sizes.observe(host);
        const seen = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || shown) return;
            shown = true;
            schedule();
        }, { rootMargin: "200px" });
        seen.observe(host);

        // One turn, then ease back to the three-quarter view; repaint only while moving.
        const tick = (now: number) => {
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            last = now;
            const rest = BASE_YAW * side;
            if (spinning) yaw += dt * SPIN_SPEED;
            else {
                const turns = Math.round((yaw - rest) / (Math.PI * 2));
                const goal = rest + turns * Math.PI * 2;
                yaw += (goal - yaw) * Math.min(1, dt * 6);
                if (Math.abs(goal - yaw) < 0.002) {
                    yaw = rest;
                    paint();
                    frame = 0;
                    last = 0;
                    return;
                }
            }
            paint();
            frame = requestAnimationFrame(tick);
        };
        const start = () => {
            if (reduced || !shown) return;
            spinning = true;
            if (!frame) frame = requestAnimationFrame(tick);
        };
        const stop = () => {
            spinning = false;
        };

        // The card's stretched link covers the stage, so listen on the card itself.
        const card = host.closest("article") ?? host;
        card.addEventListener("pointerenter", start);
        card.addEventListener("pointerleave", stop);
        card.addEventListener("focusin", start);
        card.addEventListener("focusout", stop);
        return () => {
            cancelPaint();
            sizes.disconnect();
            seen.disconnect();
            cancelAnimationFrame(frame);
            card.removeEventListener("pointerenter", start);
            card.removeEventListener("pointerleave", stop);
            card.removeEventListener("focusin", start);
            card.removeEventListener("focusout", stop);
        };
    }, [webgl, tokens, params, side, healthStatus, reduced]);

    return (
        <div
            ref={stage}
            aria-hidden
            className={cn("relative isolate overflow-hidden", className)}
        >
            <canvas ref={canvas} className="absolute inset-0 size-full" />
        </div>
    );
}
