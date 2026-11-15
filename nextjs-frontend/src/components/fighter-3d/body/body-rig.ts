import * as THREE from "three";

import type { BodyRegion } from "@/lib/domain/types";
import { createBodyMaterials, type BodyLook, type BodyMaterials, type BodyUniforms } from "./body-material";
import { MODEL_HEIGHT, regionAnchors, regionAt, type BodyModel, type RegionSpot } from "./regions";

export interface RigHighlight {
    region: BodyRegion;
    color: string;
    strength: number;
    pulse: boolean;
}

/**
 * The fighter's build relative to the 1.75 m model: `height` scales the whole figure, `width` only
 * across (x, z). 1 = the model as built.
 */
export interface FigureBuild {
    height: number;
    width: number;
}

export const NEUTRAL_BUILD: FigureBuild = { height: 1, width: 1 };

const SCAN_FROM = 1.95;
const SCAN_TO = -0.12;
const SCAN_SECONDS = 1.9;

export interface RigFrame {
    time: number;
    delta: number;
    yaw: number;
    dim: number;
    animate: boolean;
    /** Breathing and the idle light along the lattice; off under reduced motion, on lite and off screen. */
    idle: boolean;
    focus: BodyRegion | null;
    distance: number;
}

/** Eases `value` toward `target` with time constant 1 / `rate` seconds; snaps when close. */
function approach(value: number, target: number, rate: number, delta: number): number {
    const next = value + (target - value) * Math.min(1, delta * rate);
    return Math.abs(target - next) < 0.002 ? target : next;
}

/**
 * Owns one body model's geometry, its material and the per-frame state, so the React side only calls
 * methods (the same split as the landing's world). A scene keeps one rig per model for its whole life.
 */
export class BodyRig {
    readonly geometry: THREE.BufferGeometry;
    private readonly spots: readonly RegionSpot[];
    private readonly anchors: Map<BodyRegion, RegionSpot>;
    private readonly shader: BodyMaterials;
    /** What the highlights and the hover ring are easing toward, per spot. */
    private readonly targetAmp: number[];
    private readonly targetFocus: number[];
    private build: FigureBuild = NEUTRAL_BUILD;
    private scanStart: number | null = null;
    private readonly lookAt = new THREE.Vector3(0, 0.92, 0);
    private readonly anchorWorld = new THREE.Vector3();
    private pulsing = false;

    constructor(model: BodyModel) {
        this.geometry = model.geometry;
        this.spots = model.spots;
        this.anchors = regionAnchors(model.spots);
        this.shader = createBodyMaterials(model.spots);
        this.targetAmp = model.spots.map(() => 0);
        this.targetFocus = model.spots.map(() => 0);
    }

    /** The see-through body's three draws, in drawing order (see `body-material.ts`). */
    get materials(): Pick<BodyMaterials, "depth" | "occluded" | "body" | "wire"> {
        return this.shader;
    }

    private get u(): BodyUniforms {
        return this.shader.uniforms;
    }

    /** The region under a point given in the mesh's own space. */
    regionAt(point: THREE.Vector3): BodyRegion | null {
        return regionAt(this.spots, point);
    }

    anchor(region: BodyRegion): RegionSpot | undefined {
        return this.anchors.get(region);
    }

    /** 0–1: how far the scan band has passed height `y` (model space), as the shader reveals a region. */
    revealAt(y: number): number {
        return THREE.MathUtils.smoothstep(-this.u.uScan.value, -(y + 0.04), -(y - 0.04));
    }

    setLook(look: BodyLook, base: string, rim: string) {
        this.u.uLook.value = look === "hologram" ? 0 : 1;
        this.u.uBase.value.setStyle(base);
        this.u.uRim.value.setStyle(rim);
    }

    setBuild(build: FigureBuild) {
        this.build = build;
    }

    setHighlights(highlights: RigHighlight[]) {
        const byRegion = new Map(highlights.map((h) => [h.region, h]));
        this.pulsing = highlights.some((h) => h.pulse && h.strength > 0);
        this.spots.forEach((s, i) => {
            const h = byRegion.get(s.region);
            this.targetAmp[i] = h ? h.strength : 0;
            this.u.uSpotPulse.value[i] = h?.pulse ? 1 : 0;
            if (h) this.u.uSpotColor.value[i].setStyle(h.color);
        });
    }

