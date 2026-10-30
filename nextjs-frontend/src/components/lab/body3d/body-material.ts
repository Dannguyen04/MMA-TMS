import * as THREE from "three";

import { REGION_SPOTS } from "./anatomy";

/**
 * One material, two looks:
 * - "hologram": the landing's sports-medicine look. Dark body, bright silhouette edge, fine scanlines,
 *   and a scan band that sweeps head to toe and switches each region on as it passes.
 * - "clinical": matte clay under a soft key light, regions painted in their tone like a marked chart.
 * Highlights are per spot (see anatomy.ts); a pulsing spot also sends a ripple across the surface.
 */

export type BodyLook = "hologram" | "clinical";

export const SPOT_COUNT = REGION_SPOTS.length;

export interface BodyUniforms {
    uLook: { value: number };
    uTime: { value: number };
    uScan: { value: number };
    uBase: { value: THREE.Color };
    uRim: { value: THREE.Color };
    uSpotPos: { value: THREE.Vector3[] };
    uSpotRadius: { value: number[] };
    uSpotColor: { value: THREE.Color[] };
    uSpotAmp: { value: number[] };
    uSpotPulse: { value: number[] };
    uSpotFocus: { value: number[] };
    uDim: { value: number };
}

const vertexShader = /* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
    }
`;

const fragmentShader = /* glsl */ `
    #define SPOTS ${SPOT_COUNT}
    uniform float uLook;
    uniform float uTime;
    uniform float uScan;
    uniform vec3 uBase;
    uniform vec3 uRim;
    uniform vec3 uSpotPos[SPOTS];
    uniform float uSpotRadius[SPOTS];
    uniform vec3 uSpotColor[SPOTS];
    uniform float uSpotAmp[SPOTS];
    uniform float uSpotPulse[SPOTS];
    uniform float uSpotFocus[SPOTS];
    uniform float uDim;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vView;

    void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(vView);
        float facing = clamp(dot(n, view), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.4);

        // Region light, revealed once the scan band has passed it.
        vec3 tint = vec3(0.0);
        float weight = 0.0;
        float ripple = 0.0;
        float focus = 0.0;
        for (int i = 0; i < SPOTS; i++) {
            float r = uSpotRadius[i];
            float d = distance(vPos, uSpotPos[i]);
            float reveal = smoothstep(uSpotPos[i].y + 0.04, uSpotPos[i].y - 0.04, uScan);
            float w = (1.0 - smoothstep(r * 0.3, r, d)) * uSpotAmp[i] * reveal;
            float beat = 0.72 + 0.28 * sin(uTime * 5.2);
            w *= mix(1.0, beat, uSpotPulse[i]);
            float phase = fract(uTime * 0.7 + float(i) * 0.13);
            float ring = exp(-pow((d - r * (0.4 + 1.5 * phase)) / 0.011, 2.0)) * (1.0 - phase);
            ripple += ring * uSpotPulse[i] * reveal;
            tint += uSpotColor[i] * w;
            weight += w;
            focus = max(focus, (1.0 - smoothstep(r * 0.55, r * 1.08, d)) * uSpotFocus[i]);
        }
        vec3 regionColor = weight > 0.0 ? tint / weight : vec3(0.0);
        float cover = clamp(weight, 0.0, 1.0);

        vec3 color;
        if (uLook < 0.5) {
            float lines = 0.86 + 0.14 * smoothstep(0.35, 0.5, abs(fract(vPos.y * 110.0 - uTime * 0.6) - 0.5));
            float band = exp(-pow((vPos.y - uScan) / 0.018, 2.0));
            float scanned = smoothstep(uScan - 0.02, uScan + 0.02, vPos.y);
            vec3 body = uBase * (0.55 + 0.45 * facing) * lines;
            body += uRim * fresnel * (0.35 + 0.95 * scanned);
            body *= mix(0.25, 1.0, max(scanned, 0.0));
            color = body + regionColor * cover * (1.15 + 1.6 * fresnel) + uRim * band * 1.4;
            color += regionColor * ripple * 1.6;
            color += uRim * focus * 0.35 + regionColor * focus * 0.4;
        } else {
            vec3 key = normalize(vec3(0.45, 0.85, 0.75));
            vec3 viewN = n;
            float diffuse = clamp(dot(viewN, key), 0.0, 1.0);
            float hemi = 0.55 + 0.45 * viewN.y;
            vec3 clay = uBase * (0.42 * hemi + 0.68 * diffuse) + uRim * fresnel * 0.22;
            vec3 paint = regionColor * (0.62 + 0.42 * diffuse + 0.12 * hemi);
            color = mix(clay, paint, cover * 0.94);
            color = mix(color, regionColor * 1.15, ripple * 0.6);
            color += vec3(focus) * 0.12;
        }
        color *= uDim;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;

export function createBodyMaterial(): { material: THREE.ShaderMaterial; uniforms: BodyUniforms } {
    const uniforms: BodyUniforms = {
        uLook: { value: 0 },
        uTime: { value: 0 },
        uScan: { value: 2.2 },
        uBase: { value: new THREE.Color() },
        uRim: { value: new THREE.Color() },
        uSpotPos: { value: REGION_SPOTS.map((s) => s.center.clone()) },
        uSpotRadius: { value: REGION_SPOTS.map((s) => s.radius) },
        uSpotColor: { value: REGION_SPOTS.map(() => new THREE.Color()) },
        uSpotAmp: { value: REGION_SPOTS.map(() => 0) },
        uSpotPulse: { value: REGION_SPOTS.map(() => 0) },
        uSpotFocus: { value: REGION_SPOTS.map(() => 0) },
        uDim: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({ uniforms: uniforms as unknown as Record<string, THREE.IUniform>, vertexShader, fragmentShader });
    return { material, uniforms };
}
