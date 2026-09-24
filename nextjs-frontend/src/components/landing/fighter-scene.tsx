"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, type MutableRefObject } from "react";
import * as THREE from "three";

import type { FighterController, PointerPosition } from "./fighter-motion";
import { ImpactEffects } from "./impact-effects";
import { ProceduralFighter } from "./procedural-fighter";

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
                <ambientLight intensity={1.15} color="#9cb5da" />
                <directionalLight position={[-4, 6, 5]} intensity={3.6} color="#ffe0c9" />
                <pointLight position={[4, 1, 3]} intensity={10} distance={9} color="#e83a48" />
                <pointLight position={[-4, 0, 2]} intensity={11} distance={8} color="#3388ff" />
                <ProceduralFighter controller={controller} pointer={pointer} reducedMotion={reducedMotion} />
                <ImpactEffects controller={controller} reducedMotion={reducedMotion} />
                <CameraRig pointer={pointer} reducedMotion={reducedMotion} />
            </Suspense>
        </Canvas>
    );
}
