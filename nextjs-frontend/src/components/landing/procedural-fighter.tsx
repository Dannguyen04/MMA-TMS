"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

import { poseForAction, type FighterController, type PointerPosition } from "./fighter-motion";

interface ProceduralFighterProps {
    controller: FighterController;
    pointer: MutableRefObject<PointerPosition>;
    reducedMotion: boolean;
}

interface FighterRig {
    root: THREE.Group;
    torso: THREE.Group;
    head: THREE.Group;
    leftShoulder: THREE.Group;
    rightShoulder: THREE.Group;
    leftElbow: THREE.Group;
    rightElbow: THREE.Group;
    leftHip: THREE.Group;
    rightHip: THREE.Group;
    leftKnee: THREE.Group;
    rightKnee: THREE.Group;
}

const damp = (from: number, to: number, delta: number) => THREE.MathUtils.damp(from, to, 13, delta);

function dampRotation(group: THREE.Group, rotation: [number, number, number], delta: number) {
    group.rotation.set(damp(group.rotation.x, rotation[0], delta), damp(group.rotation.y, rotation[1], delta), damp(group.rotation.z, rotation[2], delta));
}

export function ProceduralFighter({ controller, pointer, reducedMotion }: ProceduralFighterProps) {
    const root = useRef<THREE.Group>(null);
    const torso = useRef<THREE.Group>(null);
    const head = useRef<THREE.Group>(null);
    const leftShoulder = useRef<THREE.Group>(null);
    const rightShoulder = useRef<THREE.Group>(null);
    const leftElbow = useRef<THREE.Group>(null);
    const rightElbow = useRef<THREE.Group>(null);
    const leftHip = useRef<THREE.Group>(null);
    const rightHip = useRef<THREE.Group>(null);
    const leftKnee = useRef<THREE.Group>(null);
    const rightKnee = useRef<THREE.Group>(null);
    const rig = useRef<FighterRig | null>(null);

    const assets = useMemo(() => {
        const skin = new THREE.MeshStandardMaterial({ color: "#7f4b38", roughness: 0.64, metalness: 0.02 });
        const skinLight = new THREE.MeshStandardMaterial({ color: "#a96448", roughness: 0.58, metalness: 0.02 });
        const graphite = new THREE.MeshStandardMaterial({ color: "#11151b", roughness: 0.7, metalness: 0.18 });
        const black = new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.48, metalness: 0.25 });
        const red = new THREE.MeshStandardMaterial({ color: "#df3444", roughness: 0.42, metalness: 0.24, emissive: "#4a0710", emissiveIntensity: 0.5 });
        const blue = new THREE.MeshStandardMaterial({ color: "#2f7de1", roughness: 0.42, metalness: 0.24, emissive: "#071d4a", emissiveIntensity: 0.45 });
        return {
            geometry: {
                limb: new THREE.CapsuleGeometry(0.22, 0.72, 6, 10),
                forearm: new THREE.CapsuleGeometry(0.19, 0.62, 6, 10),
                thigh: new THREE.CapsuleGeometry(0.29, 0.88, 6, 10),
                shin: new THREE.CapsuleGeometry(0.23, 0.82, 6, 10),
                fist: new THREE.SphereGeometry(0.3, 16, 12),
                joint: new THREE.SphereGeometry(0.23, 14, 10),
                head: new THREE.SphereGeometry(0.48, 20, 16),
                chest: new THREE.SphereGeometry(0.82, 24, 18),
                foot: new THREE.BoxGeometry(0.42, 0.22, 0.82),
                accent: new THREE.BoxGeometry(0.11, 0.72, 0.05),
                ground: new THREE.CircleGeometry(2.1, 32),
            },
            material: { skin, skinLight, graphite, black, red, blue },
        };
    }, []);

    useEffect(
        () => () => {
            Object.values(assets.geometry).forEach((geometry) => geometry.dispose());
            Object.values(assets.material).forEach((material) => material.dispose());
        },
        [assets],
    );

    useEffect(() => {
        if (
            root.current && torso.current && head.current && leftShoulder.current && rightShoulder.current && leftElbow.current && rightElbow.current &&
            leftHip.current && rightHip.current && leftKnee.current && rightKnee.current
        ) {
            rig.current = {
                root: root.current,
                torso: torso.current,
                head: head.current,
                leftShoulder: leftShoulder.current,
                rightShoulder: rightShoulder.current,
                leftElbow: leftElbow.current,
                rightElbow: rightElbow.current,
                leftHip: leftHip.current,
                rightHip: rightHip.current,
                leftKnee: leftKnee.current,
                rightKnee: rightKnee.current,
            };
        }
    }, []);

    useFrame((state, delta) => {
        if (!rig.current || reducedMotion) return;
        const sample = controller.sample(performance.now());
        const pose = poseForAction(sample.action, sample.progress, state.clock.elapsedTime, pointer.current);
        rig.current.root.position.y = damp(rig.current.root.position.y, -2.85 + pose.rootY, delta);
        rig.current.root.rotation.y = damp(rig.current.root.rotation.y, pose.rootYaw, delta);
        rig.current.torso.rotation.x = damp(rig.current.torso.rotation.x, pose.torsoPitch, delta);
        rig.current.torso.rotation.y = damp(rig.current.torso.rotation.y, pose.torsoYaw, delta);
        rig.current.head.rotation.y = damp(rig.current.head.rotation.y, pose.headYaw, delta);
        dampRotation(rig.current.leftShoulder, pose.leftShoulder, delta);
        dampRotation(rig.current.rightShoulder, pose.rightShoulder, delta);
        rig.current.leftElbow.rotation.x = damp(rig.current.leftElbow.rotation.x, pose.leftElbow, delta);
        rig.current.rightElbow.rotation.x = damp(rig.current.rightElbow.rotation.x, pose.rightElbow, delta);
        dampRotation(rig.current.leftHip, pose.leftHip, delta);
        dampRotation(rig.current.rightHip, pose.rightHip, delta);
        rig.current.leftKnee.rotation.x = damp(rig.current.leftKnee.rotation.x, pose.leftKnee, delta);
        rig.current.rightKnee.rotation.x = damp(rig.current.rightKnee.rotation.x, pose.rightKnee, delta);
    });

    const { geometry, material } = assets;

    return (
        <group ref={root} position={[0.42, -2.85, 0]} rotation={[0, -0.16, 0]} dispose={null}>
            <mesh geometry={geometry.ground} position={[0, 0.015, 0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.3, 0.48, 1]}>
                <meshBasicMaterial color="#0b0d12" transparent opacity={0.78} />
            </mesh>
            <group ref={torso}>
                <mesh geometry={geometry.chest} material={material.skin} position={[0, 3.76, 0]} scale={[0.92, 0.93, 0.52]} />
                <mesh geometry={geometry.chest} material={material.skinLight} position={[0, 3.25, 0]} scale={[0.62, 0.72, 0.43]} />
                <mesh geometry={geometry.chest} material={material.skinLight} position={[-0.36, 3.94, 0.38]} scale={[0.48, 0.27, 0.2]} rotation={[0, 0.12, -0.05]} />
                <mesh geometry={geometry.chest} material={material.skinLight} position={[0.36, 3.94, 0.38]} scale={[0.48, 0.27, 0.2]} rotation={[0, -0.12, 0.05]} />
                {[-0.3, 0, 0.3].map((offset, index) => (
                    <group key={offset} position={[0, 3.25 + offset, 0.38]}>
                        <mesh geometry={geometry.joint} material={material.skinLight} position={[-0.2, 0, 0]} scale={[0.66, index === 1 ? 0.52 : 0.62, 0.34]} />
                        <mesh geometry={geometry.joint} material={material.skinLight} position={[0.2, 0, 0]} scale={[0.66, index === 1 ? 0.52 : 0.62, 0.34]} />
                    </group>
                ))}
                <mesh geometry={geometry.chest} material={material.graphite} position={[0, 2.58, 0]} scale={[0.97, 0.48, 0.56]} />
                <mesh geometry={geometry.chest} material={material.black} position={[0, 2.9, 0]} scale={[0.99, 0.16, 0.58]} />
                <mesh geometry={geometry.accent} material={material.red} position={[-0.5, 2.54, 0.4]} rotation={[0, 0, -0.35]} scale={[1, 0.9, 1]} />
                <mesh geometry={geometry.accent} material={material.blue} position={[0.5, 2.54, 0.4]} rotation={[0, 0, 0.35]} scale={[1, 0.9, 1]} />
                <mesh geometry={geometry.forearm} material={material.skin} position={[0, 4.52, 0]} scale={[0.72, 0.42, 0.72]} />

                <group ref={head} position={[0, 5.02, 0]}>
                    <mesh geometry={geometry.head} material={material.skinLight} scale={[0.88, 1.08, 0.9]} />
                    <mesh geometry={geometry.joint} material={material.skin} position={[-0.46, 0, 0]} scale={[0.45, 0.68, 0.25]} />
                    <mesh geometry={geometry.joint} material={material.skin} position={[0.46, 0, 0]} scale={[0.45, 0.68, 0.25]} />
                    <mesh geometry={geometry.joint} material={material.skinLight} position={[0, 0.01, 0.46]} scale={[0.33, 0.75, 0.48]} />
                    <mesh geometry={geometry.joint} material={material.black} position={[-0.18, 0.12, 0.44]} scale={[0.3, 0.11, 0.1]} />
                    <mesh geometry={geometry.joint} material={material.black} position={[0.18, 0.12, 0.44]} scale={[0.3, 0.11, 0.1]} />
                    <mesh geometry={geometry.accent} material={material.black} position={[0, -0.21, 0.46]} rotation={[0, 0, Math.PI / 2]} scale={[0.28, 0.22, 1]} />
                    <mesh geometry={geometry.head} material={material.black} position={[0, 0.33, -0.02]} scale={[0.95, 0.48, 0.95]} />
                    <mesh geometry={geometry.accent} material={material.black} position={[-0.19, 0.37, 0.4]} rotation={[0.2, 0.1, -0.45]} scale={[1.8, 0.6, 1]} />
                    <mesh geometry={geometry.accent} material={material.black} position={[0.16, 0.4, 0.41]} rotation={[0.2, -0.1, 0.32]} scale={[1.5, 0.7, 1]} />
                </group>

                <group ref={leftShoulder} position={[-0.92, 4.15, 0]} rotation={[-0.78, -0.12, -0.42]}>
                    <mesh geometry={geometry.joint} material={material.skin} />
                    <mesh geometry={geometry.limb} material={material.skin} position={[0, -0.52, 0]} />
                    <group ref={leftElbow} position={[0, -1.02, 0]} rotation={[-1.72, 0, 0]}>
                        <mesh geometry={geometry.joint} material={material.skin} scale={0.85} />
                        <mesh geometry={geometry.forearm} material={material.skinLight} position={[0, -0.45, 0]} />
                        <mesh geometry={geometry.fist} material={material.black} position={[0, -0.94, 0]} scale={[1.05, 1.1, 0.9]} />
                        <mesh geometry={geometry.accent} material={material.blue} position={[0, -0.75, 0.2]} rotation={[0, 0, Math.PI / 2]} scale={[1.5, 0.34, 1]} />
                    </group>
                </group>

                <group ref={rightShoulder} position={[0.92, 4.15, 0]} rotation={[-0.82, 0.1, 0.46]}>
                    <mesh geometry={geometry.joint} material={material.skin} />
                    <mesh geometry={geometry.limb} material={material.skin} position={[0, -0.52, 0]} />
                    <group ref={rightElbow} position={[0, -1.02, 0]} rotation={[1.68, 0, 0]}>
                        <mesh geometry={geometry.joint} material={material.skin} scale={0.85} />
                        <mesh geometry={geometry.forearm} material={material.skinLight} position={[0, -0.45, 0]} />
                        <mesh geometry={geometry.fist} material={material.black} position={[0, -0.94, 0]} scale={[1.05, 1.1, 0.9]} />
                        <mesh geometry={geometry.accent} material={material.red} position={[0, -0.75, 0.2]} rotation={[0, 0, Math.PI / 2]} scale={[1.5, 0.34, 1]} />
                    </group>
                </group>
            </group>

            <group ref={leftHip} position={[-0.43, 2.42, 0]} rotation={[0.05, 0.08, -0.07]}>
                <mesh geometry={geometry.thigh} material={material.skin} position={[0, -0.62, 0]} />
                <group ref={leftKnee} position={[0, -1.24, 0]} rotation={[0.16, 0, 0]}>
                    <mesh geometry={geometry.joint} material={material.skin} />
                    <mesh geometry={geometry.shin} material={material.skinLight} position={[0, -0.58, 0]} />
                    <mesh geometry={geometry.foot} material={material.skinLight} position={[0, -1.12, 0.2]} />
                </group>
            </group>
            <group ref={rightHip} position={[0.43, 2.42, 0]} rotation={[-0.08, -0.08, 0.07]}>
                <mesh geometry={geometry.thigh} material={material.skin} position={[0, -0.62, 0]} />
                <group ref={rightKnee} position={[0, -1.24, 0]} rotation={[0.24, 0, 0]}>
                    <mesh geometry={geometry.joint} material={material.skin} />
                    <mesh geometry={geometry.shin} material={material.skinLight} position={[0, -0.58, 0]} />
                    <mesh geometry={geometry.foot} material={material.skinLight} position={[0, -1.12, 0.2]} />
                </group>
            </group>
        </group>
    );
}
