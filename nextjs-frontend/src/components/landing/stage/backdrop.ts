import * as THREE from "three";

import { ARENA_PLATE } from "../arena-plate";
import type { StageFrame } from "../story";

/**
 * The venue beyond the cage: a photograph of the stands, out of focus, wrapped round a dome that
 * travels with the camera. It sits at infinity, so it pans as the camera orbits but never slides
 * against the cage. Past its side edges the plate is mirrored, so the stands carry on without a
 * seam; above and below it fades into the dark roof and floor. The brightest bokeh is pushed past
 * white so it blooms like real lights, and the chapter's rim colours wash faintly through the haze.
 */

export interface Backdrop {
    object: THREE.Mesh;
    update(frame: StageFrame, camera: THREE.Camera): void;
    dispose(): void;
}

export function createBackdrop(plate: THREE.Texture): Backdrop {
    plate.colorSpace = THREE.SRGBColorSpace;
    // Always magnified on screen, and mipmaps would crease along the mirror lines.
    plate.generateMipmaps = false;
    plate.minFilter = THREE.LinearFilter;
    plate.needsUpdate = true;

    const uniforms = {
        uPlate: { value: plate },
        uYaw: { value: ARENA_PLATE.yaw },
        uSpan: { value: new THREE.Vector2(ARENA_PLATE.span, ARENA_PLATE.span / ARENA_PLATE.aspect) },
        uHorizon: { value: ARENA_PLATE.horizon },
        uExposure: { value: ARENA_PLATE.exposure },
        uLights: { value: 0 },
        uLeft: { value: new THREE.Color() },
        uRight: { value: new THREE.Color() },
    };
    const geometry = new THREE.SphereGeometry(40, 64, 32);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vDirection;
            void main() {
                vDirection = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            varying vec3 vDirection;
            uniform sampler2D uPlate;
            uniform float uYaw;
            uniform vec2 uSpan;
            uniform float uHorizon;
            uniform float uExposure;
            uniform float uLights;
            uniform vec3 uLeft;
            uniform vec3 uRight;
            void main() {
                vec3 direction = normalize(vDirection);
                float heading = atan(direction.x, direction.z) - uYaw;
                heading = atan(sin(heading), cos(heading));
                float pitch = asin(clamp(direction.y, -1.0, 1.0));
                // Screen left is positive heading while the camera looks toward -Z.
                vec2 uv = vec2(0.5 - heading / uSpan.x, uHorizon + pitch / uSpan.y);
                uv.x = 1.0 - abs(mod(uv.x, 2.0) - 1.0);
                vec3 color = texture2D(uPlate, vec2(uv.x, clamp(uv.y, 0.002, 0.998))).rgb;
                color *= smoothstep(1.1, 0.97, uv.y) * smoothstep(-0.1, 0.03, uv.y);

                float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
                color *= 1.0 + 1.2 * smoothstep(0.45, 0.95, luma);
                float left = max(0.0, dot(direction, normalize(vec3(-0.8, 0.25, -0.55))));
                float right = max(0.0, dot(direction, normalize(vec3(0.8, 0.25, -0.55))));
                left *= left;
                right *= right;
                color += (uLeft * left * left + uRight * right * right) * 0.012;
                // House lights: the stands stay dim until the rig comes on.
                gl_FragColor = vec4(color * uExposure * mix(0.3, 1.0, uLights), 1.0);
            }`,
    });
    const object = new THREE.Mesh(geometry, material);
    object.renderOrder = -2;
    object.frustumCulled = false;

    return {
        object,
        update(frame, camera) {
            object.position.copy(camera.position);
            uniforms.uLights.value = frame.lights;
            uniforms.uLeft.value.setRGB(...frame.rim.left);
            uniforms.uRight.value.setRGB(...frame.rim.right);
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}
