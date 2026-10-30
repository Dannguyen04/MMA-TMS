import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { FIGHTER_IMAGE, KEYPOINTS, LEFT_KNEE, pixelToModel } from "../pose-skeleton";
import type { StageFrame } from "../story";
import { createArena } from "./arena";
import { createBackdrop } from "./backdrop";
import { createFighterMaterial } from "./fighter-material";
import { createGrainOutputPass } from "./output-pass";
import { createRelief } from "./relief";
import { createSkeletonOverlay } from "./skeleton";
import { createTechniqueBars } from "./technique-bars";
import { radialTexture } from "./textures";

/** HTML labels pinned to points on the stage, positioned by the scene every frame. */
export type LabelId = "knee" | "focus" | `bar-${number}`;
export type LabelRegistry = Map<LabelId, HTMLElement>;

/** How far the relief bulges toward the camera at its thickest, in metres. */
const RELIEF_DEPTH = 0.1;

/**
 * Contact shadows under the top light, in the fighter's own space so they turn with him: a soft
 * pool under his body and a tight, dark one under each foot (centre pixel column, width, depth).
 */
const FOOT_SHADOWS = [
    { x: pixelToModel(740, 0)[0], width: 0.42, depth: 0.16 },
    { x: pixelToModel(250, 0)[0], width: 0.24, depth: 0.18 },
] as const;

export interface World {
    object: THREE.Group;
    update(frame: StageFrame, camera: THREE.PerspectiveCamera, time: number, delta: number, size: { width: number; height: number }, labels: LabelRegistry): void;
    setResolution(width: number, height: number): void;
    dispose(): void;
}

/**
 * The photographs the stage is built from: the fighter cutout, the stands and the mat canvas.
 * Decoded off the main thread as ImageBitmaps already flipped for WebGL, so `flipY` stays false.
 */
export interface StagePhotos {
    fighter: THREE.Texture<ImageBitmap>;
    plate: THREE.Texture<ImageBitmap>;
    canvas: THREE.Texture<ImageBitmap>;
}

/** How the photos are decoded: the same pixels three.js's TextureLoader would upload. */
export const PHOTO_BITMAP_OPTIONS = { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" } as const;

export function stagePhotoTexture(bitmap: ImageBitmap): THREE.Texture<ImageBitmap> {
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
}

export interface WorldOptions {
    compact: boolean;
    animate: boolean;
    /** Weak device: drawn without MSAA (see `createComposer`), a coarser relief mesh, less dust, cheaper texture filtering. */
    lite: boolean;
}

export function createWorld({ fighter: photo, plate, canvas }: StagePhotos, { compact, animate, lite }: WorldOptions): World {
    const object = new THREE.Group();
    const glow = radialGlow();

    // The fighter: the cutout on a finely divided plane, feet on the mat, bulged into a relief.
    const { width, height, centerX, feetY, metresPerPixel } = FIGHTER_IMAGE;
    const planeWidth = width * metresPerPixel;
    const planeHeight = height * metresPerPixel;
    const relief = createRelief(photo.image, { flipY: true });
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = lite ? 2 : 8;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, lite ? 72 : 144, lite ? 108 : 216);
    geometry.translate((width / 2 - centerX) * metresPerPixel, planeHeight / 2 - (height - feetY) * metresPerPixel, 0);
    const { material, uniforms } = createFighterMaterial(photo, relief, RELIEF_DEPTH, { multisampled: !lite });
    const body = new THREE.Mesh(geometry, material);
    body.frustumCulled = false;

    const depthAt = (x: number, y: number) => {
        const u = (x / metresPerPixel + centerX) / width;
        const v = 1 - (feetY - y / metresPerPixel) / height;
        return relief.sample(u, v) * RELIEF_DEPTH;
    };
    const fighter = new THREE.Group();
    const skeleton = createSkeletonOverlay(glow, depthAt);
    const shadowTexture = radialTexture("rgba(0,0,0,0.85)");
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, fog: false });
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    shadowGeometry.rotateX(-Math.PI / 2);
    const pool = new THREE.Mesh(shadowGeometry, shadowMaterial);
    pool.scale.set(1.5, 1, 1.05);
    pool.position.set(-0.03, 0.004, 0);
    fighter.add(pool);
    for (const foot of FOOT_SHADOWS) {
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.scale.set(foot.width, 1, foot.depth);
        shadow.position.set(foot.x, 0.005, 0.02);
        fighter.add(shadow);
    }
    fighter.add(body, skeleton.object);

    const backdrop = createBackdrop(plate);
    const arena = createArena({ dust: lite ? (compact ? 0 : 50) : compact ? 70 : 160, canvas });
    const bars = createTechniqueBars(glow);
    object.add(backdrop.object, arena.object, fighter, bars.object);

    const [kneeX, kneeY] = KEYPOINTS[LEFT_KNEE];
    const focusPoint = new THREE.Vector3(kneeX, kneeY, depthAt(kneeX, kneeY));
    const lookAt = new THREE.Vector3();
    const anchor = new THREE.Vector3();
    const focusWorld = new THREE.Vector3();
    const kneeWorld = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    const toBar = new THREE.Vector3();

    /** Positions a label over its 3D point; labels left of `minX` (where copy sits) stay hidden. */
    const place = (element: HTMLElement | undefined, point: THREE.Vector3, opacity: number, camera: THREE.Camera, size: { width: number; height: number }, minX = 0) => {
        if (!element) return;
        anchor.copy(point).project(camera);
        const x = (anchor.x * 0.5 + 0.5) * size.width;
        const y = (-anchor.y * 0.5 + 0.5) * size.height;
        const visible = opacity > 0.01 && anchor.z < 1 && x >= minX;
        element.style.opacity = visible ? opacity.toFixed(3) : "0";
        if (visible) element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };

    return {
        object,
        update(frame, camera, time, delta, size, labels) {
            camera.position.set(...frame.camera.position);
            camera.lookAt(lookAt.set(...frame.camera.target));
            if (Math.abs(camera.fov - frame.camera.fov) > 0.01) {
                camera.fov = frame.camera.fov;
                camera.updateProjectionMatrix();
            }
            backdrop.update(frame, camera);
            // A cutout has no back: he keeps turning to face the camera as it orbits.
            fighter.rotation.y = frame.camera.facing;
            // Light on his toes: a small bounce and breath in his guard.
            fighter.position.y = animate ? Math.abs(Math.sin(time * 1.9)) * 0.012 : 0;
            fighter.scale.y = animate ? 1 + Math.sin(time * 1.3) * 0.0035 : 1;
            fighter.updateMatrixWorld();

            uniforms.uTime.value = time;
            uniforms.uLights.value = frame.lights;
            uniforms.uScanY.value = frame.scanY;
            uniforms.uScan.value = frame.scan;
            uniforms.uXray.value = frame.xray;
            uniforms.uFocusStrength.value = frame.focus;
            uniforms.uFocus.value.copy(focusPoint).applyMatrix4(fighter.matrixWorld);
            arena.update(frame, time, delta);
            skeleton.update(frame, time);
            bars.update(frame, time);

            place(labels.get("knee"), kneeWorld.copy(skeleton.knee).applyMatrix4(fighter.matrixWorld), frame.angle, camera, size);
            place(labels.get("focus"), focusWorld.copy(focusPoint).applyMatrix4(fighter.matrixWorld), frame.focus, camera, size);
            // Label only the bars on the camera's side of the fighter; the ones behind him would pile up.
            toCamera.set(camera.position.x, 0, camera.position.z).normalize();
            bars.tops.forEach((top, index) => {
                const facing = THREE.MathUtils.smoothstep(toBar.set(top.x, 0, top.z).normalize().dot(toCamera), -0.35, 0.1);
                place(labels.get(`bar-${index}`), top, Math.min(1, frame.bars * 1.4) ** 2 * facing, camera, size, compact ? 0 : size.width * 0.4);
            });
        },
        setResolution(width, height) {
            skeleton.setResolution(width, height);
        },
        dispose() {
            backdrop.dispose();
            arena.dispose();
            skeleton.dispose();
            bars.dispose();
            relief.dispose();
            geometry.dispose();
            material.dispose();
            shadowGeometry.dispose();
            shadowMaterial.dispose();
            shadowTexture.dispose();
            glow.dispose();
        },
    };
}

