import * as THREE from "three";

import { CAGE, type StageFrame } from "../story";

/**
 * The fight venue, all procedural: an octagon cage (canvas mat with the MMA-TMS mark, chain-link
 * fence, padded posts and top rail, red and blue LED strips), the raised platform, an overhead
 * lighting rig with a volumetric top light, a dark crowd in the stands and haze inside the cage.
 */

export interface Arena {
    object: THREE.Group;
    update(frame: StageFrame, time: number, delta: number): void;
    dispose(): void;
}

const RED = new THREE.Color("#e5484d");
const BLUE = new THREE.Color("#3d8bff");
const WHITE = new THREE.Color("#dfe7f5");
/** Role beam colours: fighter, coach, sports doctor, admin. */
const ROLE_COLORS = ["#e5484d", "#3d8bff", "#3fd7e8", "#f4f6fb"];

const CIRCUMRADIUS = CAGE.apothem / Math.cos(Math.PI / 8);
const SIDE_LENGTH = 2 * CAGE.apothem * Math.tan(Math.PI / 8);
const PLATFORM_DROP = 1.3;
const TRUSS_HEIGHT = 6.3;
/** Mat texture covers this square (metres) centred on the cage. */
const MAT_SPAN = CIRCUMRADIUS * 2 + 0.4;

