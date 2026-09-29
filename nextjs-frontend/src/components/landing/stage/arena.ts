import * as THREE from "three";

import { CAGE, type StageFrame } from "../story";
import { createMat } from "./mat";
import { CIRCUMRADIUS, SIDE_LENGTH, corner, octagonShape } from "./octagon";
import { radialTexture, seededRandom } from "./textures";

/**
 * The fight venue in front of the backdrop, all procedural: the canvas mat, a black vinyl
 * chain-link cage with padded posts and top rail, the raised platform, and the overhead rig. Its
 * top light pools on the mat and shows as a shaft through the haze, with dust drifting in it.
 */

export interface Arena {
    object: THREE.Group;
    update(frame: StageFrame, time: number, delta: number): void;
    dispose(): void;
}

/** Role beam colours: fighter, coach, sports doctor, admin. */
const ROLE_COLORS = ["#e5484d", "#3d8bff", "#3fd7e8", "#f4f6fb"];

const PLATFORM_DROP = 1.3;
const TRUSS_HEIGHT = 6.3;
const TOP_LIGHT = 200;
/** Spacing of the chain-link diamonds, metres. */
const MESH_CELL = 0.06;
/** Lens aperture for the fence's depth of field, metres: wider blurs the mesh away from the fighter sooner. */
const APERTURE = 0.012;
const CONE_RADIUS = 2.4;

