// Bakes the doctor body map's region fields for the female model, the same data the male model carries in its
// _GEO0–_GEO3 attributes (see src/components/doctor/body3d/materials.ts):
//   - 13 joint regions: geodesic distance along the surface from the region's seed vertices, divided by DMAX
//     (0.15 × height) and stored as a byte, 255 beyond DMAX;
//   - a groin mask (1 = no joint paint there), so the hip regions do not run across the crotch.
// Slots and channels follow the male regions-v6e.json, so one shader serves both models.
//
// The female file merges the body with a separate outfit (shorts, top). Outfit vertices are bridged to their
// nearest body vertex, so a region reaches the cloth over the skin under it.
//
// Usage: node scripts/bake-female-regions.mjs
// Writes public/models/fighter-body-female.regions.bin (four Uint8 VEC4 blocks, _GEO0 then _GEO1 …) and
// src/components/doctor/body3d/regions-female.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const MODEL = root("public/models/fighter-body-female.glb");
const OUT_BIN = root("public/models/fighter-body-female.regions.bin");
const OUT_META = root("src/components/doctor/body3d/regions-female.json");
const MALE_META = JSON.parse(readFileSync(root("src/components/doctor/body3d/regions-v6e.json"), "utf8"));

// ---- read the GLB (plain float positions and normals, as the app writes it) ----
function readGlb(file) {
    const buf = readFileSync(file);
    const jsonLength = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
    const binStart = 20 + jsonLength + 8;
    const accessor = (index) => {
        const a = json.accessors[index];
        const view = json.bufferViews[a.bufferView];
        const offset = binStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
        const size = { SCALAR: 1, VEC3: 3 }[a.type];
        const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
        if (!Type || !size || view.byteStride) throw new Error(`Unsupported accessor ${index}`);
        const bytes = buf.subarray(offset, offset + a.count * size * Type.BYTES_PER_ELEMENT);
        return new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    };
    const primitive = json.meshes[0].primitives[0];
    return { position: accessor(primitive.attributes.POSITION), normal: accessor(primitive.attributes.NORMAL), index: accessor(primitive.indices) };
}

const { position: P, normal: N, index: T } = readGlb(MODEL);
const n = P.length / 3;
const px = (i) => P[i * 3];
const py = (i) => P[i * 3 + 1];
const pz = (i) => P[i * 3 + 2];
const dist = (i, j) => Math.hypot(px(i) - px(j), py(i) - py(j), pz(i) - pz(j));

let minY = Infinity;
let maxY = -Infinity;
for (let i = 0; i < n; i++) {
    minY = Math.min(minY, py(i));
    maxY = Math.max(maxY, py(i));
}
const H = maxY - minY;
const DMAX = 0.15 * H;

// ---- body = the largest connected piece; the rest is the outfit ----
const parent = Int32Array.from({ length: n }, (_, i) => i);
const find = (x) => {
    while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
    }
    return x;
};
for (let t = 0; t < T.length; t += 3) {
    for (const [a, b] of [[T[t], T[t + 1]], [T[t + 1], T[t + 2]]]) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[ra] = rb;
    }
}
const sizes = new Map();
for (let i = 0; i < n; i++) sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1);
const bodyRoot = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];
const isBody = Uint8Array.from({ length: n }, (_, i) => (find(i) === bodyRoot ? 1 : 0));

