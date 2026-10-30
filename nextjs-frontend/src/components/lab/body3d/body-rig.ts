import * as THREE from "three";

import type { BodyRegion } from "@/lib/domain/types";
import { REGION_ANCHOR, REGION_SPOTS, createMannequinGeometry } from "./anatomy";
import { createBodyMaterial, type BodyLook, type BodyUniforms } from "./body-material";

export interface RigHighlight {
    region: BodyRegion;
    color: string;
    strength: number;
    pulse: boolean;
}

const SCAN_FROM = 1.95;
const SCAN_TO = -0.12;
const SCAN_SECONDS = 1.9;

export interface RigFrame {
    time: number;
    delta: number;
    yaw: number;
    dim: number;
    animate: boolean;
    focus: BodyRegion | null;
    distance: number;
}

/**
 * Owns the mannequin's geometry, material and per-frame state, so the React side only calls methods
 * (the same split as the landing's world). The scene keeps one rig for its whole life.
 */
export class BodyRig {
    readonly geometry = createMannequinGeometry();
    private readonly shader = createBodyMaterial();
    private scanStart: number | null = null;
    private readonly lookAt = new THREE.Vector3(0, 0.92, 0);

    get material(): THREE.ShaderMaterial {
        return this.shader.material;
    }

    private get u(): BodyUniforms {
        return this.shader.uniforms;
    }

    setLook(look: BodyLook, base: string, rim: string) {
        this.u.uLook.value = look === "hologram" ? 0 : 1;
        this.u.uBase.value.setStyle(base);
        this.u.uRim.value.setStyle(rim);
    }

    setHighlights(highlights: RigHighlight[]) {
        const byRegion = new Map(highlights.map((h) => [h.region, h]));
        REGION_SPOTS.forEach((s, i) => {
            const h = byRegion.get(s.region);
            this.u.uSpotAmp.value[i] = h ? h.strength : 0;
            this.u.uSpotPulse.value[i] = h?.pulse ? 1 : 0;
            if (h) this.u.uSpotColor.value[i].setStyle(h.color);
        });
    }

    setFocus(regions: (BodyRegion | null)[]) {
        REGION_SPOTS.forEach((s, i) => {
            this.u.uSpotFocus.value[i] = regions.includes(s.region) ? 1 : 0;
        });
    }

    /** Runs the head-to-toe scan again; without animation the body shows fully at once. */
    restartScan(animate: boolean) {
        this.scanStart = animate ? null : -1;
    }

    update(frame: RigFrame, group: THREE.Group, camera: THREE.Camera) {
        const { time, delta } = frame;
        this.u.uTime.value = time;
        this.u.uDim.value += (frame.dim - this.u.uDim.value) * Math.min(1, delta * 4);

        if (this.scanStart === null) this.scanStart = time;
        const progress = this.scanStart < 0 ? 1 : Math.min(1, (time - this.scanStart) / SCAN_SECONDS);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.u.uScan.value = SCAN_FROM + (SCAN_TO - SCAN_FROM) * eased;

        group.rotation.y += (frame.yaw - group.rotation.y) * Math.min(1, delta * 6);
        group.position.y = frame.animate ? Math.sin(time * 1.6) * 0.004 : 0;

        // Frame the whole body, or move in on the focused region.
        const anchor = frame.focus ? REGION_ANCHOR.get(frame.focus) : undefined;
        const wantLook = anchor ? new THREE.Vector3(anchor.center.x * 0.5, anchor.center.y, 0) : new THREE.Vector3(0, 0.92, 0);
        const wantPos = anchor ? new THREE.Vector3(wantLook.x, wantLook.y + 0.08, frame.distance * 0.62) : new THREE.Vector3(0, 1.0, frame.distance);
        const k = Math.min(1, delta * (frame.animate ? 3.2 : 60));
        this.lookAt.lerp(wantLook, k);
        camera.position.lerp(wantPos, k);
        camera.lookAt(this.lookAt);
    }

    dispose() {
        this.geometry.dispose();
        this.shader.material.dispose();
    }
}
