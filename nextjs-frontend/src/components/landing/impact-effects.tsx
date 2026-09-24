"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { poseForAction, type FighterController } from "./fighter-motion";

export function ImpactEffects({ controller, reducedMotion }: { controller: FighterController; reducedMotion: boolean }) {
    const group = useRef<THREE.Group>(null);
    const particles = useMemo(
        () => Array.from({ length: 16 }, (_, index) => {
            const angle = (index / 16) * Math.PI * 2;
            return { x: Math.cos(angle), y: Math.sin(angle), scale: 0.45 + (index % 4) * 0.12 };
        }),
        [],
    );

    useFrame((state) => {
        if (!group.current || reducedMotion) return;
        const sample = controller.sample(performance.now());
        const pose = poseForAction(sample.action, sample.progress, state.clock.elapsedTime, { x: 0, y: 0 });
        group.current.visible = pose.impact > 0.015;
        group.current.scale.setScalar(0.65 + pose.impact * 1.15);
        group.current.rotation.z += 0.015;
        group.current.position.x = sample.action === "hook-left" ? -1.45 : sample.action === "hook-right" ? 1.6 : 0.65;
        group.current.position.y = sample.action === "uppercut" ? 1.45 : 0.7;
    });

    return (
        <group ref={group} position={[0.65, 0.7, 0.5]} visible={false}>
            <mesh>
                <torusGeometry args={[0.72, 0.025, 6, 36]} />
                <meshBasicMaterial color="#f7f9ff" transparent opacity={0.65} toneMapped={false} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 8]}>
                <torusGeometry args={[0.5, 0.018, 6, 28]} />
                <meshBasicMaterial color="#e93645" transparent opacity={0.8} toneMapped={false} />
            </mesh>
            {particles.map((particle, index) => (
                <mesh key={index} position={[particle.x, particle.y, 0]} scale={[0.035, particle.scale, 0.035]} rotation={[0, 0, -Math.atan2(particle.x, particle.y)]}>
                    <boxGeometry />
                    <meshBasicMaterial color={index % 2 ? "#e93645" : "#3688ff"} transparent opacity={0.78} toneMapped={false} />
                </mesh>
            ))}
        </group>
    );
}
