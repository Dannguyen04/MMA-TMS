import * as THREE from "three";

import { SAMPLE_SCORES } from "../landing-data";
import type { StageFrame } from "../story";

/**
 * The performance chapter's 3D chart: one glowing bar per technique, rising from the octagon's
 * corners around the fighter. Values are the labelled sample shown in the page copy, which also
 * lists each change against the 4-week baseline.
 */

const RADIUS = 0.92;
const MAX_HEIGHT = 1.35;

export interface TechniqueBars {
    object: THREE.Group;
    /** Top of each bar in world space, for the HTML labels. */
    tops: THREE.Vector3[];
    update(frame: StageFrame, time: number): void;
    dispose(): void;
}

function barColor(score: number): THREE.Color {
    if (score >= 80) return new THREE.Color("#4fd8ff");
    if (score >= 70) return new THREE.Color("#ffb347");
    return new THREE.Color("#ff5a64");
}

export function createTechniqueBars(glow: THREE.Texture): TechniqueBars {
    const object = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.075, 1, 0.075);
    geometry.translate(0, 0.5, 0);
    const disposables: { dispose(): void }[] = [geometry];
    const tops = SAMPLE_SCORES.map(() => new THREE.Vector3());

    const bars = SAMPLE_SCORES.map(({ score }, index) => {
        // Just inside the octagon ring's corners, starting front-left and going round.
        const angle = Math.PI / 8 + (index / 8) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(angle) * RADIUS;
        const z = Math.sin(angle) * RADIUS;
        const uniforms = { uColor: { value: barColor(score) }, uStrength: { value: 0 } };
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms,
            vertexShader: /* glsl */ `
                varying float vHeight;
                void main() {
                    vHeight = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */ `
                varying float vHeight;
                uniform vec3 uColor;
                uniform float uStrength;
                void main() {
                    float body = 0.18 + 0.82 * pow(vHeight, 1.6);
                    gl_FragColor = vec4(uColor * body * 1.4 * uStrength, 1.0);
                }`,
        });
        const bar = new THREE.Mesh(geometry, material);
        bar.position.set(x, 0, z);
        bar.frustumCulled = false;

        const capMaterial = new THREE.SpriteMaterial({ map: glow, color: uniforms.uColor.value, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const cap = new THREE.Sprite(capMaterial);
        cap.scale.setScalar(0.22);

        object.add(bar, cap);
        disposables.push(material, capMaterial);
        return { bar, cap, uniforms, capMaterial, height: (score / 100) * MAX_HEIGHT, x, z, index };
    });

    return {
        object,
        tops,
        update(frame, time) {
            object.visible = frame.bars > 0.001;
            if (!object.visible) return;
            for (const item of bars) {
                // Staggered growth: each bar starts a little after the previous one.
                const grow = THREE.MathUtils.clamp(frame.bars * 1.6 - item.index * 0.08, 0, 1);
                const eased = 1 - (1 - grow) ** 3;
                const height = Math.max(0.001, item.height * eased);
                item.bar.scale.y = height;
                item.uniforms.uStrength.value = Math.min(1, frame.bars * 1.5);
                item.cap.position.set(item.x, height, item.z);
                // The glowing cap and the bar body only show once the bar has left the floor.
                const risen = THREE.MathUtils.smoothstep(height, 0.04, 0.2);
                item.bar.visible = height > 0.01;
                item.capMaterial.opacity = risen * (0.75 + 0.25 * Math.sin(time * 3 + item.index));
                tops[item.index].set(item.x, height + 0.12, item.z);
            }
        },
        dispose() {
            for (const resource of disposables) resource.dispose();
        },
    };
}
