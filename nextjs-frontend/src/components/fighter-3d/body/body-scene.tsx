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
import { createMannequinModel } from "./mannequin";
import { MUSCULAR_MODEL_URL, muscularModelFrom } from "./muscular-model";
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
    /** Which model is on screen once it has loaded (the mannequin stands in if the scan fails). */
    onModel?: (kind: BodyModelKind) => void;
}

/**
 * The body on a transparent canvas: the figure stands straight on the page. Lite devices draw at
 * pixel ratio 1 without antialiasing (see `lib/graphics-tier.ts`).
 */
export default function BodyScene(props: BodySceneProps) {
    const [lite] = useState(() => graphicsTier() === "lite");
    return (
        <Canvas
            aria-label={props.ariaLabel}
            dpr={lite ? 1 : [1, 1.6]}
            gl={{ antialias: !lite, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 28, near: 0.1, far: 40, position: [0, 1.0, props.compact ? 5.3 : 4.05] }}
            frameloop={props.animate ? "always" : "demand"}
            style={{ touchAction: "pan-y" }}
        >
            <ModelBoundary fallback={<MannequinFigure {...props} />}>
                <Suspense fallback={null}>{props.model === "muscular" ? <MuscularFigure {...props} /> : <MannequinFigure {...props} />}</Suspense>
            </ModelBoundary>
            <Floor look={props.look} rim={props.palette.rim} />
        </Canvas>
    );
}

function MuscularFigure(props: BodySceneProps) {
    const gltf = useLoader(GLTFLoader, MUSCULAR_MODEL_URL);
    const [model] = useState(() => muscularModelFrom(gltf.scene));
    return <Figure {...props} body={model} />;
}

function MannequinFigure(props: BodySceneProps) {
    const [model] = useState(createMannequinModel);
    return <Figure {...props} body={model} />;
}

/** Shows the mannequin when the scanned model cannot be fetched or parsed. */
class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
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
}: BodySceneProps & { body: BodyModel }) {
    const group = useRef<THREE.Group>(null);
    const mesh = useRef<THREE.Mesh>(null);
    const { invalidate, size } = useThree();
    const [rig] = useState(() => new BodyRig(body));

    useEffect(() => () => rig.dispose(), [rig]);

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

    useFrame((state, delta) => {
        const g = group.current;
        if (!g) return;
        rig.update({ time: state.clock.elapsedTime, delta, yaw: yaw.current ?? 0, dim, animate, focus, distance: compact ? 5.3 : 4.05 }, g, state.camera);
        placeLabels(rig, labels.current, g, state.camera, size.width, size.height);
    });

    const regionFromEvent = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
        const m = mesh.current;
        if (!m) return null;
        return rig.regionAt(m.worldToLocal(event.point.clone()));
    };

    return (
        <group ref={group}>
            <mesh
                ref={mesh}
                geometry={rig.geometry}
                material={rig.material}
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
        </group>
    );
}

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
        el.style.opacity = String(THREE.MathUtils.smoothstep(facing, -0.25, 0.2));
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
            <mesh rotation-x={-Math.PI / 2} position-y={0.001} scale={look === "hologram" ? 1.9 : 0.95}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            {look === "hologram" && (
                <>
                    <lineLoop geometry={outline}>
                        <lineBasicMaterial color={rim} transparent opacity={0.7} toneMapped={false} />
                    </lineLoop>
                    <lineLoop geometry={inner}>
                        <lineBasicMaterial color={rim} transparent opacity={0.25} toneMapped={false} />
                    </lineLoop>
                </>
            )}
        </group>
    );
}
