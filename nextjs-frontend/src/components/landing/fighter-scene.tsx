"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, type MutableRefObject } from "react";
import * as THREE from "three";

import type { FighterController, PointerPosition } from "./fighter-motion";
import { ImpactEffects } from "./impact-effects";

interface FighterSceneProps {
    controller: FighterController;
    pointer: MutableRefObject<PointerPosition>;
    reducedMotion: boolean;
}

function CameraRig({ pointer, reducedMotion }: Pick<FighterSceneProps, "pointer" | "reducedMotion">) {
    const { camera } = useThree();
    const target = new THREE.Vector3();

    useFrame((_, delta) => {
        if (reducedMotion) return;
        target.set(pointer.current.x * 0.22, pointer.current.y * 0.12 + 0.1, 10.15);
        camera.position.lerp(target, 1 - Math.exp(-delta * 2.6));
        camera.lookAt(0, 0, 0);
    });

    return null;
}

export function FighterScene({ controller, pointer, reducedMotion }: FighterSceneProps) {
    return (
        <Canvas
            aria-hidden
            className="relative z-10"
            camera={{ position: [0, 0.1, 10.15], fov: 34, near: 0.1, far: 40 }}
            dpr={[1, 1.5]}
            fallback={null}
            frameloop={reducedMotion ? "demand" : "always"}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        >
            <Suspense fallback={null}>
                <ImpactEffects controller={controller} reducedMotion={reducedMotion} />
                <CameraRig pointer={pointer} reducedMotion={reducedMotion} />
            </Suspense>
        </Canvas>
    );
}
