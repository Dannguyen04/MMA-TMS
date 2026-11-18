import * as THREE from "three";

import { SPOT_COUNT, type RegionSpot } from "./regions";

/**
 * One material, two looks:
 * - "hologram": a see-through body like the mobile app's: a faint glass fill, a bright silhouette edge
 *   and a wireframe ("the mesh") over the surface. A scan band sweeps head to toe on entry: the wire is
 *   drawn just ahead of the band, the glass fills in behind it, and each region switches on as it passes.
 *   While the figure is on screen it breathes, and a faint light runs up the wire now and then.
 * - "clinical": matte clay under a soft key light, regions painted in their tone like a marked chart.
 * Highlights are per spot (see regions.ts); a pulsing spot also sends a ripple across the surface, and
 * the wire over a lit region takes its colour.
 *
 * The see-through look draws the same surface three times, then the wire (see `BodyRig`): a depth-only
 * pass, so only the surface nearest the camera is drawn and the far side never shows through; regions
 * on the far side at a fifth of their strength, so an injury on the back still shows from the front;
 * the body itself; and the wire, tested against that depth so only the near side's lines show.
 */

export type BodyLook = "hologram" | "clinical";

export interface BodyUniforms {
    uLook: { value: number };
    uTime: { value: number };
    uScan: { value: number };
    /** 0–1: breathing and the idle light along the wire (0 under reduced motion, on lite, off screen). */
    uIdle: { value: number };
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

/**
 * Breathing: one cycle every ~4 s, the chest and belly rise up to 6 mm along the surface normal.
 * `LIFT` moves the wire off the surface so its straight edges are not swallowed where the surface bulges
 * between them.
 */
const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uIdle;
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
        vec3 p = position;
        float torso = smoothstep(0.95, 1.08, p.y) * (1.0 - smoothstep(1.36, 1.46, p.y)) * (1.0 - smoothstep(0.15, 0.23, abs(p.x)));
        float breath = 0.5 - 0.5 * cos(uTime * 1.6);
        p += normal * torso * breath * uIdle * 0.006 * (0.35 + 0.65 * max(normal.z, 0.0));
        #ifdef LIFT
            p += normal * LIFT;
        #endif
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
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
    uniform float uIdle;
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

    // Lays (c, a) over the colour so far.
    vec4 over(vec4 acc, vec3 c, float a) {
        float outA = a + acc.a * (1.0 - a);
        if (outA < 1e-4) return vec4(0.0);
        return vec4((c * a + acc.rgb * acc.a * (1.0 - a)) / outA, outA);
    }

    void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(vView);
        float facing = clamp(abs(dot(n, view)), 0.0, 1.0);
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
            focus = max(focus, (1.0 - smoothstep(r * 0.55, r * 1.08, d)) * uSpotFocus[i] * reveal);
        }
        vec3 regionColor = weight > 0.0 ? tint / weight : vec3(0.0);
        float cover = clamp(weight, 0.0, 1.0);

        #if defined(OCCLUDED)
            // The far side, seen through the body: regions only, faint, never in the clinical look.
            float a = (cover * 0.22 + ripple * 0.12) * step(uLook, 0.5);
            if (a < 0.004) discard;
            gl_FragColor = vec4(regionColor * uDim, a);
        #elif defined(WIRE)
            // The wire runs a little ahead of the scan band, so the mesh is drawn before the glass fills it.
            float drawn = smoothstep(uScan - 0.2, uScan - 0.06, vPos.y);
            float sweepY = mix(-0.2, 2.0, fract(uTime / 7.0));
            float shimmer = exp(-pow((vPos.y - sweepY) / 0.07, 2.0)) * uIdle;
            vec3 color = mix(uRim, regionColor, cover * 0.85);
            float a = drawn * (0.2 + 0.4 * fresnel + 0.35 * cover + 0.45 * shimmer + 0.3 * focus) * step(uLook, 0.5);
            if (a < 0.004) discard;
            gl_FragColor = vec4(color * uDim, min(a, 0.9));
        #else
            vec4 acc;
            if (uLook < 0.5) {
                float scanned = smoothstep(uScan - 0.02, uScan + 0.02, vPos.y);
                float band = exp(-pow((vPos.y - uScan) / 0.018, 2.0));
                vec3 glass = uBase * (0.62 + 0.38 * facing) + uRim * fresnel * 0.9;
                acc = vec4(glass, scanned * (0.16 + 0.62 * fresnel));
                acc = over(acc, regionColor, cover * scanned * (0.62 + 0.3 * fresnel));
                acc = over(acc, regionColor, clamp(ripple, 0.0, 1.0) * 0.7);
                acc = over(acc, mix(uRim, regionColor, step(0.001, cover)), focus * 0.35);
                acc = over(acc, uRim, band * 0.85);
            } else {
                vec3 key = normalize(vec3(0.45, 0.85, 0.75));
                float diffuse = clamp(dot(n, key), 0.0, 1.0);
                float hemi = 0.55 + 0.45 * n.y;
                vec3 clay = uBase * (0.42 * hemi + 0.68 * diffuse) + uRim * fresnel * 0.22;
                vec3 paint = regionColor * (0.62 + 0.42 * diffuse + 0.12 * hemi);
                vec3 color = mix(clay, paint, cover * 0.94);
                color = mix(color, regionColor * 1.15, ripple * 0.6);
                color += vec3(focus) * 0.12;
                acc = vec4(color, 1.0);
            }
            gl_FragColor = vec4(acc.rgb * uDim, acc.a);
        #endif
        #include <colorspace_fragment>
    }
