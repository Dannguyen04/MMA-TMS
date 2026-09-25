import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

import { BONES, KEYPOINTS, LEFT_ANKLE, LEFT_HIP, LEFT_KNEE } from "../pose-skeleton";
import type { StageFrame } from "../story";

/**
 * The AI pose overlay drawn over the fighter: keypoints pop in as the scan line passes them, bones
 * trace down behind the scan, then an arc measures the left knee angle. Drawn without depth
 * testing, like the skeleton overlay on analysed video in the app.
 */

export interface SkeletonOverlay {
    object: THREE.Group;
    /** Model-space anchor for the knee-angle label. */
    knee: THREE.Vector3;
    update(frame: StageFrame, time: number): void;
    setResolution(width: number, height: number): void;
    dispose(): void;
}

const CYAN = new THREE.Color("#7fe9ff");
const ARC_RADIUS = 0.09;
const ARC_STEPS = 24;

/** `depthAt` gives the relief's surface depth at a model-space point, so points sit on the body. */
export function createSkeletonOverlay(glow: THREE.Texture, depthAt: (x: number, y: number) => number): SkeletonOverlay {
    const object = new THREE.Group();
    object.renderOrder = 10;
    const points = KEYPOINTS.map(([x, y]) => new THREE.Vector3(x, y, depthAt(x, y) + 0.03));
    // When each keypoint was found by the scan, for its pop-in.
    const revealAt = new Float32Array(points.length).fill(-1);

    const dotMaterials = points.map(
        () => new THREE.SpriteMaterial({ map: glow, color: CYAN, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    const dots = points.map((point, index) => {
        const sprite = new THREE.Sprite(dotMaterials[index]);
        sprite.position.copy(point);
        sprite.renderOrder = 12;
        object.add(sprite);
        return sprite;
    });

    const boneGeometry = new LineSegmentsGeometry();
    const bonePositions = new Float32Array(BONES.length * 6);
    boneGeometry.setPositions(bonePositions);
    const boneMaterial = new LineMaterial({ color: CYAN.getHex(), linewidth: 2.2, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const bones = new LineSegments2(boneGeometry, boneMaterial);
    bones.renderOrder = 11;
    bones.frustumCulled = false;
    object.add(bones);

    // Knee angle: an arc from the thigh to the shin.
    const knee = points[LEFT_KNEE];
    const toHip = points[LEFT_HIP].clone().sub(knee).normalize();
    const toAnkle = points[LEFT_ANKLE].clone().sub(knee).normalize();
    const arcAngle = toHip.angleTo(toAnkle);
    const arcAxis = new THREE.Vector3().crossVectors(toHip, toAnkle).normalize();
    const arcGeometry = new LineSegmentsGeometry();
    const arcPositions = new Float32Array(ARC_STEPS * 6);
    arcGeometry.setPositions(arcPositions);
    const arcMaterial = new LineMaterial({ color: 0xffffff, linewidth: 2.6, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const arc = new LineSegments2(arcGeometry, arcMaterial);
    arc.renderOrder = 13;
    arc.frustumCulled = false;
    object.add(arc);

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // setPositions keeps our Float32Array as the buffer, so updating it in place only needs a flag.
    const writeSegments = (geometry: LineSegmentsGeometry) => {
        (geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    };

    return {
        object,
        knee,
        update(frame, time) {
            const strength = frame.skeleton;
            object.visible = strength > 0.001;
            if (!object.visible) {
                revealAt.fill(-1);
                return;
            }

            points.forEach((point, index) => {
                const passed = frame.scanY < point.y;
                if (passed && revealAt[index] < 0) revealAt[index] = time;
                if (!passed) revealAt[index] = -1;
                const age = revealAt[index] < 0 ? -1 : time - revealAt[index];
                // Pop: overshoot then settle; a steady shimmer afterwards.
                const pop = age < 0 ? 0 : age < 0.35 ? 1 + Math.sin((age / 0.35) * Math.PI) * 0.9 : 1;
                const shimmer = 0.85 + 0.15 * Math.sin(time * 3 + index);
                dots[index].scale.setScalar(0.07 * pop * (index === LEFT_KNEE ? 1 + frame.angle * 0.4 : 1));
                dotMaterials[index].opacity = strength * (age < 0 ? 0 : shimmer);
            });

            BONES.forEach(([from, to], index) => {
                // Each bone is traced from its upper keypoint down to wherever the scan line is now.
                const [upper, lower] = points[from].y >= points[to].y ? [points[from], points[to]] : [points[to], points[from]];
                const span = upper.y - lower.y;
                const traced = frame.scanY >= upper.y ? 0 : span < 1e-3 ? 1 : Math.min(1, (upper.y - frame.scanY) / span);
                a.copy(upper);
                b.copy(upper).lerp(lower, traced);
                bonePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
            });
            writeSegments(boneGeometry);
            boneMaterial.opacity = strength * 0.9;

            const sweep = arcAngle * frame.angle;
            for (let step = 0; step < ARC_STEPS; step++) {
                direction.copy(toHip).applyAxisAngle(arcAxis, (sweep * step) / ARC_STEPS);
                a.copy(knee).addScaledVector(direction, ARC_RADIUS);
                direction.copy(toHip).applyAxisAngle(arcAxis, (sweep * (step + 1)) / ARC_STEPS);
                b.copy(knee).addScaledVector(direction, ARC_RADIUS);
                arcPositions.set([a.x, a.y, a.z, b.x, b.y, b.z], step * 6);
            }
            writeSegments(arcGeometry);
            arcMaterial.opacity = frame.angle;
            arc.visible = frame.angle > 0.001;
        },
        setResolution(width, height) {
            boneMaterial.resolution.set(width, height);
            arcMaterial.resolution.set(width, height);
        },
        dispose() {
            for (const material of dotMaterials) material.dispose();
            boneGeometry.dispose();
            boneMaterial.dispose();
            arcGeometry.dispose();
            arcMaterial.dispose();
        },
    };
}
