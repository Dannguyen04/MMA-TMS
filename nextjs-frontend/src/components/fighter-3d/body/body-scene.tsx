"use client";

import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { octagonShape } from "@/components/landing/stage/octagon";
import { radialTexture } from "@/components/landing/stage/textures";
import { graphicsTier } from "@/lib/graphics-tier";
import type { BodyRegion } from "@/lib/domain/types";
import type { BodyLook } from "./body-material";
import { BodyRig, type FigureBuild, type RigHighlight } from "./body-rig";
import { FEMALE_MODEL_URL, FEMALE_WIRE_URL, femaleModelFrom } from "./female-model";
import { createMannequinModel } from "./mannequin";
import { MUSCULAR_MODEL_URL, MUSCULAR_WIRE_URL, muscularModelFrom } from "./muscular-model";
import type { BodyModel, BodyModelKind } from "./regions";

/** A region lit on the body: colour resolved from the theme tokens, strength 0–1. */
export type SceneHighlight = RigHighlight;

export interface BodySceneProps {
    look: BodyLook;
    model: BodyModelKind;
    build: FigureBuild;
    highlights: SceneHighlight[];
    palette: { base: string; rim: string };
    /** Region the camera moves to; null frames the whole body. */
    focus: BodyRegion | null;
    hovered: BodyRegion | null;
    onHover: (region: BodyRegion | null) => void;
    onSelect: (region: BodyRegion | null) => void;
    /** Target turn in radians (0 = front, π = back); the viewer's drag and buttons write it. */
    yaw: RefObject<number>;
    /** Changing it replays the head-to-toe scan. */
    scanKey: number;
    /** Whole-body brightness, 1 = normal (used to show fatigue). */
    dim?: number;
    animate: boolean;
    /** Absolutely positioned label elements carrying data-region; the scene moves them every frame. */
    labels: RefObject<HTMLDivElement | null>;
    ariaLabel: string;
    compact?: boolean;
    /** Which model is on screen once it has loaded (the mannequin stands in if a model fails). */
    onModel?: (kind: BodyModelKind) => void;
    /** The scene puts its "draw a frame" function here, for the stage to call when it turns the body. */
    wakeRef?: RefObject<(() => void) | null>;
}

/**
 * The body on a transparent canvas: the figure stands straight on the page. Lite devices draw at
 * pixel ratio 1 without antialiasing, skip the far-side regions seen through the body, and never
 * breathe (see `lib/graphics-tier.ts`).
 */
export default function BodyScene(props: BodySceneProps) {
    const [lite] = useState(() => graphicsTier() === "lite");
    const figure = { ...props, lite };
    return (
        <Canvas
            role="img"
            aria-label={props.ariaLabel}
            dpr={lite ? 1 : [1, 1.6]}
            gl={{ antialias: !lite, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 28, near: 0.1, far: 40, position: [0, 1.0, props.compact ? 4.7 : 4.05] }}
            frameloop="demand"
            style={{ touchAction: "pan-y" }}
        >
            <Boundary fallback={<MannequinFigure {...figure} />}>
                <Suspense fallback={null}>
                    {props.model === "muscular" ? <MuscularFigure {...figure} /> : props.model === "female" ? <FemaleFigure {...figure} /> : <MannequinFigure {...figure} />}
                </Suspense>
            </Boundary>
            <Floor look={props.look} rim={props.palette.rim} />
        </Canvas>
    );
}

type FigureProps = BodySceneProps & { lite: boolean };

function MuscularFigure(props: FigureProps) {
    const gltf = useLoader(GLTFLoader, MUSCULAR_MODEL_URL);
    const [model] = useState(() => muscularModelFrom(gltf.scene));
    return <Figure {...props} body={model} wireUrl={MUSCULAR_WIRE_URL} />;
}

function FemaleFigure(props: FigureProps) {
    const gltf = useLoader(GLTFLoader, FEMALE_MODEL_URL);
    const [model] = useState(() => femaleModelFrom(gltf.scene));
    return <Figure {...props} body={model} wireUrl={FEMALE_WIRE_URL} />;
}