`;

/** Depth only: nothing reaches the screen; it keeps the far side of the body out of the see-through look. */
const depthFragment = /* glsl */ `
    void main() {
        gl_FragColor = vec4(0.0);
    }
`;

export interface BodyMaterials {
    /** Writes depth for the nearest surface; drawn first. */
    depth: THREE.ShaderMaterial;
    /** Regions on the far side, through the body. */
    occluded: THREE.ShaderMaterial;
    body: THREE.ShaderMaterial;
    /** The wireframe over the near side (line segments). */
    wire: THREE.ShaderMaterial;
    uniforms: BodyUniforms;
}

/** `spots`: the model's spots, in `SPOT_REGIONS` order. The materials share one set of uniforms. */
export function createBodyMaterials(spots: readonly RegionSpot[]): BodyMaterials {
    if (spots.length !== SPOT_COUNT) throw new Error(`A body model needs ${SPOT_COUNT} spots, got ${spots.length}.`);
    const uniforms: BodyUniforms = {
        uLook: { value: 0 },
        uTime: { value: 0 },
        uScan: { value: 2.2 },
        uIdle: { value: 0 },
        uBase: { value: new THREE.Color() },
        uRim: { value: new THREE.Color() },
        uSpotPos: { value: spots.map((s) => s.center.clone()) },
        uSpotRadius: { value: spots.map((s) => s.radius) },
        uSpotColor: { value: spots.map(() => new THREE.Color()) },
        uSpotAmp: { value: spots.map(() => 0) },
        uSpotPulse: { value: spots.map(() => 0) },
        uSpotFocus: { value: spots.map(() => 0) },
        uDim: { value: 1 },
    };
    const shared = uniforms as unknown as Record<string, THREE.IUniform>;
    // In the transparent queue (by render order) so the floor glow is drawn first and shows through the body.
    const depth = new THREE.ShaderMaterial({
        uniforms: shared,
        vertexShader,
        fragmentShader: depthFragment,
        transparent: true,
        depthWrite: true,
        colorWrite: false,
        // Same vertex shader as the body, so their depths match; a constant nudge only (no slope term,
        // which on a small canvas grows past the 3 mm between cloth and skin and lets both show).
        polygonOffset: true,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: 1,
    });
    const occluded = new THREE.ShaderMaterial({
        uniforms: shared,
        vertexShader,
        fragmentShader,
        defines: { OCCLUDED: "" },
        transparent: true,
        depthWrite: false,
        depthFunc: THREE.GreaterDepth,
        side: THREE.DoubleSide,
    });
    const body = new THREE.ShaderMaterial({
        uniforms: shared,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthFunc: THREE.LessEqualDepth,
    });
    const wire = new THREE.ShaderMaterial({
        uniforms: shared,
        vertexShader,
        fragmentShader,
        defines: { WIRE: "", LIFT: "0.004" },
        transparent: true,
        depthWrite: false,
        depthFunc: THREE.LessEqualDepth,
    });
    return { depth, occluded, body, wire, uniforms };
}
