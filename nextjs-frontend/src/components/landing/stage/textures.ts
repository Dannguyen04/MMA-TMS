import * as THREE from "three";

/** A soft round spot: `center` (an rgba() colour) at the middle, fading to transparent at the edge. */
export function radialTexture(center: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d");
    if (c) {
        const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, center);
        gradient.addColorStop(0.35, center.replace(/[\d.]+\)$/, "0.35)"));
        gradient.addColorStop(1, center.replace(/[\d.]+\)$/, "0)"));
        c.fillStyle = gradient;
        c.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/** Deterministic pseudo-random numbers, so the mat and the haze look the same on every visit. */
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
