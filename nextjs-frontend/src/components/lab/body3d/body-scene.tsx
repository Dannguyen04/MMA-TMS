"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { octagonShape } from "@/components/landing/stage/octagon";
import { radialTexture } from "@/components/landing/stage/textures";
import type { BodyRegion } from "@/lib/domain/types";
import { REGION_ANCHOR, regionAt } from "./anatomy";
import type { BodyLook } from "./body-material";
import { BodyRig, type RigHighlight } from "./body-rig";

/** A region lit on the body: colour resolved from the theme tokens, strength 0–1. */
export type SceneHighlight = RigHighlight;

export interface BodySceneProps {
    look: BodyLook;
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
}

export default function BodyScene(props: BodySceneProps) {
    return (
        <Canvas
            aria-label={props.ariaLabel}
            dpr={[1, 1.6]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 28, near: 0.1, far: 40, position: [0, 1.0, props.compact ? 5.3 : 4.05] }}
            frameloop={props.animate ? "always" : "demand"}
            style={{ touchAction: "pan-y" }}
        >
            <Mannequin {...props} />
        </Canvas>
    );
}

function Mannequin({ look, highlights, palette, focus, hovered, onHover, onSelect, yaw, scanKey, dim = 1, animate, labels, compact }: BodySceneProps) {
    const group = useRef<THREE.Group>(null);
    const mesh = useRef<THREE.Mesh>(null);
    const { invalidate, size } = useThree();
    const [rig] = useState(() => new BodyRig());

    useEffect(() => () => rig.dispose(), [rig]);

    useEffect(() => {
        rig.setLook(look, palette.base, palette.rim);
        invalidate();
    }, [rig, look, palette.base, palette.rim, invalidate]);

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
        rig.update(
            { time: state.clock.elapsedTime, delta, yaw: yaw.current ?? 0, dim, animate, focus, distance: compact ? 5.3 : 4.05 },
            g,
            state.camera,
        );
        placeLabels(labels.current, g, state.camera, size.width, size.height);
    });

    const regionFromEvent = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
        const m = mesh.current;
        if (!m) return null;
        return regionAt(m.worldToLocal(event.point.clone()));
    };

    return (
        <>
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
            <Floor look={look} rim={palette.rim} />
        </>
    );
}

const scratch = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();
const toCamera = new THREE.Vector3();

/** Pins each label to its region's anchor and fades it when that side of the body turns away. */
function placeLabels(layer: HTMLDivElement | null, group: THREE.Group, camera: THREE.Camera, width: number, height: number) {
    if (!layer) return;
    for (const el of Array.from(layer.children) as HTMLElement[]) {
        const anchor = REGION_ANCHOR.get(el.dataset.region as BodyRegion);
        if (!anchor) continue;
        scratch.copy(anchor.normal).multiplyScalar(anchor.radius * 0.35).add(anchor.center);
        group.localToWorld(scratch);
        scratchNormal.copy(anchor.normal).applyQuaternion(group.quaternion);
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

function Floor({ look, rim }: { look: BodyLook; rim: string }) {
    const shadow = useMemo(() => radialTexture(look === "hologram" ? "rgba(77, 148, 236, 0.55)" : "rgba(14, 26, 43, 0.38)"), [look]);
    const outline = useMemo(() => {
        const points = octagonShape(0.78).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);
    const inner = useMemo(() => {
        const points = octagonShape(0.6).getPoints().map((p) => new THREE.Vector3(p.x, 0.002, p.y));
        return new THREE.BufferGeometry().setFromPoints(points);
    }, []);
    useEffect(() => () => {
        shadow.dispose();
        outline.dispose();
        inner.dispose();
    }, [shadow, outline, inner]);

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
