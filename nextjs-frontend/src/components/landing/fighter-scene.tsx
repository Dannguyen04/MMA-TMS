"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { useT } from "@/components/i18n/locale-provider";
import { ARENA_PLATE } from "./arena-plate";
import { FIGHTER_IMAGE } from "./pose-skeleton";
import { stageAt, type StoryState } from "./story";
import { MAT_TEXTURE } from "./stage/mat";
import { applyVenueAtmosphere, createComposer, createWorld, PHOTO_BITMAP_OPTIONS, stagePhotoTexture, type LabelRegistry } from "./stage/world";

export interface FighterSceneProps {
    story: RefObject<StoryState>;
    labels: RefObject<LabelRegistry>;
    compact: boolean;
    /** Weak device: pixel ratio 1, no bloom or multisampling, a coarser mesh (see `lib/graphics-tier.ts`). */
    lite: boolean;
    /** False stops rendering (reduced motion renders once, on demand). */
    animate: boolean;
    onReady: () => void;
}

/** The fixed WebGL stage: the fighter in the octagon and every chapter effect, driven by the scroll story. */
export default function FighterScene({ story, labels, compact, lite, animate, onReady }: FighterSceneProps) {
    const t = useT();
    return (
        <Canvas
            aria-label={t("landing.stage.canvasAria")}
            dpr={lite ? 1 : [1, compact ? 1.35 : 1.75]}
            gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
            camera={{ fov: 30, near: 0.1, far: 90, position: [0, 2, 12] }}
            frameloop={animate ? "always" : "demand"}
            onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
            }}
        >
            <Suspense fallback={null}>
                <Stage story={story} labels={labels} compact={compact} lite={lite} animate={animate} onReady={onReady} />
            </Suspense>
        </Canvas>
    );
}

function Stage({ story, labels, compact, lite, animate, onReady }: FighterSceneProps) {
    const bitmaps = useLoader(THREE.ImageBitmapLoader, [FIGHTER_IMAGE.url, ARENA_PLATE.url, MAT_TEXTURE], (loader) => loader.setOptions(PHOTO_BITMAP_OPTIONS));
    const [photos] = useState(() => bitmaps.map(stagePhotoTexture));
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const size = useThree((state) => state.size);
    const dpr = useThree((state) => state.viewport.dpr);
    const [world] = useState(() => createWorld({ fighter: photos[0], plate: photos[1], canvas: photos[2] }, { compact, animate, lite }));
    const [composer] = useState(() => createComposer(gl, scene, camera, { lite }));

    useEffect(() => () => world.dispose(), [world]);
    useEffect(() => () => composer.dispose(), [composer]);
    // The bitmaps stay in the loader cache for the next visit; only their textures are freed.
    useEffect(() => () => photos.forEach((texture) => texture.dispose()), [photos]);
    useEffect(() => applyVenueAtmosphere(gl, scene, { reflections: !lite }), [gl, scene, lite]);
    useEffect(() => {
        composer.setSize(size.width, size.height, dpr);
        world.setResolution(size.width, size.height);
    }, [composer, world, size, dpr]);
    // Compile every shader up front so the first scroll into a chapter never hitches, in parallel where
    // the driver allows so the page keeps moving. Nothing is drawn until then: drawing would force the
    // same compile synchronously.
    const compiled = useRef(false);
    useEffect(() => {
        let current = true;
        composer
            .compile()
            .catch(() => undefined)
            .then(() => {
                if (!current) return;
                compiled.current = true;
                onReady();
            });
        return () => {
            current = false;
        };
    }, [composer, onReady]);

    // Adaptive quality: if frames stay slow, drop the bloom first, then the pixel ratio. Lite starts without bloom.
    const pacing = useRef({ average: 1 / 60, settledAt: 3, level: lite ? 1 : 0 });

    // Priority 1 hands rendering to the bloom composer instead of R3F's default render.
    useFrame((state, delta) => {
        if (!compiled.current) return;
        const time = state.clock.elapsedTime;
        world.update(stageAt(story.current), state.camera as THREE.PerspectiveCamera, time, Math.min(delta, 1 / 20), state.size, labels.current);
        composer.render(time, delta);

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
