import * as THREE from "three";

import { octagonShape } from "@/components/landing/stage/octagon";
import { radialTexture } from "@/components/landing/stage/textures";
import { createFigureGeometry } from "./figure-geometry";
import { figureKey, type FigureParams } from "./figure-params";

/**
 * One WebGL renderer for every fighter portrait on a page. Browsers allow only a handful of live WebGL
 * contexts, so a roster of twelve cards cannot each own a canvas: each card keeps a plain 2D canvas and
 * asks the studio to draw its fighter, then copies the frame. Geometry is cached per build.
 *
 * Look: the landing's sports-medicine hologram on the dark stage, with the rim and floor glow tinted by
 * the fighter's health tone.
 */

export interface PortraitColors {
    body: string;
    rim: string;
    /** Health tone; the floor glow and part of the rim take it. */
    tone: string;
}

const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vHeight;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        vHeight = position.y;
        gl_Position = projectionMatrix * mv;
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 uBody;
    uniform vec3 uRim;
    uniform vec3 uTone;
    uniform float uTop;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vHeight;
    void main() {
        vec3 n = normalize(vNormal);
        float facing = clamp(dot(n, normalize(vView)), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.3);
        float key = clamp(dot(n, normalize(vec3(-0.5, 0.75, 0.6))), 0.0, 1.0);
        float lines = 0.9 + 0.1 * smoothstep(0.35, 0.5, abs(fract(vHeight * 120.0) - 0.5));
        // Overhead light: shoulders brighter than shins.
        float overhead = mix(0.55, 1.0, clamp(vHeight / uTop, 0.0, 1.0));
        vec3 body = mix(uBody, uRim, 0.22);
        vec3 color = body * (0.5 + 0.7 * key) * lines * overhead;
        color += mix(uRim, uTone, 0.35) * fresnel * 1.45;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;

class PortraitStudio {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(24, 3 / 4, 0.1, 40);
    private readonly figure: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    private readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    private readonly ring: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private readonly geometries = new Map<string, THREE.BufferGeometry>();

    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(1);

        const material = new THREE.ShaderMaterial({
            uniforms: { uBody: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uTone: { value: new THREE.Color() }, uTop: { value: 1.6 } },
            vertexShader,
            fragmentShader,
        });
        this.figure = new THREE.Mesh(new THREE.BufferGeometry(), material);

        const glowTexture = radialTexture("rgba(255, 255, 255, 0.7)");
        this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, toneMapped: false }));
        this.glow.rotation.x = -Math.PI / 2;
        this.glow.position.y = 0.001;

        const points = octagonShape(0.62).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        this.ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55, toneMapped: false }));

        this.scene.add(this.figure, this.glow, this.ring);
    }

    private geometryFor(params: FigureParams): THREE.BufferGeometry {
        const key = figureKey(params);
        let geometry = this.geometries.get(key);
        if (!geometry) {
            geometry = createFigureGeometry(params);
            this.geometries.set(key, geometry);
        }
        return geometry;
    }

    /** Draws the fighter turned by `yaw` (radians) into `target`, sized to the target's pixel size. */
    paint(target: HTMLCanvasElement, params: FigureParams, colors: PortraitColors, yaw: number) {
        const { width, height } = target;
        if (width === 0 || height === 0) return;
        const context = target.getContext("2d");
        if (!context) return;

        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        // Frame the whole figure with room for the floor ring, whatever the fighter's height.
        const top = params.height * 0.98;
        const distance = top * 2.7;
        this.camera.position.set(Math.sin(yaw) * distance, top * 0.56, Math.cos(yaw) * distance);
        this.camera.lookAt(0, top * 0.49, 0);
        this.camera.updateProjectionMatrix();

        const material = this.figure.material;
        this.figure.geometry = this.geometryFor(params);
        material.uniforms.uBody.value.setStyle(colors.body);
        material.uniforms.uRim.value.setStyle(colors.rim);
        material.uniforms.uTone.value.setStyle(colors.tone);
        material.uniforms.uTop.value = top;
        this.glow.material.color.setStyle(colors.tone);
        this.ring.material.color.setStyle(colors.rim);

        this.renderer.render(this.scene, this.camera);
        context.clearRect(0, 0, width, height);
        context.drawImage(this.renderer.domElement, 0, 0, width, height);
    }
}

/*
 * Paint queue: each first paint (WebGL start, shader compile, geometry build) costs tens of milliseconds on a
 * slow machine, so portraits are painted one per idle slot instead of all in the commit that mounts them.
 */
const queue: (() => void)[] = [];
let draining = false;

function whenIdle(run: () => void) {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 400 });
    else window.setTimeout(run, 16);
}

function drain() {
    queue.shift()?.();
    if (queue.length > 0) whenIdle(drain);
    else draining = false;
}

/** Runs `job` in the next idle slot, after any portraits already waiting. Returns a cancel function. */
export function queuePaint(job: () => void): () => void {
    let live = true;
    queue.push(() => {
        if (live) job();
    });
    if (!draining) {
        draining = true;
        whenIdle(drain);
    }
    return () => {
        live = false;
    };
}

let studio: PortraitStudio | null | undefined;

/** The page's studio, created on first use; null when the browser cannot draw WebGL. */
export function portraitStudio(): PortraitStudio | null {
    if (studio === undefined) {
        try {
            studio = new PortraitStudio();
        } catch (error) {
            console.warn("Fighter portraits are off: WebGL could not start.", error);
            studio = null;
        }
    }
    return studio;
}
