/**
 * How much graphics this device gets. "lite" drops what costs most on weak machines (bloom,
 * multisampling, high pixel ratios, smooth scrolling, backdrop blur) but keeps every fact on screen.
 *
 * Decided once per page load from what the browser reports, before anything heavy starts, so a weak
 * machine never has to stutter first. `?graphics=lite|full` forces a tier and remembers it on this
 * browser (for the demo projector); `?graphics=auto` forgets it.
 */

export type GraphicsTier = "full" | "lite";

export interface GraphicsProbe {
    /** `navigator.hardwareConcurrency` (logical cores). */
    cores?: number;
    /** `navigator.deviceMemory` in GB (Chromium only, capped at 8). */
    memoryGb?: number;
    /** The unmasked WebGL renderer string, e.g. "ANGLE (Intel, Intel(R) UHD Graphics 620 …)". */
    renderer?: string;
    /** The visitor asked to save data. */
    saveData?: boolean;
}

/** Drawn on the CPU: every frame of the landing stage would cost the main thread. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;
/** Older Intel integrated graphics; newer "Intel(R) Graphics", Iris and Arc keep full quality. */
const WEAK_INTEGRATED = /intel.*\b(u?hd)\b/i;

export function classifyGraphics({ cores, memoryGb, renderer, saveData }: GraphicsProbe): GraphicsTier {
    if (saveData) return "lite";
    if (renderer && (SOFTWARE_RENDERER.test(renderer) || WEAK_INTEGRATED.test(renderer))) return "lite";
    if (cores !== undefined && cores <= 4) return "lite";
    if (memoryGb !== undefined && memoryGb <= 4) return "lite";
    return "full";
}

export function parseGraphicsOverride(value: string | null | undefined): GraphicsTier | "auto" | null {
    return value === "lite" || value === "full" || value === "auto" ? value : null;
}

const STORAGE_KEY = "mma-graphics";

let tier: GraphicsTier | undefined;

/** The tier for this page load; also written to `<html data-graphics>` for CSS. Browser only. */
export function graphicsTier(): GraphicsTier {
    if (tier === undefined) {
        tier = overrideTier() ?? classifyGraphics(probe());
        document.documentElement.dataset.graphics = tier;
    }
    return tier;
}

function overrideTier(): GraphicsTier | null {
    try {
        const asked = parseGraphicsOverride(new URLSearchParams(location.search).get("graphics"));
        if (asked === "auto") localStorage.removeItem(STORAGE_KEY);
        else if (asked) localStorage.setItem(STORAGE_KEY, asked);
        const stored = parseGraphicsOverride(localStorage.getItem(STORAGE_KEY));
        return stored === "auto" ? null : stored;
    } catch {
        return null;
    }
}

function probe(): GraphicsProbe {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    return {
        cores: nav.hardwareConcurrency || undefined,
        memoryGb: nav.deviceMemory,
        saveData: nav.connection?.saveData,
        renderer: webglRenderer(),
    };
}

function webglRenderer(): string | undefined {
    try {
        const gl = document.createElement("canvas").getContext("webgl");
        if (!gl) return undefined;
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return typeof name === "string" ? name : undefined;
    } catch {
        return undefined;
    }
}