function MannequinFigure(props: FigureProps) {
    const [model] = useState(createMannequinModel);
    return <Figure {...props} body={model} />;
}

/** Shows `fallback` when a file cannot be fetched or parsed: the mannequin for a model, nothing for a wire. */
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function Figure({
    body,
    look,
    build,
    highlights,
    palette,
    focus,
    hovered,
    onHover,
    onSelect,
    yaw,
    scanKey,
    dim = 1,
    animate,
    labels,
    compact,
    onModel,
    wakeRef,
    lite,
    wireUrl,
}: FigureProps & { body: BodyModel; wireUrl?: string }) {
    const group = useRef<THREE.Group>(null);
    const mesh = useRef<THREE.Mesh>(null);
    const idleTimer = useRef<number | null>(null);
    const { invalidate, size } = useThree();
    const [rig] = useState(() => new BodyRig(body));

    useEffect(
        () => () => {
            rig.dispose();
            if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
        },
        [rig],
    );

    useEffect(() => {
        if (!wakeRef) return;
        wakeRef.current = invalidate;
        return () => {
            wakeRef.current = null;
        };
    }, [wakeRef, invalidate]);

    useEffect(() => {
        onModel?.(body.kind);
    }, [body.kind, onModel]);

    useEffect(() => {
        rig.setLook(look, palette.base, palette.rim);
        invalidate();
    }, [rig, look, palette.base, palette.rim, invalidate]);

    useEffect(() => {
        rig.setBuild(build);
        invalidate();
    }, [rig, build, invalidate]);

    useEffect(() => {
        rig.setHighlights(highlights);
        invalidate();
    }, [rig, highlights, invalidate]);

    useEffect(() => {
        rig.setFocus([hovered, focus]);
        invalidate();
    }, [rig, hovered, focus, invalidate]);

    useEffect(() => {
        rig.restartScan(animate);
        invalidate();
    }, [rig, scanKey, animate, invalidate]);

    // Rendered on demand: a frame is drawn only while the rig reports movement (and, under reduced
    // motion or off screen, only when something changes). Breathing alone runs at about 30 frames a
    // second: it is slow, and the page should not pay full rate for it.
    useFrame((state, delta) => {
        const g = group.current;
        if (!g) return;
        const { moving, idling } = rig.update(
            { time: state.clock.elapsedTime, delta: Math.min(delta, 0.1), yaw: yaw.current ?? 0, dim, animate, idle: animate && !lite, focus, distance: compact ? 4.7 : 4.05 },
            g,
            state.camera,
        );
        placeLabels(rig, labels.current, g, state.camera, size.width, size.height);
        if (!animate) return;
        if (moving) state.invalidate();
        else if (idling && idleTimer.current === null) {
            idleTimer.current = window.setTimeout(() => {
                idleTimer.current = null;
                state.invalidate();
            }, 33);
        }
    });

    const regionFromEvent = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
        const m = mesh.current;
        if (!m) return null;
        return rig.regionAt(m.worldToLocal(event.point.clone()));
    };

    const { depth, occluded, body: surface, wire } = rig.materials;
    return (
        <group ref={group}>
            {/* Depth only, then the far side's regions through the body, then the body (see body-material.ts). */}
            <mesh geometry={rig.geometry} material={depth} renderOrder={0} raycast={noRaycast} />
            {!lite && <mesh geometry={rig.geometry} material={occluded} renderOrder={1} raycast={noRaycast} />}
            <mesh
                ref={mesh}
                geometry={rig.geometry}
                material={surface}
                renderOrder={2}
                onPointerMove={(e) => {
                    e.stopPropagation();
                    onHover(regionFromEvent(e));
                }}
                onPointerOut={() => onHover(null)}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(regionFromEvent(e));
                }}
            />
            {wireUrl && look === "hologram" && (
                <Boundary fallback={null}>
                    <Suspense fallback={null}>
                        <Wire url={wireUrl} surface={rig.geometry} material={wire} onReady={invalidate} />
                    </Suspense>
                </Boundary>
            )}
        </group>
    );
}

