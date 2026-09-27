import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { FIGHTER_IMAGE, KEYPOINTS, LEFT_KNEE } from "../pose-skeleton";
import type { StageFrame } from "../story";
import { createArena } from "./arena";
import { createFighterMaterial } from "./fighter-material";
import { createRelief } from "./relief";
import { createSkeletonOverlay } from "./skeleton";
import { createTechniqueBars } from "./technique-bars";

/** HTML labels pinned to points on the stage, positioned by the scene every frame. */
export type LabelId = "knee" | "focus" | `bar-${number}`;
export type LabelRegistry = Map<LabelId, HTMLElement>;

/** How far the relief bulges toward the camera at its thickest, in metres. */
const RELIEF_DEPTH = 0.1;

export interface World {
    object: THREE.Group;
    update(frame: StageFrame, camera: THREE.PerspectiveCamera, time: number, delta: number, size: { width: number; height: number }, labels: LabelRegistry): void;
    setResolution(width: number, height: number): void;
    dispose(): void;
}

export function createWorld(photo: THREE.Texture, { compact, animate }: { compact: boolean; animate: boolean }): World {
    const object = new THREE.Group();
    const glow = radialGlow();

    // The fighter: the cutout on a finely divided plane, feet on the mat, bulged into a relief.
    const { width, height, centerX, feetY, metresPerPixel } = FIGHTER_IMAGE;
    const planeWidth = width * metresPerPixel;
    const planeHeight = height * metresPerPixel;
    const relief = createRelief(photo.image as HTMLImageElement);
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = 8;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 144, 216);
    geometry.translate((width / 2 - centerX) * metresPerPixel, planeHeight / 2 - (height - feetY) * metresPerPixel, 0);
    const { material, uniforms } = createFighterMaterial(photo, relief, RELIEF_DEPTH);
    const body = new THREE.Mesh(geometry, material);
    body.frustumCulled = false;

    const depthAt = (x: number, y: number) => {
        const u = (x / metresPerPixel + centerX) / width;
        const v = 1 - (feetY - y / metresPerPixel) / height;
        return relief.sample(u, v) * RELIEF_DEPTH;
    };
    const fighter = new THREE.Group();
    const skeleton = createSkeletonOverlay(glow, depthAt);
    fighter.add(body, skeleton.object);

    const arena = createArena({ dust: compact ? 110 : 240, crowd: compact ? 900 : 2400 });
    const bars = createTechniqueBars(glow);
    object.add(arena.object, fighter, bars.object);

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
            // A cutout has no back: he keeps turning to face the camera as it orbits.
            fighter.rotation.y = frame.camera.facing;
            // Light on his toes: a small bounce and breath in his guard.
            fighter.position.y = animate ? Math.abs(Math.sin(time * 1.9)) * 0.012 : 0;
            fighter.scale.y = animate ? 1 + Math.sin(time * 1.3) * 0.0035 : 1;
            fighter.updateMatrixWorld();

            uniforms.uTime.value = time;
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
            arena.dispose();
            skeleton.dispose();
            bars.dispose();
            relief.dispose();
            geometry.dispose();
            material.dispose();
            glow.dispose();
        },
    };
}

/** Bloom on bright emissive details only (scan line, keypoints, LED strips, lenses, beams). */
export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    // Multisampled so the cutout's alpha-to-coverage edges stay smooth.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.4, 0.9);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return {
        composer,
        setBloom(enabled: boolean) {
            bloom.enabled = enabled;
        },
        setSize(width: number, height: number, pixelRatio: number) {
            composer.setPixelRatio(pixelRatio);
            // The bloom pass already works at half the drawing-buffer size.
            composer.setSize(width, height);
        },
        dispose() {
            composer.dispose();
            bloom.dispose();
            target.dispose();
        },
    };
}

/** Soft reflections for the metal truss and a dark, even background colour behind the backdrop. */
export function applyStudioEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.18;
    scene.background = new THREE.Color("#050608");
    return () => {
        scene.environment = null;
        scene.background = null;
        environment.dispose();
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
