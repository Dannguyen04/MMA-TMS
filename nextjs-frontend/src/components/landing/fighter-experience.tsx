"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { createFighterController, gestureAction, type PointerPosition } from "./fighter-motion";

const FighterScene = dynamic(() => import("./fighter-scene").then((module) => module.FighterScene), { ssr: false });
const INITIAL_POINTER: PointerPosition = { x: 0, y: 0 };

function supportsWebGL() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

export function FighterExperience() {
    const [canRender, setCanRender] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(true);
    const pointer = useRef<PointerPosition>({ ...INITIAL_POINTER });
    const pointerStart = useRef<{ x: number; y: number } | null>(null);
    const controller = useMemo(() => createFighterController({ reducedMotion, cooldownMs: 120 }), [reducedMotion]);

    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncPreference = () => setReducedMotion(preference.matches);
        const frame = window.requestAnimationFrame(() => {
            syncPreference();
            setCanRender(supportsWebGL());
        });
        preference.addEventListener("change", syncPreference);
        return () => {
            window.cancelAnimationFrame(frame);
            preference.removeEventListener("change", syncPreference);
        };
    }, []);

    const updatePointer = (element: HTMLDivElement, clientX: number, clientY: number) => {
        const bounds = element.getBoundingClientRect();
        pointer.current = {
            x: ((clientX - bounds.left) / bounds.width - 0.5) * 2,
            y: ((clientY - bounds.top) / bounds.height - 0.5) * -2,
        };
    };

    return (
        <div
            className={`landing-fighter-stage absolute inset-x-0 bottom-0 z-10 h-[29rem] touch-pan-y select-none sm:h-[34rem] lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[58%] ${canRender ? "is-webgl" : ""}`}
            aria-label="Interactive stylized MMA fighter. Swipe sideways for hooks, swipe upward for an uppercut, or click for a combination."
            role="img"
            onPointerDown={(event) => {
                pointerStart.current = { x: event.clientX, y: event.clientY };
                updatePointer(event.currentTarget, event.clientX, event.clientY);
            }}
            onPointerMove={(event) => updatePointer(event.currentTarget, event.clientX, event.clientY)}
            onPointerLeave={() => {
                pointer.current = { ...INITIAL_POINTER };
                pointerStart.current = null;
            }}
            onPointerUp={(event) => {
                const start = pointerStart.current;
                pointerStart.current = null;
                if (!start) return;
                const action = gestureAction(event.clientX - start.x, event.clientY - start.y) ?? "jab-cross";
                controller.trigger(action, performance.now());
            }}
            onWheel={(event) => {
                if (event.deltaY < -30) controller.trigger("uppercut", performance.now());
            }}
        >
            <div aria-hidden className="landing-fighter-fallback absolute inset-0">
                <div className="landing-fighter-aura" />
                <div className="landing-fighter-silhouette" />
            </div>
            {canRender ? <FighterScene controller={controller} pointer={pointer} reducedMotion={reducedMotion} /> : null}
            <div className="pointer-events-none absolute right-4 bottom-5 flex items-center gap-2 text-[9px] font-semibold tracking-[0.18em] text-white/40 uppercase sm:right-8 lg:right-12 lg:bottom-10">
                <span className="size-1.5 animate-pulse rounded-full bg-nav-accent" />
                Interactive fighter
            </div>
        </div>
    );
}