/** Corner k of the octagon (flat sides facing ±X and ±Z). */
function corner(k: number, radius = CIRCUMRADIUS): THREE.Vector2 {
    const angle = Math.PI / 8 + (k * Math.PI) / 4;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function octagonShape(radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    for (let k = 0; k < 8; k++) {
        const point = corner(k, radius);
        if (k === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
    }
    shape.closePath();
    return shape;
}

export function createArena({ dust, crowd }: { dust: number; crowd: number }): Arena {
    const disposables: { dispose(): void }[] = [];
    const own = <T extends { dispose(): void }>(resource: T): T => {
        disposables.push(resource);
        return resource;
    };
    const object = new THREE.Group();
    const left = new THREE.Color();
    const right = new THREE.Color();

    // --- Lights. Intensities follow the stage every frame (intro, chapter mood). ---------------
    const hemi = new THREE.HemisphereLight("#8fa3c8", "#140f0d", 0.3);
    const key = new THREE.DirectionalLight("#fff1e6", 0.9);
    key.position.set(-1.8, 3.4, 4.2);
    const rimLeft = new THREE.DirectionalLight("#2f7de1", 5);
    rimLeft.position.set(-3.6, 2.6, -2.8);
    const rimRight = new THREE.DirectionalLight("#d6343f", 5);
    rimRight.position.set(3.6, 2.2, -2.8);
    const top = new THREE.SpotLight("#ffffff", 34, 12, 0.6, 0.7, 1.2);
    top.position.set(0, TRUSS_HEIGHT, 0.3);
    top.target.position.set(0, 0, 0);
    object.add(hemi, key, rimLeft, rimRight, top, top.target);

    // --- Backdrop: a dark arena, tinted by the chapter's rim colours. -------------------------
    const backdropUniforms = { uLeft: { value: new THREE.Color() }, uRight: { value: new THREE.Color() }, uLights: { value: 0 } };
    const backdrop = new THREE.Mesh(
        own(new THREE.SphereGeometry(60, 48, 24)),
        own(
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                depthWrite: false,
                uniforms: backdropUniforms,
                vertexShader: /* glsl */ `
                    varying vec3 vDirection;
                    void main() {
                        vDirection = normalize(position);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: /* glsl */ `
                    varying vec3 vDirection;
                    uniform vec3 uLeft;
                    uniform vec3 uRight;
                    uniform float uLights;
                    void main() {
                        // Haze glowing under the roof lights, fading to black in the stands.
                        vec3 base = mix(vec3(0.008, 0.009, 0.012), vec3(0.03, 0.033, 0.042), smoothstep(-0.05, 0.5, vDirection.y));
                        float glowLeft = pow(max(0.0, dot(vDirection, normalize(vec3(-0.8, 0.2, -0.55)))), 5.0);
                        float glowRight = pow(max(0.0, dot(vDirection, normalize(vec3(0.8, 0.2, -0.55)))), 5.0);
                        gl_FragColor = vec4(base + (uLeft * glowLeft + uRight * glowRight) * 0.08 * uLights, 1.0);
                    }`,
            }),
        ),
    );
    backdrop.renderOrder = -2;

    const dark = own(new THREE.MeshStandardMaterial({ color: "#0b0c0f", roughness: 0.92 }));
    const rubber = own(new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.62 }));

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

    // --- The mat: painted canvas with the octagon mark, corners and the wordmark. ---------------
    const matTexture = own(createMatTexture());
    const matGeometry = own(new THREE.ShapeGeometry(octagonShape(CIRCUMRADIUS), 1));
    const matUv = matGeometry.getAttribute("uv") as THREE.BufferAttribute;
    const matPosition = matGeometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < matUv.count; i++) {
        // Shape x → world x, shape y → world −z after the rotation below.
        matUv.setXY(i, matPosition.getX(i) / MAT_SPAN + 0.5, matPosition.getY(i) / MAT_SPAN + 0.5);
    }
    const mat = new THREE.Mesh(matGeometry, own(new THREE.MeshStandardMaterial({ map: matTexture, roughness: 0.95, metalness: 0 })));
    mat.rotation.x = -Math.PI / 2;

    // Soft contact shadow under the fighter's feet.
    const shadow = new THREE.Mesh(
        own(new THREE.PlaneGeometry(1.5, 0.8)),
        own(new THREE.MeshBasicMaterial({ map: own(radialTexture("rgba(0,0,0,0.75)")), transparent: true, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(-0.04, 0.004, 0.05);

    // --- Fence: eight chain-link panels, each with a padded base carrying an LED strip. ---------
    const fenceUniforms = { uStrips: { value: 0 }, uLights: { value: 0 }, uGlint: { value: new THREE.Color() } };
    const fenceGeometry = own(new THREE.PlaneGeometry(SIDE_LENGTH, CAGE.fenceHeight));
    fenceGeometry.translate(0, CAGE.fenceHeight / 2, 0);
    const railGeometry = own(new THREE.CylinderGeometry(0.075, 0.075, SIDE_LENGTH, 16));
    const fence = new THREE.Group();
    for (let side = 0; side < 8; side++) {
        const angle = Math.PI / 2 + (side * Math.PI) / 4;
        // Red corner on the left, blue on the right, white front and back, as in the logo.
        const strip = side === 0 || side === 4 ? WHITE : side < 4 ? RED : BLUE;
        const material = own(
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                uniforms: { ...fenceUniforms, uStrip: { value: strip } },
                vertexShader: /* glsl */ `
                    varying vec2 vPos;
                    void main() {
                        vPos = position.xy;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: /* glsl */ `
                    varying vec2 vPos;
                    uniform vec3 uStrip;
                    uniform float uStrips;
                    uniform float uLights;
                    uniform vec3 uGlint;
                    void main() {
                        if (vPos.y < 0.18) {
                            float led = exp(-pow((vPos.y - 0.155) * 80.0, 2.0));
                            gl_FragColor = vec4(vec3(0.02, 0.021, 0.025) * (0.4 + uLights) + uStrip * led * 2.6 * uStrips, 1.0);
                            return;
                        }
                        // Diamond chain-link: wires along both diagonals of a 7 cm cell.
                        vec2 cell = vPos / 0.07;
                        vec2 diagonal = vec2(cell.x + cell.y, cell.x - cell.y);
                        vec2 toWire = 0.5 - abs(fract(diagonal) - 0.5);
                        float wireDistance = min(toWire.x, toWire.y);
                        float aa = length(fwidth(diagonal));
                        float wire = 1.0 - smoothstep(0.055, 0.055 + aa, wireDistance);
                        // Far away the mesh averages to a translucent grey instead of shimmering.
                        float coverage = mix(wire, 0.2, smoothstep(0.35, 0.8, aa));
                        float fromTop = smoothstep(0.2, 1.85, vPos.y);
                        vec3 color = (vec3(0.06, 0.064, 0.074) * (0.35 + fromTop) + uGlint * 0.1) * uLights;
                        gl_FragColor = vec4(color, coverage * 0.95);
                    }`,
            }),
        );
        const panel = new THREE.Mesh(fenceGeometry, material);
        panel.position.set(Math.cos(angle) * CAGE.apothem, 0, Math.sin(angle) * CAGE.apothem);
        panel.rotation.y = Math.PI / 2 - angle;
        panel.renderOrder = 2;

        const rail = new THREE.Mesh(railGeometry, rubber);
        rail.rotation.z = Math.PI / 2;
        rail.position.y = CAGE.fenceHeight + 0.04;
        panel.add(rail);
        fence.add(panel);
    }
    const postGeometry = own(new THREE.CylinderGeometry(0.12, 0.13, CAGE.fenceHeight + 0.14, 20));
    postGeometry.translate(0, (CAGE.fenceHeight + 0.14) / 2, 0);
    const redPad = own(new THREE.MeshStandardMaterial({ color: "#7e1b22", roughness: 0.6 }));
    const bluePad = own(new THREE.MeshStandardMaterial({ color: "#1b4589", roughness: 0.6 }));
    for (let k = 0; k < 8; k++) {
        const point = corner(k);
        // The red and blue corners are the back-left and back-right posts.
        const post = new THREE.Mesh(postGeometry, k === 4 ? redPad : k === 7 ? bluePad : rubber);
        post.position.set(point.x, 0, point.y);
        fence.add(post);
    }

    // --- Overhead rig: an octagon truss with eight fixtures glowing down at the cage. ----------
    const truss = new THREE.Group();
    const trussMaterial = own(new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.5, metalness: 0.6 }));
    const beamGeometry = own(new THREE.BoxGeometry(2 * 3.6 * Math.tan(Math.PI / 8) * 1.08, 0.16, 0.16));
    const lensMaterial = own(
        new THREE.SpriteMaterial({ map: own(radialTexture("rgba(255,255,255,1)")), color: "#fff3e6", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
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
    const coneUniforms = { uStrength: { value: 0 }, uColor: { value: new THREE.Color(0.75, 0.82, 1) } };
    const cone = new THREE.Mesh(
        own(new THREE.CylinderGeometry(0.15, 2.1, TRUSS_HEIGHT - 0.2, 64, 1, true)),
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
                        float glow = pow(vFacing, 3.0) * smoothstep(0.0, 0.5, vHeight) * (1.0 - smoothstep(0.88, 1.0, vHeight));
                        gl_FragColor = vec4(uColor * glow * 0.05 * uStrength, 1.0);
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
        own(new THREE.MeshBasicMaterial({ map: poolTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })),
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
                            float glow = pow(vFacing, 3.0) * smoothstep(0.0, 0.2, vHeight) * (1.0 - smoothstep(0.4, 1.0, vHeight));
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

    // --- Crowd: dim silhouettes in rising tiers, a few phone lights twinkling. ----------------
    let crowdPoints: { points: THREE.Points; material: THREE.ShaderMaterial } | null = null;
    if (crowd > 0) {
        const random = seededRandom(2026);
        const positions = new Float32Array(crowd * 3);
        const seeds = new Float32Array(crowd);
        const tints = new Float32Array(crowd * 3);
        for (let i = 0; i < crowd; i++) {
            const angle = random() * Math.PI * 2;
            const radius = 10 + random() * 16;
            positions.set([Math.cos(angle) * radius, -PLATFORM_DROP + (radius - 10) * 0.55 + random() * 0.4, Math.sin(angle) * radius], i * 3);
            seeds[i] = random();
            const warm = 0.5 + random() * 0.5;
            tints.set([warm, 0.75 + random() * 0.2, 1.1 - warm * 0.4], i * 3);
        }
        const geometry = own(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
        geometry.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));
        const material = own(
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { uTime: { value: 0 }, uLights: { value: 0 } },
                vertexShader: /* glsl */ `
                    attribute float aSeed;
                    attribute vec3 aTint;
                    uniform float uTime;
                    varying vec3 vColor;
                    void main() {
                        vec4 view = modelViewMatrix * vec4(position, 1.0);
                        bool phone = aSeed > 0.985;
                        float flicker = phone ? 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 90.0) : 1.0;
                        vColor = phone ? vec3(1.0, 0.95, 0.88) * 0.7 * flicker : aTint * 0.028;
                        gl_PointSize = (phone ? 5.0 : 30.0 + aSeed * 30.0) * (6.0 / -view.z);
                        gl_Position = projectionMatrix * view;
                    }`,
                fragmentShader: /* glsl */ `
                    varying vec3 vColor;
                    uniform float uLights;
                    void main() {
                        float d = length(gl_PointCoord - 0.5);
                        gl_FragColor = vec4(vColor * smoothstep(0.5, 0.1, d) * (0.3 + 0.7 * uLights), 1.0);
                    }`,
            }),
        );
        crowdPoints = { points: new THREE.Points(geometry, material), material };
        crowdPoints.points.frustumCulled = false;
    }

    // --- Haze: dust drifting up through the top light, inside the cage. ------------------------
    let particles: { points: THREE.Points; material: THREE.ShaderMaterial; speeds: Float32Array } | null = null;
    if (dust > 0) {
        const random = seededRandom(1337);
        const positions = new Float32Array(dust * 3);
        const seeds = new Float32Array(dust);
        const speeds = new Float32Array(dust);
        for (let i = 0; i < dust; i++) {
            const angle = random() * Math.PI * 2;
            const radius = Math.sqrt(random()) * 3.6;
            positions.set([Math.cos(angle) * radius, random() * 4.2, Math.sin(angle) * radius], i * 3);
            seeds[i] = random();
            speeds[i] = 0.02 + random() * 0.06;
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
                    varying float vTwinkle;
                    varying float vInCone;
                    void main() {
                        vec4 view = modelViewMatrix * vec4(position, 1.0);
                        vTwinkle = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed * 1.6) + aSeed * 40.0);
                        vInCone = exp(-dot(position.xz, position.xz) * 0.7);
                        gl_PointSize = (2.0 + aSeed * 3.0) * (4.0 / -view.z);
                        gl_Position = projectionMatrix * view;
                    }`,
                fragmentShader: /* glsl */ `
                    varying float vTwinkle;
                    varying float vInCone;
                    uniform float uLights;
                    void main() {
                        float d = length(gl_PointCoord - 0.5);
                        gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * smoothstep(0.5, 0.0, d) * vTwinkle * (0.1 + vInCone * 0.55) * uLights, 1.0);
                    }`,
            }),
        );
        particles = { points: new THREE.Points(geometry, material), material, speeds };
        particles.points.frustumCulled = false;
    }

    object.add(backdrop, venueFloor, apron, skirt, mat, shadow, fence, truss, cone, beams);
    if (crowdPoints) object.add(crowdPoints.points);
    if (particles) object.add(particles.points);

    return {
        object,
        update(frame, time, delta) {
            const lights = frame.lights;
            left.setRGB(...frame.rim.left);
            right.setRGB(...frame.rim.right);
            rimLeft.color.copy(left);
            rimRight.color.copy(right);
            rimLeft.intensity = 5.5 * frame.rim.strength * lights;
            rimRight.intensity = 5.5 * frame.rim.strength * lights;
            key.intensity = 0.9 * lights * (1 - frame.xray * 0.7);
            hemi.intensity = 0.06 + 0.16 * lights;
            top.intensity = 34 * lights * (1 - frame.xray * 0.55) * (1 - frame.beams * 0.35);
            poolMaterials.forEach((material) => (material.opacity = 0.55 * frame.beams * lights));
            backdropUniforms.uLeft.value.copy(left);
            backdropUniforms.uRight.value.copy(right);
            backdropUniforms.uLights.value = lights;
            fenceUniforms.uStrips.value = frame.strips;
            fenceUniforms.uLights.value = lights;
            fenceUniforms.uGlint.value.copy(left).lerp(right, 0.5);
            coneUniforms.uStrength.value = lights * (1 - frame.beams * 0.6);
            beamUniforms.forEach((uniforms) => (uniforms.uStrength.value = frame.beams * lights));
            beams.visible = frame.beams > 0.001;
            lensMaterial.opacity = 0.35 + 0.65 * lights;
            if (crowdPoints) {
                crowdPoints.material.uniforms.uTime.value = time;
                crowdPoints.material.uniforms.uLights.value = lights;
            }
            if (particles) {
                particles.material.uniforms.uTime.value = time;
                particles.material.uniforms.uLights.value = lights;
                const attribute = particles.points.geometry.getAttribute("position") as THREE.BufferAttribute;
                for (let i = 0; i < particles.speeds.length; i++) {
                    const y = attribute.getY(i) + particles.speeds[i] * delta;
                    attribute.setY(i, y > 4.2 ? 0 : y);
                }
                attribute.needsUpdate = true;
            }
        },
        dispose() {
            for (const resource of disposables) resource.dispose();
        },
    };
}

/** Painted canvas mat, drawn once: worn charcoal canvas, the octagon mark, corners and wordmark. */
function createMatTexture(): THREE.CanvasTexture {
    const size = 2048;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const c = canvas.getContext("2d");
    if (c) {
        const toPx = (metres: number) => (metres / MAT_SPAN) * size;
        // World (x, z) → canvas; the camera looks from +z, so +z is the bottom of the canvas.
        const at = (x: number, z: number): [number, number] => [size / 2 + toPx(x), size / 2 + toPx(z)];
        const random = seededRandom(7);

        c.fillStyle = "#15171b";
        c.fillRect(0, 0, size, size);
        // Canvas grain and scuffs.
        for (let i = 0; i < 60000; i++) {
            const light = random() > 0.5;
            c.fillStyle = light ? `rgba(255,255,255,${random() * 0.035})` : `rgba(0,0,0,${random() * 0.06})`;
            c.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
        }
        for (let i = 0; i < 26; i++) {
            const [x, y] = [random() * size, random() * size];
            const radius = 60 + random() * 260;
            const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.08)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            c.fillStyle = gradient;
            c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }

        const octagon = (radius: number) => {
            c.beginPath();
            for (let k = 0; k < 8; k++) {
                const point = corner(k, radius);
                const [x, y] = at(point.x, point.y);
                if (k === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
            }
            c.closePath();
        };

        // Inner boundary line.
        c.strokeStyle = "rgba(235,240,250,0.1)";
        c.lineWidth = toPx(0.05);
        octagon(CIRCUMRADIUS - 0.45);
        c.stroke();

        // Red and blue corners: painted wedges at the back-left and back-right posts.
        for (const [k, color] of [
            [4, "rgba(214,52,63,0.4)"],
            [7, "rgba(47,125,225,0.4)"],
        ] as const) {
            const tip = corner(k);
            const a = corner(k - 1).lerp(tip, 0.72);
            const b = corner(k + 1).lerp(tip, 0.72);
            c.fillStyle = color;
            c.beginPath();
            c.moveTo(...at(tip.x, tip.y));
            c.lineTo(...at(a.x, a.y));
            c.lineTo(...at(b.x, b.y));
            c.closePath();
            c.fill();
        }

        // The octagon mark in the centre: red left half, blue right half, white inner octagon.
        c.save();
        c.globalAlpha = 0.5;
        octagon(1.15);
        c.fillStyle = "#15171b";
        c.fill();
        c.lineWidth = toPx(0.12);
        for (const [x, color] of [
            [0, "#d6343f"],
            [size / 2, "#2f7de1"],
        ] as const) {
            c.save();
            c.beginPath();
            c.rect(x, 0, size / 2, size);
            c.clip();
            c.strokeStyle = color;
            octagon(1.15);
            c.stroke();
            c.restore();
        }
        c.strokeStyle = "rgba(255,255,255,0.5)";
        c.lineWidth = toPx(0.06);
        octagon(0.62);
        c.stroke();
        c.restore();

        // Wordmark in front of and behind the mark, both reading from the main camera side.
        c.fillStyle = "rgba(235,240,250,0.14)";
        c.font = `700 ${toPx(0.42)}px ui-sans-serif, system-ui, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("MMA-TMS", ...at(0, 2.35));
        c.fillText("MMA-TMS", ...at(0, -2.35));
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function radialTexture(center: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d");
    if (c) {
        const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, center);
        gradient.addColorStop(0.35, center.replace(/[\d.]+\)$/, "0.35)"));
        gradient.addColorStop(1, center.replace(/[\d.]+\)$/, "0)"));
        c.fillStyle = gradient;
        c.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/** Deterministic pseudo-random numbers, so the crowd and the mat look the same on every visit. */
function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