    setFocus(regions: (BodyRegion | null)[]) {
        this.spots.forEach((s, i) => {
            this.targetFocus[i] = regions.includes(s.region) ? 1 : 0;
        });
    }

    /** Runs the head-to-toe scan again; without animation the body shows fully at once. */
    restartScan(animate: boolean) {
        this.scanStart = animate ? null : -1;
        if (!animate) this.settle();
    }

    /** Puts every eased value at its target (reduced motion, or a frame drawn without animation). */
    private settle() {
        this.targetAmp.forEach((t, i) => (this.u.uSpotAmp.value[i] = t));
        this.targetFocus.forEach((t, i) => (this.u.uSpotFocus.value[i] = t));
    }

    /**
     * Advances one frame. `moving`: something still changes every frame (the scan, a turn, the camera, a
     * pulsing region, a fading highlight), so the scene asks for the next frame; a still body costs
     * nothing. `idling`: only the slow idle motion runs, which the scene draws at a lower frame rate.
     */
    update(frame: RigFrame, group: THREE.Group, camera: THREE.Camera): { moving: boolean; idling: boolean } {
        const { time, delta } = frame;
        const { height, width } = this.build;
        this.u.uTime.value = time;
        this.u.uDim.value += (frame.dim - this.u.uDim.value) * Math.min(1, delta * 4);

        // Highlights fade in and out (~250 ms), the hover ring grows and shrinks (~120 ms).
        let easing = false;
        if (frame.animate) {
            for (let i = 0; i < this.targetAmp.length; i++) {
                const amp = approach(this.u.uSpotAmp.value[i], this.targetAmp[i], 7, delta);
                const ring = approach(this.u.uSpotFocus.value[i], this.targetFocus[i], 14, delta);
                easing ||= amp !== this.targetAmp[i] || ring !== this.targetFocus[i];
                this.u.uSpotAmp.value[i] = amp;
                this.u.uSpotFocus.value[i] = ring;
            }
        } else {
            this.settle();
        }
        const idleTarget = frame.idle && frame.animate ? 1 : 0;
        this.u.uIdle.value = frame.animate ? approach(this.u.uIdle.value, idleTarget, 2, delta) : idleTarget;
        const idling = this.u.uIdle.value > 0;

        if (this.scanStart === null) this.scanStart = time;
        const progress = this.scanStart < 0 ? 1 : Math.min(1, (time - this.scanStart) / SCAN_SECONDS);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.u.uScan.value = SCAN_FROM + (SCAN_TO - SCAN_FROM) * eased;

        group.scale.set(height * width, height, height * width);
        const turning = Math.abs(frame.yaw - group.rotation.y) > 0.001;
        group.rotation.y = turning ? group.rotation.y + (frame.yaw - group.rotation.y) * Math.min(1, delta * 6) : frame.yaw;
        group.updateMatrixWorld();

        // Frame the whole body (the camera keeps its distance, so a taller fighter stands taller), or
        // move in on the focused region.
        const anchor = frame.focus ? this.anchors.get(frame.focus) : undefined;
        let wantLook: THREE.Vector3;
        let wantPos: THREE.Vector3;
        if (anchor) {
            this.anchorWorld.copy(anchor.center).applyMatrix4(group.matrixWorld);
            wantLook = new THREE.Vector3(this.anchorWorld.x * 0.5, this.anchorWorld.y, 0);
            wantPos = new THREE.Vector3(wantLook.x, wantLook.y + 0.08, frame.distance * 0.62);
        } else {
            const middle = (MODEL_HEIGHT / 2) * Math.max(1, height) + 0.05;
            wantLook = new THREE.Vector3(0, middle, 0);
            wantPos = new THREE.Vector3(0, middle + 0.08, frame.distance);
        }
        const k = Math.min(1, delta * (frame.animate ? 3.2 : 60));
        const flying = camera.position.distanceTo(wantPos) > 0.002 || this.lookAt.distanceTo(wantLook) > 0.002;
        this.lookAt.lerp(wantLook, k);
        camera.position.lerp(wantPos, k);
        camera.lookAt(this.lookAt);
        return { moving: progress < 1 || turning || flying || this.pulsing || easing, idling };
    }

    dispose() {
        this.geometry.dispose();
        this.shader.depth.dispose();
        this.shader.occluded.dispose();
        this.shader.body.dispose();
        this.shader.wire.dispose();
    }
}
