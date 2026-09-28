import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * The output pass (tone mapping into the screen's colour space) with film grain added to the
 * display-ready image: 24 frames a second, strongest in the mid-tones. The grain ties the
 * photographed fighter and stands to the rendered cage and dithers the dark gradients so they never
 * band. It is folded into the output pass, so it costs no extra full-screen pass.
 */

const GRAIN_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform float uAmount;
float grainHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}`;

const GRAIN = /* glsl */ `
    float grainLuma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    float grain = grainHash(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5;
    float grainWeight = 0.3 + 0.7 * smoothstep(0.0, 0.25, grainLuma) * (1.0 - smoothstep(0.6, 1.0, grainLuma));
    gl_FragColor.rgb += grain * uAmount * grainWeight;`;

export function createGrainOutputPass(amount: number) {
    const pass = new OutputPass();
    const shader = pass.material.fragmentShader;
    // Only when three's output shader still has the shape this expects; otherwise it renders without grain.
    if (shader.includes("varying vec2 vUv;") && /\}\s*$/.test(shader)) {
        pass.uniforms.uTime = { value: 0 };
        pass.uniforms.uAmount = { value: amount };
        pass.material.fragmentShader = shader.replace("varying vec2 vUv;", `varying vec2 vUv;${GRAIN_UNIFORMS}`).replace(/\}\s*$/, `${GRAIN}\n}`);
    }
    return {
        pass,
        setTime(time: number) {
            if (pass.uniforms.uTime) pass.uniforms.uTime.value = time;
        },
    };
}