/**
 * Bloom on bright details only (scan line, keypoints, lenses, beams, the brightest bokeh), then film
 * grain. A lite composer skips the bloom and the multisampling: one scene pass and the output pass.
 */
export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, { lite }: { lite: boolean }) {
    // Multisampled so the cutout's alpha-to-coverage edges stay smooth.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lite ? 0 : 4 });
    const composer = new EffectComposer(renderer, target);
    const bloom = lite ? null : new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.85);
    const output = createGrainOutputPass(0.045);
    composer.addPass(new RenderPass(scene, camera));
    if (bloom) composer.addPass(bloom);
    composer.addPass(output.pass);
    return {
        /**
         * Compiles the scene's shaders for the buffer the scene pass draws into: three.js builds
         * different programs there (no tone mapping, linear output) than for the screen.
         * Uses KHR_parallel_shader_compile where available.
         */
        compile() {
            const previous = renderer.getRenderTarget();
            renderer.setRenderTarget(composer.readBuffer);
            const done = renderer.compileAsync(scene, camera);
            renderer.setRenderTarget(previous);
            return done;
        },
        render(time: number, delta: number) {
            output.setTime(time);
            composer.render(delta);
        },
        setBloom(enabled: boolean) {
            if (bloom) bloom.enabled = enabled;
        },
        setSize(width: number, height: number, pixelRatio: number) {
            composer.setPixelRatio(pixelRatio);
            // The bloom pass already works at half the drawing-buffer size.
            composer.setSize(width, height);
        },
        dispose() {
            composer.dispose();
            bloom?.dispose();
            output.pass.dispose();
            target.dispose();
        },
    };
}

/**
 * The venue's air: faint reflections for the metal and vinyl, and a dark haze that settles over
 * the far side of the cage and the platform, so they sink into the stands instead of cutting
 * against them. Lite devices skip the reflections: at 6 % they barely show, and baking them
 * blocks a slow CPU for close to half a second.
 */
export function applyVenueAtmosphere(renderer: THREE.WebGLRenderer, scene: THREE.Scene, { reflections }: { reflections: boolean }): () => void {
    let environment: THREE.WebGLRenderTarget | null = null;
    if (reflections) {
        const generator = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        environment = generator.fromScene(room, 0.04);
        room.dispose();
        generator.dispose();
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.06;
    }
    scene.background = new THREE.Color("#050608");
    scene.fog = new THREE.FogExp2("#0b0c10", 0.045);
    return () => {
        scene.environment = null;
        scene.background = null;
        scene.fog = null;
        environment?.dispose();
    };
}

function radialGlow(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.18, "rgba(255,255,255,0.85)");
        gradient.addColorStop(0.45, "rgba(255,255,255,0.18)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