export function createArena({ dust, canvas }: { dust: number; canvas: THREE.Texture }): Arena {
    const disposables: { dispose(): void }[] = [];
    const own = <T extends { dispose(): void }>(resource: T): T => {
        disposables.push(resource);
        return resource;
    };
    const object = new THREE.Group();

    // --- Lights. Intensities follow the stage every frame (intro, chapter mood). ---------------
    // The top light carries the scene; the rims only graze the mat and posts with the chapter colour.
    const hemi = new THREE.HemisphereLight("#5c6b85", "#0c0a09", 0.1);
    const key = new THREE.DirectionalLight("#ffe8d6", 0.12);
    key.position.set(-1.8, 3.4, 4.2);
    const rimLeft = new THREE.DirectionalLight("#2f7de1", 2);
    rimLeft.position.set(-3.6, 2.6, -2.8);
    const rimRight = new THREE.DirectionalLight("#d6343f", 2);
    rimRight.position.set(3.6, 2.2, -2.8);
    const top = new THREE.SpotLight("#ffeedd", TOP_LIGHT, 14, 0.5, 1, 1.6);
    top.position.set(0, TRUSS_HEIGHT, 0.3);
    top.target.position.set(0, 0, 0);
    object.add(hemi, key, rimLeft, rimRight, top, top.target);

    const dark = own(new THREE.MeshStandardMaterial({ color: "#0b0c0f", roughness: 0.92 }));
    const vinyl = own(new THREE.MeshStandardMaterial({ color: "#0e0f12", roughness: 0.42 }));

    // --- Venue floor and the raised platform the cage stands on. -------------------------------
    const venueFloor = new THREE.Mesh(own(new THREE.CircleGeometry(60, 64)), own(new THREE.MeshStandardMaterial({ color: "#050506", roughness: 1 })));
    venueFloor.rotation.x = -Math.PI / 2;
    venueFloor.position.y = -PLATFORM_DROP;
    const apronShape = octagonShape(CIRCUMRADIUS + 1.4);
    apronShape.holes.push(octagonShape(CIRCUMRADIUS));
    const apron = new THREE.Mesh(own(new THREE.ShapeGeometry(apronShape)), dark);
    apron.rotation.x = -Math.PI / 2;
    const skirt = new THREE.Mesh(own(new THREE.CylinderGeometry(CIRCUMRADIUS + 1.4, CIRCUMRADIUS + 1.4, PLATFORM_DROP, 8, 1, true)), dark);
    skirt.rotation.y = Math.PI / 8 - Math.PI / 2;
    skirt.position.y = -PLATFORM_DROP / 2;

    const mat = own(createMat(canvas));

    // --- Fence: eight black vinyl chain-link panels over a padded base. -------------------------
    // Depth of field: the mesh blurs with distance from the fighter, so it reads as a crisp cage
    // near him and softens into a dark veil over the stands, like a fast lens would see it.
    const fenceUniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uLights: { value: 0 }, uFocus: { value: 4 }, uWire: { value: new THREE.Color(0.06, 0.057, 0.053) } },
    ]);
    const fenceMaterial = own(
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: true,
            uniforms: fenceUniforms,
            vertexShader: /* glsl */ `
                varying vec2 vPos;
                varying float vDepth;
                #include <fog_pars_vertex>
                void main() {
                    vPos = position.xy;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vDepth = -mvPosition.z;
                    gl_Position = projectionMatrix * mvPosition;
                    #include <fog_vertex>
                }`,
            fragmentShader: /* glsl */ `
                varying vec2 vPos;
                varying float vDepth;
                uniform float uLights;
                uniform float uFocus;
                uniform vec3 uWire;
                #include <fog_pars_fragment>
                void main() {
                    float lit = 0.25 + 0.75 * uLights;
                    if (vPos.y < 0.2) {
                        // Padded base, with its top edge catching the light.
                        float edge = (vPos.y - 0.192) * 110.0;
                        gl_FragColor = vec4((vec3(0.011, 0.011, 0.013) + uWire * 0.7 * exp(-edge * edge)) * lit, 1.0);
                        #include <fog_fragment>
                        return;
                    }
                    // Diamond chain-link: wires along both diagonals of the cell.
                    vec2 diagonal = vec2(vPos.x + vPos.y, vPos.x - vPos.y) / ${MESH_CELL.toFixed(3)};
                    vec2 toWire = 0.5 - abs(fract(diagonal) - 0.5);
                    float wireDistance = min(toWire.x, toWire.y);
                    // The two wire directions meet the top light at different angles, so one runs brighter.
                    float glint = toWire.x < toWire.y ? 1.0 : 0.6;
                    float blur = ${APERTURE.toFixed(3)} * abs(vDepth - uFocus) / uFocus * 1.414 / ${MESH_CELL.toFixed(3)};
                    float soft = length(fwidth(diagonal)) + blur;
                    float wire = 1.0 - smoothstep(0.05 - soft * 0.5, 0.05 + soft * 0.5, wireDistance);
                    // Blurred past a cell, the mesh averages to its coverage instead of shimmering.
                    float coverage = mix(wire, 0.19, smoothstep(0.15, 0.6, soft));
                    float catchLight = 0.55 + 0.45 * smoothstep(0.4, 1.85, vPos.y);
                    gl_FragColor = vec4(uWire * catchLight * mix(0.8, glint, 1.0 - smoothstep(0.15, 0.6, soft)) * lit, coverage * 0.92);
                    #include <fog_fragment>
                }`,
        }),
    );
    const fenceGeometry = own(new THREE.PlaneGeometry(SIDE_LENGTH, CAGE.fenceHeight));
    fenceGeometry.translate(0, CAGE.fenceHeight / 2, 0);
    const railGeometry = own(new THREE.CylinderGeometry(0.075, 0.075, SIDE_LENGTH, 16));
    const fence = new THREE.Group();
    for (let side = 0; side < 8; side++) {
        const angle = Math.PI / 2 + (side * Math.PI) / 4;
        const panel = new THREE.Mesh(fenceGeometry, fenceMaterial);
        panel.position.set(Math.cos(angle) * CAGE.apothem, 0, Math.sin(angle) * CAGE.apothem);
        panel.rotation.y = Math.PI / 2 - angle;
        panel.renderOrder = 2;

        const rail = new THREE.Mesh(railGeometry, vinyl);
        rail.rotation.z = Math.PI / 2;
        rail.position.y = CAGE.fenceHeight + 0.04;
        panel.add(rail);
        fence.add(panel);
    }
    const postGeometry = own(new THREE.CylinderGeometry(0.12, 0.13, CAGE.fenceHeight + 0.14, 24));
    postGeometry.translate(0, (CAGE.fenceHeight + 0.14) / 2, 0);
    const redPad = own(new THREE.MeshStandardMaterial({ color: "#5c1319", roughness: 0.45 }));
    const bluePad = own(new THREE.MeshStandardMaterial({ color: "#122d5a", roughness: 0.45 }));
    for (let k = 0; k < 8; k++) {
        const point = corner(k);
        // The red and blue corners are the back-left and back-right posts.
        const post = new THREE.Mesh(postGeometry, k === 4 ? redPad : k === 7 ? bluePad : vinyl);
        post.position.set(point.x, 0, point.y);
        fence.add(post);
    }

    // --- Overhead rig: an octagon truss with eight fixtures glowing down at the cage. ----------
    const truss = new THREE.Group();
    const trussMaterial = own(new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.5, metalness: 0.6 }));
    const beamGeometry = own(new THREE.BoxGeometry(2 * 3.6 * Math.tan(Math.PI / 8) * 1.08, 0.16, 0.16));
    const lensMaterial = own(
        new THREE.SpriteMaterial({ map: own(radialTexture("rgba(255,255,255,1)")), color: "#fff3e6", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    for (let k = 0; k < 8; k++) {
        const angle = Math.PI / 2 + (k * Math.PI) / 4;
        const beam = new THREE.Mesh(beamGeometry, trussMaterial);
        beam.position.set(Math.cos(angle) * 3.6 * Math.cos(Math.PI / 8), TRUSS_HEIGHT, Math.sin(angle) * 3.6 * Math.cos(Math.PI / 8));
        beam.rotation.y = Math.PI / 2 - angle;
        truss.add(beam);
        const point = corner(k, 3.6);
        const lens = new THREE.Sprite(lensMaterial);
        lens.position.set(point.x, TRUSS_HEIGHT - 0.2, point.y);
        lens.scale.setScalar(0.7);
        truss.add(lens);
    }

    // Volumetric top light: an open cone, bright where it faces the camera, fading toward the floor.
    const coneVertexShader = /* glsl */ `
        varying float vFacing;
        varying float vHeight;
        void main() {
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-view.xyz)));
            vHeight = uv.y;
            gl_Position = projectionMatrix * view;
        }`;
    const coneUniforms = { uStrength: { value: 0 }, uColor: { value: new THREE.Color(1, 0.93, 0.84) } };
    const cone = new THREE.Mesh(
        own(new THREE.CylinderGeometry(0.15, CONE_RADIUS, TRUSS_HEIGHT - 0.2, 64, 1, true)),
        own(
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                uniforms: coneUniforms,
                vertexShader: coneVertexShader,
                fragmentShader: /* glsl */ `
                    varying float vFacing;
                    varying float vHeight;
                    uniform float uStrength;
                    uniform vec3 uColor;
                    void main() {
                        float glow = vFacing * vFacing * smoothstep(0.0, 0.6, vHeight) * (1.0 - smoothstep(0.85, 1.0, vHeight));
                        gl_FragColor = vec4(uColor * glow * 0.035 * uStrength, 1.0);
                    }`,
            }),
        ),
    );
    cone.position.set(0, (TRUSS_HEIGHT - 0.2) / 2, 0.2);

    // Role beams: one coloured column per role, from the diagonal fixtures to a pool on the mat.
    // The pools are additive decals rather than lights, so every material keeps a fixed light count.
    const beamUniforms = ROLE_COLORS.map((color) => ({ uColor: { value: new THREE.Color(color) }, uStrength: { value: 0 } }));
    const beams = new THREE.Group();
    const roleBeamGeometry = own(new THREE.CylinderGeometry(0.08, 0.55, TRUSS_HEIGHT, 32, 1, true));
    const poolGeometry = own(new THREE.PlaneGeometry(2.2, 2.2));
    const poolTexture = own(radialTexture("rgba(255,255,255,0.9)"));
    const poolMaterials = ROLE_COLORS.map((color) =>
        own(new THREE.MeshBasicMaterial({ map: poolTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })),
    );
    beamUniforms.forEach((uniforms, index) => {
        const beam = new THREE.Mesh(
            roleBeamGeometry,
            own(
                new THREE.ShaderMaterial({
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide,
                    uniforms,
                    vertexShader: coneVertexShader,
                    fragmentShader: /* glsl */ `
                        varying float vFacing;
                        varying float vHeight;
                        uniform vec3 uColor;
                        uniform float uStrength;
                        void main() {
                            float glow = vFacing * vFacing * vFacing * smoothstep(0.0, 0.2, vHeight) * (1.0 - smoothstep(0.4, 1.0, vHeight));
                            gl_FragColor = vec4(uColor * glow * 0.22 * uStrength, 1.0);
                        }`,
                }),
            ),
        );
        const fixture = corner(1 + index * 2, 3.6);
        const pool = corner(1 + index * 2, 2.5);
        // Tilt the column so it runs from the fixture down to its pool on the mat.
        beam.position.set((fixture.x + pool.x) / 2, TRUSS_HEIGHT / 2, (fixture.y + pool.y) / 2);
        beam.lookAt(fixture.x, TRUSS_HEIGHT, fixture.y);
        beam.rotateX(Math.PI / 2);
        const poolDecal = new THREE.Mesh(poolGeometry, poolMaterials[index]);
        poolDecal.rotation.x = -Math.PI / 2;
        poolDecal.position.set(pool.x, 0.006, pool.y);
        beams.add(beam, poolDecal);
    });

    // --- Haze: dust drifting up inside the top light's shaft, lit only where the shaft reaches. --
    let particles: { points: THREE.Points; material: THREE.ShaderMaterial; speeds: Float32Array } | null = null;
    if (dust > 0) {
        const random = seededRandom(1337);
        const positions = new Float32Array(dust * 3);
        const seeds = new Float32Array(dust);
        const speeds = new Float32Array(dust);
        for (let i = 0; i < dust; i++) {
            const angle = random() * Math.PI * 2;
            const radius = Math.sqrt(random()) * CONE_RADIUS;
            positions.set([Math.cos(angle) * radius, random() * 4.6, Math.sin(angle) * radius], i * 3);
            seeds[i] = random();
            speeds[i] = 0.015 + random() * 0.04;
        }
        const geometry = own(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        const material = own(
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { uTime: { value: 0 }, uLights: { value: 0 } },
                vertexShader: /* glsl */ `
                    attribute float aSeed;
                    uniform float uTime;
                    varying float vGlow;
                    void main() {
                        vec4 view = modelViewMatrix * vec4(position, 1.0);
                        // The shaft narrows toward the rig: a mote outside it stays unlit.
                        float shaft = mix(${CONE_RADIUS.toFixed(2)}, 0.3, clamp(position.y / ${(TRUSS_HEIGHT - 0.2).toFixed(2)}, 0.0, 1.0));
                        float inside = 1.0 - smoothstep(shaft * 0.55, shaft, length(position.xz));
                        float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.2) + aSeed * 40.0);
                        vGlow = inside * twinkle * smoothstep(0.1, 0.8, position.y) * (1.0 - smoothstep(3.6, 4.6, position.y));
                        gl_PointSize = (2.0 + aSeed * 2.5) * (4.0 / -view.z);
                        gl_Position = projectionMatrix * view;
                    }`,
                fragmentShader: /* glsl */ `
                    varying float vGlow;
                    uniform float uLights;
                    void main() {
                        float d = length(gl_PointCoord - 0.5) * 2.0;
                        float disc = exp(-d * d * 4.0);
                        gl_FragColor = vec4(vec3(1.0, 0.94, 0.86) * disc * vGlow * 0.4 * uLights, 1.0);
                    }`,
            }),
        );
        particles = { points: new THREE.Points(geometry, material), material, speeds };
        particles.points.frustumCulled = false;
    }

    object.add(venueFloor, apron, skirt, mat.mesh, fence, truss, cone, beams);
    if (particles) object.add(particles.points);

    return {
        object,
        update(frame, time, delta) {
            const lights = frame.lights;
            rimLeft.color.setRGB(...frame.rim.left);
            rimRight.color.setRGB(...frame.rim.right);
            rimLeft.intensity = 1.2 * frame.rim.strength * lights;
            rimRight.intensity = 1.2 * frame.rim.strength * lights;
            key.intensity = 0.12 * lights * (1 - frame.xray * 0.7);
            hemi.intensity = 0.02 + 0.08 * lights;
            top.intensity = TOP_LIGHT * lights * (1 - frame.xray * 0.55) * (1 - frame.beams * 0.35);
            poolMaterials.forEach((material) => (material.opacity = 0.55 * frame.beams * lights));
            fenceUniforms.uLights.value = lights;
            // Focus on the fighter's axis, where every shot aims.
            const [x, , z] = frame.camera.position;
            fenceUniforms.uFocus.value = Math.max(1, Math.hypot(x, z));
            coneUniforms.uStrength.value = lights * (1 - frame.beams * 0.6);
            beamUniforms.forEach((uniforms) => (uniforms.uStrength.value = frame.beams * lights));
            beams.visible = frame.beams > 0.001;
            lensMaterial.opacity = 0.35 + 0.65 * lights;
            if (particles) {
                particles.material.uniforms.uTime.value = time;
                particles.material.uniforms.uLights.value = lights;
                const attribute = particles.points.geometry.getAttribute("position") as THREE.BufferAttribute;
                for (let i = 0; i < particles.speeds.length; i++) {
                    const y = attribute.getY(i) + particles.speeds[i] * delta;
                    attribute.setY(i, y > 4.6 ? 0 : y);
                }
                attribute.needsUpdate = true;
            }
        },
        dispose() {
            for (const resource of disposables) resource.dispose();
        },
    };
}
