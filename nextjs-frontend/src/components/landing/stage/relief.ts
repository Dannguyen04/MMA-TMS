import * as THREE from "three";

/**
 * Turns the flat fighter cutout into a gentle 2.5D relief. Depth grows smoothly with the distance
 * to the silhouette, so the plane bulges toward the camera and shifts with parallax as the camera
 * moves. No normal map: the photo already carries its own red and blue rim light, and normals
 * derived from a distance field crease along the body's medial axis and show up as a light streak.
 */

export interface Relief {
    /** Height 0–1 in the red channel, for `displacementMap`. */
    depth: THREE.DataTexture;
    /** Height 0–1 at a texture coordinate (v up). */
    sample(u: number, v: number): number;
    dispose(): void;
}

const RESOLUTION = 256;

export function createRelief(image: CanvasImageSource & { width: number; height: number }): Relief {
    const width = RESOLUTION;
    const height = Math.round((RESOLUTION * image.height) / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2D canvas is unavailable.");
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;

    // Squared distance (texels) from every inside pixel to the nearest outside pixel.
    const inside = new Uint8Array(width * height);
    for (let i = 0; i < inside.length; i++) inside[i] = pixels[i * 4 + 3] > 127 ? 1 : 0;
    const distance = euclideanDistance(inside, width, height);

    // Two eased profiles: limbs round off within a few centimetres, the torso keeps filling out.
    const raw = new Float32Array(width * height);
    for (let i = 0; i < raw.length; i++) {
        if (!inside[i]) continue;
        const d = Math.sqrt(distance[i]);
        raw[i] = 0.55 * ease(d / 9) + 0.45 * ease(d / 40);
    }
    // Blur twice: the silhouette edge and the medial-axis ridge both soften out.
    const heightField = blur(blur(raw, width, height), width, height);

    // Textures use WebGL row order: row 0 is the bottom of the image (v = 0).
    const depthData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const h = heightField[y * width + x] * 255;
            depthData.set([h, h, h, 255], ((height - 1 - y) * width + x) * 4);
        }
    }
    const depth = new THREE.DataTexture(depthData, width, height, THREE.RGBAFormat);
    depth.magFilter = THREE.LinearFilter;
    depth.minFilter = THREE.LinearFilter;
    depth.needsUpdate = true;
    const at = (x: number, y: number) => heightField[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];

    return {
        depth,
        sample(u, v) {
            return at(Math.round(u * (width - 1)), Math.round((1 - v) * (height - 1)));
        },
        dispose() {
            depth.dispose();
        },
    };
}

/** Smoothstep profile: leaves the outline gently and flattens out once t ≥ 1. */
function ease(t: number): number {
    const x = Math.min(1, t);
    return x * x * (3 - 2 * x);
}

function blur(source: Float32Array, width: number, height: number): Float32Array {
    const out = new Float32Array(source.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (source[y * width + x] === 0) continue;
            // Only blur inside the body, so the outline stays at zero depth.
            let sum = 0;
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const sx = x + dx;
                    const sy = y + dy;
                    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
                    sum += source[sy * width + sx];
                    count++;
                }
            }
            out[y * width + x] = sum / count;
        }
    }
    return out;
}

/** Exact squared Euclidean distance transform (Felzenszwalb–Huttenlocher), separable by rows and columns. */
function euclideanDistance(inside: Uint8Array, width: number, height: number): Float32Array {
    const INF = 1e20;
    const grid = new Float32Array(width * height);
    for (let i = 0; i < grid.length; i++) grid[i] = inside[i] ? INF : 0;
    const size = Math.max(width, height);
    const f = new Float32Array(size);
    const d = new Float32Array(size);
    const v = new Int32Array(size);
    const z = new Float32Array(size + 1);

    const pass = (length: number, read: (i: number) => number, write: (i: number, value: number) => void) => {
        for (let i = 0; i < length; i++) f[i] = read(i);
        let k = 0;
        v[0] = 0;
        z[0] = -INF;
        z[1] = INF;
        for (let q = 1; q < length; q++) {
            let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            while (s <= z[k]) {
                k--;
                s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
            }
            k++;
            v[k] = q;
            z[k] = s;
            z[k + 1] = INF;
        }
        k = 0;
        for (let q = 0; q < length; q++) {
            while (z[k + 1] < q) k++;
            d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
        }
        for (let i = 0; i < length; i++) write(i, d[i]);
    };

    for (let x = 0; x < width; x++) pass(height, (y) => grid[y * width + x], (y, value) => (grid[y * width + x] = value));
    for (let y = 0; y < height; y++) pass(width, (x) => grid[y * width + x], (x, value) => (grid[y * width + x] = value));
    return grid;
}
