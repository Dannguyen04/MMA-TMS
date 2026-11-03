"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { graphicsTier, type GraphicsTier } from "@/lib/graphics-tier";

function subscribeTheme(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onChange);
    return () => {
        observer.disconnect();
        media.removeEventListener("change", onChange);
    };
}

/**
 * Reads CSS custom properties from <html> so WebGL and canvas drawing use the same tokens as the rest
 * of the UI, and reads them again when the theme changes (the data-theme attribute or the OS scheme).
 * Null during server rendering and hydration.
 */
export function useThemeTokens<const T extends readonly string[]>(names: T): Record<T[number], string> | null {
    const key = names.join("|");
    const snapshot = useCallback(() => {
        const style = getComputedStyle(document.documentElement);
        return key
            .split("|")
            .map((name) => style.getPropertyValue(`--${name}`).trim() || "#888888")
            .join("|");
    }, [key]);
    const raw = useSyncExternalStore(subscribeTheme, snapshot, () => null);
    return useMemo(() => {
        if (raw === null) return null;
        const values = raw.split("|");
        return Object.fromEntries(key.split("|").map((name, i) => [name, values[i]])) as Record<T[number], string>;
    }, [raw, key]);
}

function subscribeMotion(onChange: () => void) {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

/** True when the visitor asked for reduced motion; false until the browser value is known. */
export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeMotion,
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => false,
    );
}

function subscribeNever() {
    return () => {};
}

let webglSupport: boolean | undefined;

function supportsWebGL(): boolean {
    if (webglSupport === undefined) {
        try {
            const canvas = document.createElement("canvas");
            webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
        } catch {
            webglSupport = false;
        }
    }
    return webglSupport;
}

/** Null on the server, then whether this browser can draw WebGL. */
export function useWebGL(): boolean | null {
    return useSyncExternalStore(subscribeNever, supportsWebGL, () => null);
}

/** Null on the server, then this device's graphics tier (see `lib/graphics-tier.ts`). */
export function useGraphicsTier(): GraphicsTier | null {
    return useSyncExternalStore(subscribeNever, graphicsTier, () => null);
}
