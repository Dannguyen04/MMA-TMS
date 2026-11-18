import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { octagonShape } from "@/components/landing/stage/octagon";
import { radialTexture } from "@/components/landing/stage/textures";
import { figureBuild } from "./body/build";
import { FEMALE_MODEL_URL, femaleModelFrom } from "./body/female-model";
import { createMannequinModel } from "./body/mannequin";
import { MUSCULAR_MODEL_URL, muscularModelFrom } from "./body/muscular-model";
import { MODEL_HEIGHT, type BodyModel, type BodyModelKind } from "./body/regions";
import type { FigureParams } from "./figure-params";

/**
 * One WebGL renderer for every fighter portrait on a page. Browsers allow only a handful of live WebGL
 * contexts, so a roster of twelve cards cannot each own a canvas: each card keeps a plain 2D canvas and
 * asks the studio to draw its fighter, then copies the frame.
 *
 * The figures are the body map's: the male scan, the female model, or the A-pose mannequin while a
 * model cannot load, each loaded or built once and scaled to the fighter's height and build.
 *
 * Look: the body map's see-through hologram (glass fill, bright edge; the wire is left out at card size,
 * where it would turn to a grey blur) on a transparent background, with the rim and floor glow tinted by the
 * fighter's health tone. A depth-only draw goes first so the far side never shows through.
 */

/** The model files the studio can draw, by kind. */
const SCANS: Record<Exclude<BodyModelKind, "mannequin">, { url: string; from: (root: THREE.Object3D) => BodyModel }> = {
    muscular: { url: MUSCULAR_MODEL_URL, from: muscularModelFrom },
    female: { url: FEMALE_MODEL_URL, from: femaleModelFrom },
};

export interface PortraitColors {
    body: string;
    rim: string;
    /** Health tone; the floor glow and part of the rim take it. */
    tone: string;
}

const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vPos;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
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
    varying vec3 vPos;
    void main() {
        vec3 n = normalize(vNormal);
        float facing = clamp(abs(dot(n, normalize(vView))), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.3);
        float key = clamp(dot(n, normalize(vec3(-0.5, 0.75, 0.6))), 0.0, 1.0);
        // Overhead light: shoulders brighter than shins.
        float overhead = mix(0.6, 1.0, clamp(vPos.y / uTop, 0.0, 1.0));

        vec3 rim = mix(uRim, uTone, 0.35);
        vec3 glass = mix(uBody, uRim, 0.22) * (0.55 + 0.6 * key) * overhead + rim * fresnel * 1.2;
        gl_FragColor = vec4(glass, 0.24 + 0.68 * fresnel);
        #include <colorspace_fragment>
    }
`;

class PortraitStudio {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(24, 3 / 4, 0.1, 40);
    private readonly figure: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    /** Depth only, drawn first: only the nearest surface of the see-through figure shows. */
    private readonly depth: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    private readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    private readonly ring: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private readonly mannequin = createMannequinModel().geometry;
    private readonly scans = new Map<BodyModelKind, THREE.BufferGeometry>();
    private readonly loading = new Map<BodyModelKind, Promise<void>>();

    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(1);

        const material = new THREE.ShaderMaterial({
            uniforms: { uBody: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uTone: { value: new THREE.Color() }, uTop: { value: 1.6 } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            depthFunc: THREE.LessEqualDepth,
        });
        this.figure = new THREE.Mesh(new THREE.BufferGeometry(), material);
        this.figure.renderOrder = 2;
        // Same vertex shader as the figure so the depths match; a constant nudge only (see body-material.ts).
        this.depth = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader: "void main() { gl_FragColor = vec4(0.0); }",
                transparent: true,
                depthWrite: true,
                colorWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: 0,
                polygonOffsetUnits: 1,
            }),
        );
        this.depth.renderOrder = 1;

        const glowTexture = radialTexture("rgba(255, 255, 255, 0.7)");
        this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, toneMapped: false }));
        this.glow.rotation.x = -Math.PI / 2;
        this.glow.position.y = 0.001;
        this.glow.renderOrder = -1;

        const points = octagonShape(0.62).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        this.ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55, toneMapped: false }));
        this.ring.renderOrder = -1;

        this.scene.add(this.depth, this.figure, this.glow, this.ring);
    }

    /**
     * Resolves once the figure for `kind` can be drawn. Each model file is fetched once per page; if
     * one fails, those fighters are drawn as the mannequin.
     */
    ready(kind: BodyModelKind): Promise<void> {
        if (kind === "mannequin") return Promise.resolve();
        let loading = this.loading.get(kind);
        if (!loading) {
            const scan = SCANS[kind];
            loading = new GLTFLoader()
                .loadAsync(scan.url)
                .then((gltf) => {
                    this.scans.set(kind, scan.from(gltf.scene).geometry);
                })
                .catch((error: unknown) => console.warn(`The ${kind} body model could not load; portraits use the mannequin.`, error));
            this.loading.set(kind, loading);
        }
        return loading;
    }

    /** Draws the fighter turned by `yaw` (radians) into `target`, sized to the target's pixel size. */
    paint(target: HTMLCanvasElement, params: FigureParams, kind: BodyModelKind, colors: PortraitColors, yaw: number) {
        const { width, height } = target;
        if (width === 0 || height === 0) return;
        const context = target.getContext("2d");
        if (!context) return;

        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        // Frame the whole figure with room for the floor ring, whatever the fighter's height.
        const top = params.height * 0.98;
        const distance = top * 3;
        this.camera.position.set(Math.sin(yaw) * distance, top * 0.56, Math.cos(yaw) * distance);
        this.camera.lookAt(0, top * 0.49, 0);
        this.camera.updateProjectionMatrix();

        const material = this.figure.material;
        const build = figureBuild(params);
        this.figure.geometry = this.scans.get(kind) ?? this.mannequin;
        this.figure.scale.set(build.height * build.width, build.height, build.height * build.width);
        this.depth.geometry = this.figure.geometry;
        this.depth.scale.copy(this.figure.scale);
        material.uniforms.uBody.value.setStyle(colors.body);
        material.uniforms.uRim.value.setStyle(colors.rim);
        material.uniforms.uTone.value.setStyle(colors.tone);
        material.uniforms.uTop.value = MODEL_HEIGHT;
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
