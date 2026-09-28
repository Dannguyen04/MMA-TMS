import * as THREE from "three";

import { CIRCUMRADIUS, corner, octagonShape } from "./octagon";
import { seededRandom } from "./textures";

/**
 * The canvas mat. A photographed patch of worn black canvas repeats across it for the fine detail
 * (weave, footprints, scratches); over that, one drawing of the whole mat adds what must not
 * repeat: the octagon mark and the red and blue corners printed in muted ink, then broad tonal
 * wear and a trodden centre, so the print sits under the wear rather than on top of it. The centre is
 * polished glossier than the edges, so the top light leaves an uneven sheen on the canvas instead
 * of lighting a flat grey sheet.
 */

/** Seamless photo of the canvas, and how many metres of mat one copy covers. */
export const MAT_TEXTURE = "/images/landing/mat-canvas.webp";
const TILE_METRES = 2.8;
/** The mark drawing covers this square (metres) centred on the cage. */
const MAT_SPAN = CIRCUMRADIUS * 2 + 0.4;
const MARKS_SIZE = 2048;
const ROUGHNESS_SIZE = 512;

export interface Mat {
    mesh: THREE.Mesh;
    dispose(): void;
}

export function createMat(canvas: THREE.Texture): Mat {
    const map = canvas;
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.setScalar(MAT_SPAN / TILE_METRES);
    map.anisotropy = 8;
    map.needsUpdate = true;
    const marks = new THREE.CanvasTexture(drawMarks());
    marks.colorSpace = THREE.SRGBColorSpace;
    marks.anisotropy = 8;
    const roughnessMap = new THREE.CanvasTexture(drawRoughness());

    const geometry = new THREE.ShapeGeometry(octagonShape(CIRCUMRADIUS), 1);
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
        // Shape x → world x, shape y → world −z after the rotation below.
        uv.setXY(i, position.getX(i) / MAT_SPAN + 0.5, position.getY(i) / MAT_SPAN + 0.5);
    }
    // Little of the studio reflection: at grazing angles it would wash the canvas out to grey.
    const material = new THREE.MeshStandardMaterial({ map, roughnessMap, color: new THREE.Color(0.34, 0.34, 0.34), roughness: 1, metalness: 0, envMapIntensity: 0.15 });
    // The marks lie over the repeating canvas, once across the whole mat.
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uMarks = { value: marks };
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec2 vMatUv;")
            .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMatUv = uv;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec2 vMatUv;\nuniform sampler2D uMarks;")
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
vec4 marks = texture2D(uMarks, vMatUv);
diffuseColor.rgb = mix(diffuseColor.rgb, marks.rgb, marks.a);`,
            );
    };
    material.customProgramCacheKey = () => "landing-mat";
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;

    return {
        mesh,
        dispose() {
            geometry.dispose();
            material.dispose();
            marks.dispose();
            roughnessMap.dispose();
        },
    };
}

/** World (x, z) → canvas pixels; the camera looks from +z, so +z is the bottom of the canvas. */
function projector(size: number) {
    const toPx = (metres: number) => (metres / MAT_SPAN) * size;
    const at = (x: number, z: number): [number, number] => [size / 2 + toPx(x), size / 2 + toPx(z)];
    return { toPx, at };
}

/** Print and wear on a transparent sheet; the photographed canvas shows wherever nothing is drawn. */
function drawMarks(): HTMLCanvasElement {
    const size = MARKS_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const c = canvas.getContext("2d");
    if (!c) return canvas;
    const { toPx, at } = projector(size);
    const random = seededRandom(7);

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

    // --- Print: muted ink, worn afterwards. -----------------------------------------------------
    c.strokeStyle = "rgba(235,240,250,0.07)";
    c.lineWidth = toPx(0.04);
    octagon(CIRCUMRADIUS - 0.45);
    c.stroke();

    // Red and blue corners: wedges at the back-left and back-right posts.
    for (const [k, color] of [
        [4, "rgba(170,40,50,0.3)"],
        [7, "rgba(40,95,180,0.3)"],
    ] as const) {
        const tip = corner(k);
        const a = corner(k - 1).lerp(tip, 0.74);
        const b = corner(k + 1).lerp(tip, 0.74);
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(...at(tip.x, tip.y));
        c.lineTo(...at(a.x, a.y));
        c.lineTo(...at(b.x, b.y));
        c.closePath();
        c.fill();
    }

    // The octagon mark in the centre: red left half, blue right half, a pale inner octagon.
    c.save();
    c.globalAlpha = 0.14;
    c.lineWidth = toPx(0.06);
    for (const [x, color] of [
        [0, "#b8323c"],
        [size / 2, "#2c68c0"],
    ] as const) {
        c.save();
        c.beginPath();
        c.rect(x, 0, size / 2, size);
        c.clip();
        c.strokeStyle = color;
        octagon(1.1);
        c.stroke();
        c.restore();
    }
    c.strokeStyle = "rgba(235,240,250,0.3)";
    c.lineWidth = toPx(0.03);
    octagon(0.6);
    c.stroke();
    c.restore();

    // --- Wear. ----------------------------------------------------------------------------------
    // Large, soft tonal variation in the canvas.
    for (let i = 0; i < 30; i++) {
        const [x, y] = [random() * size, random() * size];
        const radius = 80 + random() * 280;
        const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.09)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gradient;
        c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // The trodden centre: dustier and lighter where the fighters move most.
    const [cx, cy] = at(0, 0);
    const trodden = c.createRadialGradient(cx, cy, 0, cx, cy, toPx(3.2));
    trodden.addColorStop(0, "rgba(255,248,240,0.045)");
    trodden.addColorStop(1, "rgba(255,248,240,0)");
    c.fillStyle = trodden;
    c.fillRect(0, 0, size, size);
    return canvas;
}

/** Roughness (green channel): glossy where the canvas is trodden and sweat has dried, matte near the fence. */
function drawRoughness(): HTMLCanvasElement {
    const size = ROUGHNESS_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const c = canvas.getContext("2d");
    if (!c) return canvas;
    const { toPx, at } = projector(size);
    const random = seededRandom(11);

    c.fillStyle = "rgb(228,228,228)";
    c.fillRect(0, 0, size, size);
    const [cx, cy] = at(0, 0);
    const polish = c.createRadialGradient(cx, cy, 0, cx, cy, toPx(3.4));
    polish.addColorStop(0, "rgba(150,150,150,1)");
    polish.addColorStop(1, "rgba(150,150,150,0)");
    c.fillStyle = polish;
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
        const angle = random() * Math.PI * 2;
        const reach = Math.sqrt(random()) * (CIRCUMRADIUS - 0.6);
        const [x, y] = at(Math.cos(angle) * reach, Math.sin(angle) * reach);
        const radius = toPx(0.15 + random() * 0.6);
        const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(120,120,120,${0.3 + random() * 0.5})`);
        gradient.addColorStop(1, "rgba(120,120,120,0)");
        c.fillStyle = gradient;
        c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    return canvas;
}