/**
 * The wireframe over the body: the model's own vertices joined by the edges of a simplified copy (see
 * the model files). An enhancement: if the file cannot load the body shows without it.
 */
function Wire({ url, surface, material, onReady }: { url: string; surface: THREE.BufferGeometry; material: THREE.Material; onReady: () => void }) {
    const buffer = useLoader(THREE.FileLoader, url, (loader) => loader.setResponseType("arraybuffer")) as unknown as ArrayBuffer;
    const [geometry] = useState(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", surface.getAttribute("position"));
        g.setAttribute("normal", surface.getAttribute("normal"));
        g.setIndex(new THREE.Uint16BufferAttribute(new Uint16Array(buffer), 1));
        g.boundingSphere = surface.boundingSphere;
        return g;
    });
    useEffect(() => {
        onReady();
        return () => geometry.dispose();
    }, [geometry, onReady]);
    return <lineSegments geometry={geometry} material={material} renderOrder={3} raycast={noRaycast} />;
}

/** The depth, far-side and wire passes are not picked: the pointer hits the body mesh only. */
function noRaycast() {}

const scratch = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();

/** Pins each label to its region's anchor and fades it when that side of the body turns away. */
function placeLabels(rig: BodyRig, layer: HTMLDivElement | null, group: THREE.Group, camera: THREE.Camera, width: number, height: number) {
    if (!layer) return;
    normalMatrix.getNormalMatrix(group.matrixWorld);
    for (const el of Array.from(layer.children) as HTMLElement[]) {
        const anchor = rig.anchor(el.dataset.region as BodyRegion);
        if (!anchor) continue;
        scratch.copy(anchor.normal).multiplyScalar(anchor.radius * 0.35).add(anchor.center);
        group.localToWorld(scratch);
        scratchNormal.copy(anchor.normal).applyMatrix3(normalMatrix).normalize();
        toCamera.copy(camera.position).sub(scratch).normalize();
        const facing = scratchNormal.dot(toCamera);
        const screen = scratch.clone().project(camera);
        const x = (screen.x * 0.5 + 0.5) * width;
        const y = (-screen.y * 0.5 + 0.5) * height;
        const side = screen.x < 0 ? "left" : "right";
        if (el.dataset.side !== side) el.dataset.side = side;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        // A pin appears as the scan band reaches its region, and fades when that side turns away.
        el.style.opacity = String(THREE.MathUtils.smoothstep(facing, -0.25, 0.2) * rig.revealAt(anchor.center.y));
    }
}

/** A soft pool of the rim colour and, for the hologram, the octagon marked on the floor. */
function Floor({ look, rim }: { look: BodyLook; rim: string }) {
    const shadow = useMemo(() => radialTexture(look === "hologram" ? "rgba(77, 148, 236, 0.45)" : "rgba(14, 26, 43, 0.3)"), [look]);
    const outline = useMemo(() => {
        const points = octagonShape(0.78).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);
    const inner = useMemo(() => {
        const points = octagonShape(0.6).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);
    useEffect(
        () => () => {
            shadow.dispose();
            outline.dispose();
            inner.dispose();
        },
        [shadow, outline, inner],
    );

    return (
        <group>
            {/* Drawn before the body (render order −1) so the glow shows through the see-through figure. */}
            <mesh rotation-x={-Math.PI / 2} position-y={0.001} scale={look === "hologram" ? 1.9 : 0.95} renderOrder={-1}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            {look === "hologram" && (
                <>
                    <lineLoop geometry={outline} renderOrder={-1}>
                        <lineBasicMaterial color={rim} transparent opacity={0.7} toneMapped={false} />
                    </lineLoop>
                    <lineLoop geometry={inner} renderOrder={-1}>
                        <lineBasicMaterial color={rim} transparent opacity={0.25} toneMapped={false} />
                    </lineLoop>
                </>
            )}
        </group>
    );
}
