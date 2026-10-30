import * as THREE from "three";

import type { Relief } from "./relief";

/**
 * Material for the 2.5D fighter cutout. The photo keeps its own lighting (mostly emissive, with a
 * little arena light on top), the relief displaces it toward the camera, and a grade sits him in
 * the arena: the overhead rig lights his shoulders more than his shins, the shadows cool toward
 * the venue's blue-black, and he stays a silhouette until the lights come on. Three landing
 * effects are added on top:
 * - a laser scan band that sweeps the body (AI analysis), leaving a faint digitised trail;
 * - a hologram look for sports medicine: dark body, bright silhouette edges, streaming scanlines;
 * - a pulsing focus spot with a ripple, marking the joint an AI observation refers to.
 */

export interface FighterMaterialUniforms {
    uTime: { value: number };
    uLights: { value: number };
    uScanY: { value: number };
    uScan: { value: number };
    uScanColor: { value: THREE.Color };
    uXray: { value: number };
    uXrayColor: { value: THREE.Color };
    uFocus: { value: THREE.Vector3 };
    uFocusStrength: { value: number };
}

/** `multisampled`: false when the composer draws without MSAA (lite), where alpha-to-coverage does nothing. */
export function createFighterMaterial(map: THREE.Texture, relief: Relief, depth: number, { multisampled }: { multisampled: boolean }): { material: THREE.MeshStandardMaterial; uniforms: FighterMaterialUniforms } {
    const material = new THREE.MeshStandardMaterial({
        map,
        color: new THREE.Color(0.42, 0.42, 0.42),
        emissive: new THREE.Color(1, 1, 1),
        emissiveMap: map,
        emissiveIntensity: 0.66,
        roughness: 0.5,
        metalness: 0,
        displacementMap: relief.depth,
        displacementScale: depth,
        // Soft cutout edges without sorting: MSAA coverage from the photo's alpha. Without MSAA, a hard cut.
        alphaToCoverage: multisampled,
        alphaTest: multisampled ? 0 : 0.5,
    });
    const uniforms: FighterMaterialUniforms = {
        uTime: { value: 0 },
        uLights: { value: 0 },
        uScanY: { value: 2 },
        uScan: { value: 0 },
        uScanColor: { value: new THREE.Color("#5fe3ff") },
        uXray: { value: 0 },
        uXrayColor: { value: new THREE.Color("#63d9ff") },
        uFocus: { value: new THREE.Vector3() },
        uFocusStrength: { value: 0 },
    };

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms, { uRelief: { value: relief.depth } });
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vLandingWorld;")
            .replace("#include <project_vertex>", "#include <project_vertex>\nvLandingWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
varying vec3 vLandingWorld;
uniform float uTime;
uniform float uLights;
uniform float uScanY;
uniform float uScan;
uniform vec3 uScanColor;
uniform float uXray;
uniform vec3 uXrayColor;
uniform vec3 uFocus;
uniform float uFocusStrength;
uniform sampler2D uRelief;`,
            )
            .replace(
                "#include <opaque_fragment>",
                `#include <opaque_fragment>
{
    // Grade: top-lit falloff down the body, cooler and a touch less saturated in the shadows.
    float lumaIn = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor.rgb = mix(vec3(lumaIn), gl_FragColor.rgb, 0.9);
    gl_FragColor.rgb *= mix(vec3(0.86, 0.92, 1.04), vec3(1.0), smoothstep(0.02, 0.3, lumaIn));
    gl_FragColor.rgb *= mix(0.6, 1.04, smoothstep(0.02, 1.6, vLandingWorld.y)) * mix(0.18, 1.0, uLights);

    // Silhouette weight from the relief: 1 at the outline, 0 once the body has filled out.
    float fresnel = 1.0 - smoothstep(0.0, 0.45, texture2D(uRelief, vMapUv).r);

    // Scan: a hot line at uScanY and a fading digitised trail above it.
    float above = vLandingWorld.y - uScanY;
    float line = exp(-above * above * 2600.0);
    float trail = step(0.0, above) * exp(-above * 5.0);
    float rows = 0.5 + 0.5 * sin(vLandingWorld.y * 260.0);
    gl_FragColor.rgb += uScanColor * (line * 2.4 + trail * (rows * 0.12 + fresnel * 0.3)) * uScan;

    // Hologram: keep a trace of the body, light the silhouette, stream scanlines upward.
    float stream = 0.72 + 0.28 * sin(vLandingWorld.y * 420.0 - uTime * 3.0);
    float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 hologram = uXrayColor * (0.05 + luma * 0.35 + fresnel * 1.5) * stream;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hologram, uXray * 0.9);

    // Focus: a pulsing hot spot with a ripple travelling outward.
    float focusDistance = distance(vLandingWorld, uFocus);
    float pulse = 0.6 + 0.4 * sin(uTime * 4.2);
    float wave = (focusDistance - fract(uTime * 0.6) * 0.34) * 48.0;
    float ripple = exp(-wave * wave);
    gl_FragColor.rgb += vec3(1.0, 0.33, 0.3) * (smoothstep(0.15, 0.0, focusDistance) * pulse * 2.0 + ripple * 1.0) * uFocusStrength;
}`,
            );
    };
    material.customProgramCacheKey = () => "landing-fighter-cutout";
    return { material, uniforms };
}
