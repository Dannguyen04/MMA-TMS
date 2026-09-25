"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { FIGHTER_IMAGE } from "./pose-skeleton";
import { stageAt, type StoryState } from "./story";
import { applyStudioEnvironment, createComposer, createWorld, type LabelRegistry } from "./stage/world";

export interface FighterSceneProps {
    story: RefObject<StoryState>;
    labels: RefObject<LabelRegistry>;
    compact: boolean;
    /** False stops rendering (reduced motion renders once, on demand). */
    animate: boolean;
    onReady: () => void;
}

/** The fixed WebGL stage: the fighter in the octagon and every chapter effect, driven by the scroll story. */
export default function FighterScene({ story, labels, compact, animate, onReady }: FighterSceneProps) {
    return (
        <Canvas
            dpr={[1, compact ? 1.35 : 1.75]}
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
            camera={{ fov: 30, near: 0.1, far: 90, position: [0, 2, 12] }}
            frameloop={animate ? "always" : "demand"}
            onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
            }}
        >
            <Suspense fallback={null}>
                <Stage story={story} labels={labels} compact={compact} animate={animate} onReady={onReady} />
            </Suspense>
        </Canvas>
    );
}

function Stage({ story, labels, compact, animate, onReady }: FighterSceneProps) {
    const photo = useLoader(THREE.TextureLoader, FIGHTER_IMAGE.url);
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const size = useThree((state) => state.size);
    const dpr = useThree((state) => state.viewport.dpr);
    const [world] = useState(() => createWorld(photo, { compact, animate }));
    const [composer] = useState(() => createComposer(gl, scene, camera));

    useEffect(() => () => world.dispose(), [world]);
    useEffect(() => () => composer.dispose(), [composer]);
    useEffect(() => applyStudioEnvironment(gl, scene), [gl, scene]);
    useEffect(() => {
        composer.setSize(size.width, size.height, dpr);
        world.setResolution(size.width, size.height);
    }, [composer, world, size, dpr]);
    useEffect(() => {
        // Compile every shader up front so the first scroll into a chapter never hitches.
        gl.compile(scene, camera);
        onReady();
    }, [gl, scene, camera, onReady]);

    // Adaptive quality: if frames stay slow, drop the bloom first, then the pixel ratio.
    const pacing = useRef({ average: 1 / 60, settledAt: 3, level: 0 });

    // Priority 1 hands rendering to the bloom composer instead of R3F's default render.
    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        world.update(stageAt(story.current), state.camera as THREE.PerspectiveCamera, time, Math.min(delta, 1 / 20), state.size, labels.current);
        composer.composer.render(delta);

        // Long single frames (tab switches, shader compiles, GC) say nothing about sustained speed.
        const quality = pacing.current;
        if (delta < 0.2) quality.average += (delta - quality.average) * 0.04;
        if (quality.level < 2 && quality.average > 1 / 28 && time - quality.settledAt > 2) {
            quality.level += 1;
            quality.settledAt = time;
            if (quality.level === 1) composer.setBloom(false);
            else state.setDpr(Math.max(0.6, state.viewport.dpr * 0.65));
        }
    }, 1);

    return <primitive object={world.object} />;
}