// ---- graph: mesh edges plus outfit → nearest body vertex bridges ----
const edges = new Map();
const addEdge = (a, b, w) => {
    if (a === b) return;
    const key = a < b ? a * n + b : b * n + a;
    if (!edges.has(key)) edges.set(key, [Math.min(a, b), Math.max(a, b), w]);
};
for (let t = 0; t < T.length; t += 3) {
    const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
    addEdge(a, b, dist(a, b));
    addEdge(b, c, dist(b, c));
    addEdge(c, a, dist(c, a));
}
const CELL = 0.03;
const cellKey = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
const grid = new Map();
for (let i = 0; i < n; i++) {
    if (!isBody[i]) continue;
    const k = cellKey(px(i), py(i), pz(i));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
}
let bridges = 0;
for (let i = 0; i < n; i++) {
    if (isBody[i]) continue;
    let best = -1;
    let bestD = Infinity;
    for (let reach = 1; best < 0 && reach <= 3; reach++) {
        const [cx, cy, cz] = [Math.floor(px(i) / CELL), Math.floor(py(i) / CELL), Math.floor(pz(i) / CELL)];
        for (let dx = -reach; dx <= reach; dx++)
            for (let dy = -reach; dy <= reach; dy++)
                for (let dz = -reach; dz <= reach; dz++)
                    for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
                        const d = dist(i, j);
                        if (d < bestD) [best, bestD] = [j, d];
                    }
    }
    if (best >= 0) {
        addEdge(i, best, bestD);
        bridges++;
    }
}
const degree = new Int32Array(n + 1);
for (const [a, b] of edges.values()) {
    degree[a + 1]++;
    degree[b + 1]++;
}
for (let i = 0; i < n; i++) degree[i + 1] += degree[i];
const adj = new Int32Array(degree[n]);
const weight = new Float64Array(degree[n]);
const fill = degree.slice(0, n);
for (const [a, b, w] of edges.values()) {
    adj[fill[a]] = b;
    weight[fill[a]++] = w;
    adj[fill[b]] = a;
    weight[fill[b]++] = w;
}

// ---- Dijkstra from a seed set, stopped at DMAX ----
function geodesic(seeds) {
    const d = new Float64Array(n).fill(Infinity);
    const heap = [];
    const push = (v, k) => {
        heap.push([k, v]);
        let i = heap.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p][0] <= heap[i][0]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]];
                i = m;
            }
        }
        return top;
    };
    for (const s of seeds) {
        d[s] = 0;
        push(s, 0);
    }
    while (heap.length) {
        const [k, v] = pop();
        if (k > d[v] || k > DMAX) continue;
        for (let e = degree[v]; e < degree[v + 1]; e++) {
            const nk = k + weight[e];
            if (nk < d[adj[e]]) {
                d[adj[e]] = nk;
                push(adj[e], nk);
            }
        }
    }
    return d;
}

// ---- seeds ----
const bodyNear = (c, r) => {
    const out = [];
    for (let i = 0; i < n; i++) if (isBody[i] && Math.hypot(px(i) - c[0], py(i) - c[1], pz(i) - c[2]) < r) out.push(i);
    return out;
};
/** The body vertex nearest a point just outside the joint along the region's normal, and its 4 mm neighbours. */
function surfaceSeed(centre, normal, out = 0.1, reach = 0.12) {
    const target = centre.map((c, k) => c + normal[k] * out);
    let best = -1;
    let bestD = Infinity;
    for (const i of bodyNear(centre, reach)) {
        const d = Math.hypot(px(i) - target[0], py(i) - target[1], pz(i) - target[2]);
        if (d < bestD) [best, bestD] = [i, d];
    }
    return bodyNear([px(best), py(best), pz(best)], 0.004);
}
/** The wrist: the thinnest slice of the forearm between elbow and hand; seeds are that whole ring. */
function wristRing(elbow, hand) {
    const axis = hand.map((h, k) => h - elbow[k]);
    const len = Math.hypot(...axis);
    const u = axis.map((a) => a / len);
    let best = null;
    for (let t = 0.45; t <= 0.9; t += 0.01) {
        const c = elbow.map((e, k) => e + axis[k] * t);
        const ring = bodyNear(c, 0.07).filter((i) => Math.abs((px(i) - c[0]) * u[0] + (py(i) - c[1]) * u[1] + (pz(i) - c[2]) * u[2]) < 0.006);
        if (ring.length < 8) continue;
        const radius = ring.reduce((s, i) => s + Math.hypot(px(i) - c[0], py(i) - c[1], pz(i) - c[2]), 0) / ring.length;
        if (!best || radius < best.radius) best = { c, ring, radius };
    }
    const centre = best.ring.reduce((s, i) => [s[0] + px(i), s[1] + py(i), s[2] + pz(i)], [0, 0, 0]).map((v) => v / best.ring.length);
    return { centre, seeds: best.ring };
}

