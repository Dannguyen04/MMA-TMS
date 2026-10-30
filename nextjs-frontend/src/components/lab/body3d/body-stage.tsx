"use client";

import { RotateCcw, ScanLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { BodyMap } from "@/components/domain/body-map";
import type { Tone } from "@/components/ui/tone";
import { bodyRegionLabel } from "@/lib/domain/labels";
import type { BodyRegion } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import styles from "../lab.module.css";
import { useReducedMotion, useThemeTokens, useWebGL } from "@/components/fighter-3d/use-graphics";
import type { BodyLook } from "./body-material";
import type { SceneHighlight } from "./body-scene";

const BodyScene = dynamic(() => import("./body-scene"), { ssr: false });

export interface StageHighlight {
    region: BodyRegion;
    tone: Tone;
    /** Shown on the pin and, without WebGL, in the 2D legend. */
    label: string;
    /** 0–1, default 1. */
    strength?: number;
    pulse?: boolean;
    /** Pins only the highlights that matter most; the rest stay as colour on the body. */
    pinned?: boolean;
}

const TONE_TOKEN: Record<Tone, string> = {
    neutral: "neutral-solid",
    primary: "primary",
    success: "success-solid",
    warning: "warning-solid",
    danger: "danger-solid",
    info: "info-solid",
    ai: "ai-solid",
};

const TOKENS = [
    "neutral-solid",
    "primary",
    "success-solid",
    "warning-solid",
    "danger-solid",
    "info-solid",
    "ai-solid",
    "nav-surface",
    "nav-accent",
    "border-strong",
    "fg-subtle",
] as const;

export interface BodyStageProps {
    look: BodyLook;
    highlights: StageHighlight[];
    selected?: BodyRegion | null;
    onSelect?: (region: BodyRegion | null) => void;
    /** Move the camera in on the selected region. */
    zoomOnSelect?: boolean;
    scanKey?: number;
    dim?: number;
    className?: string;
    compact?: boolean;
    /** Hide the turn and rescan buttons (small multiples). */
    bare?: boolean;
    ariaLabel: string;
    children?: ReactNode;
}

/** The 3D body on its stage: drag to turn, tap a region, pins that follow the body. Falls back to the 2D map without WebGL. */
export function BodyStage({
    look,
    highlights,
    selected = null,
    onSelect,
    zoomOnSelect = false,
    scanKey: externalScan = 0,
    dim,
    className,
    compact,
    bare,
    ariaLabel,
    children,
}: BodyStageProps) {
    const tokens = useThemeTokens(TOKENS);
    const webgl = useWebGL();
    const reduced = useReducedMotion();
    const root = useRef<HTMLDivElement>(null);
    const labels = useRef<HTMLDivElement>(null);
    const yaw = useRef(0);
    const drag = useRef<{ x: number; moved: number } | null>(null);
    const [hovered, setHovered] = useState<BodyRegion | null>(null);
    const [scan, setScan] = useState(0);
    const [visible, setVisible] = useState(false);
    const [facingBack, setFacingBack] = useState(false);
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
        observer.observe(el);
        // A phone-width stage pulls the camera back and keeps pins to the region name.
        const sizes = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 480));
        sizes.observe(el);
        return () => {
            observer.disconnect();
            sizes.disconnect();
        };
    }, []);

    const sceneHighlights = useMemo<SceneHighlight[]>(
        () =>
            tokens
                ? highlights.map((h) => ({ region: h.region, color: tokens[TONE_TOKEN[h.tone] as (typeof TOKENS)[number]], strength: h.strength ?? 1, pulse: Boolean(h.pulse) }))
                : [],
        [highlights, tokens],
    );
    const pins = highlights.filter((h) => h.pinned);
    const palette = tokens
        ? look === "hologram"
            ? { base: tokens["nav-surface"], rim: tokens["nav-accent"] }
            : { base: tokens["border-strong"], rim: tokens["fg-subtle"] }
        : null;

    const turn = (back: boolean) => {
        yaw.current = back ? Math.PI : 0;
        setFacingBack(back);
    };

    const stageClass = cn("relative isolate overflow-hidden rounded-2xl", look === "hologram" ? styles.stageHologram : styles.stageClinical, className);

    if (webgl === false) {
        return (
            <div className={cn(stageClass, "flex items-center justify-center p-6")}>
                <BodyMap highlights={highlights.map(({ region, tone, label }) => ({ region, tone, label }))} size="md" />
            </div>
        );
    }

    return (
        <div
            ref={root}
            className={cn(stageClass, hovered && onSelect ? "cursor-pointer" : "cursor-grab")}
            onPointerDown={(e) => {
                drag.current = { x: e.clientX, moved: 0 };
            }}
            onPointerMove={(e) => {
                const d = drag.current;
                if (!d || e.buttons === 0) return;
                const dx = e.clientX - d.x;
                d.x = e.clientX;
                d.moved += Math.abs(dx);
                yaw.current += dx * 0.012;
            }}
            onPointerUp={() => {
                const d = drag.current;
                if (d && d.moved > 4) {
                    // Snap the "back" toggle to whichever side now faces the camera.
                    const turns = ((yaw.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
                    setFacingBack(turns > Math.PI / 2 && turns < (Math.PI * 3) / 2);
                }
            }}
        >
            {palette && (
                <div className="absolute inset-0">
                    <BodyScene
                        look={look}
                        highlights={sceneHighlights}
                        palette={palette}
                        focus={zoomOnSelect ? selected : null}
                        hovered={onSelect ? (hovered ?? selected) : null}
                        onHover={setHovered}
                        onSelect={(region) => {
                            if ((drag.current?.moved ?? 0) > 4) return;
                            onSelect?.(region);
                        }}
                        yaw={yaw}
                        scanKey={scan + externalScan}
                        dim={dim}
                        animate={!reduced && visible}
                        labels={labels}
                        ariaLabel={ariaLabel}
                        compact={compact || narrow}
                    />
                </div>
            )}

            <div ref={labels} aria-hidden className="pointer-events-none absolute inset-0">
                {pins.map((pin) => (
                    <div
                        key={pin.region}
                        data-region={pin.region}
                        className={cn(styles.pin, look === "hologram" ? styles.pinHologram : styles.pinClinical)}
                        style={{ "--pin-color": `var(--${TONE_TOKEN[pin.tone]})`, opacity: 0 } as CSSProperties}
                    >
                        <span className={styles.pinDot} />
                        <span className={styles.pinTag}>
                            {bodyRegionLabel(pin.region, "vi")}
                            {!narrow && <span className={look === "hologram" ? "font-normal text-nav-fg" : "font-normal text-fg-muted"}>{pin.label}</span>}
                        </span>
                    </div>
                ))}
            </div>

            {children && <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-5">{children}</div>}

            {!bare && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3 sm:p-4">
                    <div
                        role="group"
                        aria-label="Hướng nhìn"
                        className={cn(
                            "inline-flex rounded-lg p-0.5 text-[13px] font-medium",
                            look === "hologram" ? "bg-nav-surface/85 text-nav-fg ring-1 ring-nav-border" : "bg-surface text-fg-muted shadow-card ring-1 ring-border",
                        )}
                    >
                        {[false, true].map((back) => (
                            <button
                                key={String(back)}
                                type="button"
                                aria-pressed={facingBack === back}
                                onClick={() => turn(back)}
                                className={cn(
                                    "h-8 rounded-md px-3 transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                                    facingBack === back && (look === "hologram" ? "bg-nav-accent/25 text-nav-fg-active" : "bg-primary-soft text-primary-soft-fg"),
                                )}
                            >
                                {back ? "Mặt sau" : "Mặt trước"}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn("hidden text-xs sm:inline", look === "hologram" ? "text-nav-fg" : "text-fg-subtle")}>Kéo để xoay</span>
                        <button
                            type="button"
                            onClick={() => {
                                turn(false);
                                setScan((n) => n + 1);
                            }}
                            aria-label="Quét lại cơ thể"
                            className={cn(
                                "inline-flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4",
                                look === "hologram" ? "bg-nav-surface/85 text-nav-fg-active ring-1 ring-nav-border hover:bg-nav-surface" : "bg-surface text-fg shadow-card ring-1 ring-border hover:bg-surface-hover",
                            )}
                        >
                            {look === "hologram" ? <ScanLine aria-hidden /> : <RotateCcw aria-hidden />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