// Joint centres measured on the female model (fighter-3d/body/female-model.ts); +x is the fighter's left.
const SIDE = {
    SHOULDER: [0.18, 1.395, -0.03],
    ELBOW: [0.285, 1.15, -0.03],
    HAND: [0.41, 0.895, 0.032],
    HIP: [0.165, 0.89, 0],
    KNEE: [0.083, 0.53, 0],
    ANKLE: [0.09, 0.085, -0.06],
};
const mirror = ([x, y, z]) => [-x, y, z];
const plan = {};
for (const side of ["L", "R"]) {
    const at = (p) => (side === "L" ? p : mirror(p));
    for (const joint of ["SHOULDER", "ELBOW", "HIP", "KNEE", "ANKLE"]) {
        const name = `${side}_${joint}`;
        const normal = MALE_META.regions[name].normal;
        plan[name] = { centre: at(SIDE[joint]), normal, seeds: surfaceSeed(at(SIDE[joint]), normal, joint === "ANKLE" ? 0.05 : 0.1, joint === "ANKLE" ? 0.07 : 0.12) };
    }
    const wrist = wristRing(at(SIDE.ELBOW), at(SIDE.HAND));
    plan[`${side}_WRIST`] = { centre: wrist.centre, normal: MALE_META.regions[`${side}_WRIST`].normal, seeds: wrist.seeds };
}
// Spine: the back's midline between half and four fifths of the height, as on the male model.
const spineTop = minY + 0.797 * H;
const spineBottom = minY + 0.498 * H;
const spineSeeds = [];
for (let i = 0; i < n; i++) {
    if (isBody[i] && Math.abs(px(i)) < 0.006 && py(i) < minY + 0.778 * H && py(i) > minY + 0.504 * H && N[i * 3 + 2] < -0.5) spineSeeds.push(i);
}
plan.SPINE = { centre: [0, minY + 0.643 * H, 0], normal: MALE_META.regions.SPINE.normal, seeds: spineSeeds };

// ---- bake ----
const channels = Array.from({ length: 16 }, () => new Uint8Array(n).fill(255));
const regions = {};
for (const [name, region] of Object.entries(MALE_META.regions)) {
    const p = plan[name];
    if (!p || p.seeds.length === 0) throw new Error(`No seeds for ${name}`);
    const d = geodesic(p.seeds);
    const ch = channels[region.slot * 4 + region.ch];
    for (let i = 0; i < n; i++) ch[i] = Math.round(Math.min(1, d[i] / DMAX) * 255);
    regions[name] = { slot: region.slot, ch: region.ch, centre: p.centre.map((v) => +v.toFixed(4)), normal: p.normal, seeds: p.seeds.length };
}

// Groin mask, like the male one: full within ±0.065 H of the midline from just below the crotch to 0.1 H above it.
let crotch = Infinity;
for (let i = 0; i < n; i++) if (isBody[i] && Math.abs(px(i)) < 0.01 * H && py(i) > minY + 0.3 * H && py(i) < minY + 0.65 * H) crotch = Math.min(crotch, py(i));
const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
const mask = channels[MALE_META.mask.slot * 4 + MALE_META.mask.ch];
for (let i = 0; i < n; i++) {
    const m = (1 - smooth(0.065 * H, 0.078 * H, Math.abs(px(i)))) * smooth(crotch - 0.026 * H, crotch - 0.012 * H, py(i)) * (1 - smooth(crotch + 0.1 * H, crotch + 0.11 * H, py(i)));
    mask[i] = Math.round(m * 255);
}

const bin = new Uint8Array(n * 16);
for (let slot = 0; slot < 4; slot++) for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) bin[slot * n * 4 + i * 4 + c] = channels[slot * 4 + c][i];
writeFileSync(OUT_BIN, bin);
const meta = { H, minY, DMAX, regions, spine: { y0: +spineTop.toFixed(4), y1: +spineBottom.toFixed(4) }, mask: MALE_META.mask };
writeFileSync(OUT_META, `${JSON.stringify(meta, null, 1)}\n`);
console.log(`vertices ${n}, outfit bridges ${bridges}, crotch y ${crotch.toFixed(3)}`);
for (const [name, r] of Object.entries(regions)) {
    const s = plan[name].seeds[0];
    console.log(name.padEnd(11), "seeds", String(r.seeds).padStart(3), "centre", r.centre.join(", "), "first seed", [px(s), py(s), pz(s)].map((v) => v.toFixed(3)).join(", "));
}
