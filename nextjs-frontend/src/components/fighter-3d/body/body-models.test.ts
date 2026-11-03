import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";

import { createMannequinModel } from "./mannequin";
import { muscularModelFrom } from "./muscular-model";
import { MODEL_HEIGHT, SPOT_REGIONS, regionAnchors, regionAt, type BodyModel } from "./regions";

const GLB = fileURLToPath(new URL("../../../../public/models/fighter-body.glb", import.meta.url));

async function loadMuscular(): Promise<BodyModel> {
    const file = readFileSync(GLB);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const gltf = await new GLTFLoader().parseAsync(buffer, "");
    return muscularModelFrom(gltf.scene);
}

function vertices(model: BodyModel): THREE.Vector3[] {
    const position = model.geometry.getAttribute("position");
    return Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i));
}

/** The point of the surface (any triangle) nearest to `target`. */
function closestOnSurface(model: BodyModel, surface: THREE.Vector3[], target: THREE.Vector3): THREE.Vector3 {
    const index = model.geometry.getIndex();
    const corner = (t: number) => surface[index ? index.getX(t) : t];
    const triangle = new THREE.Triangle();
    const candidate = new THREE.Vector3();
    const best = new THREE.Vector3();
    let bestDistance = Infinity;
    const corners = index ? index.count : surface.length;
    for (let t = 0; t < corners; t += 3) {
        triangle.set(corner(t), corner(t + 1), corner(t + 2)).closestPointToPoint(target, candidate);
        const distance = candidate.distanceTo(target);
        if (distance < bestDistance) {
            bestDistance = distance;
            best.copy(candidate);
        }
    }
    return best;
}

describe.each([
    ["mannequin", async () => createMannequinModel()],
    ["muscular", loadMuscular],
] as const)("%s body model", (_name, load) => {
    let model: BodyModel;
    let surface: THREE.Vector3[];
    beforeAll(async () => {
        model = await load();
        surface = vertices(model);
    });

    it("lists its spots in the shader's order", () => {
        expect(model.spots.map((s) => s.region)).toEqual(SPOT_REGIONS);
    });

    it("stands on the floor at the model height", () => {
        const box = new THREE.Box3().setFromPoints(surface);
        expect(box.min.y).toBeCloseTo(0, 2);
        expect(box.max.y).toBeGreaterThan(MODEL_HEIGHT - 0.12);
        expect(box.max.y).toBeLessThan(MODEL_HEIGHT + 0.01);
    });

    it("puts the athlete's left on +X", () => {
        for (const s of model.spots) {
            if (s.region.startsWith("left_")) expect(s.center.x).toBeGreaterThan(0);
            if (s.region.startsWith("right_")) expect(s.center.x).toBeLessThan(0);
        }
    });

    it("keeps the posterior regions behind the midline", () => {
        for (const s of model.spots.filter((s) => s.region === "lower_back" || s.region.endsWith("hamstring"))) {
            expect(s.center.z).toBeLessThan(0);
        }
    });

    it("lights every region on the surface and picks it back from there", () => {
        for (const [region, anchor] of regionAnchors(model.spots)) {
            const closest = closestOnSurface(model, surface, anchor.center);
            // Inside 0.6 of the radius the shader lights the surface at well over half strength.
            expect(closest.distanceTo(anchor.center), `${region} reaches the surface`).toBeLessThan(anchor.radius * 0.6);
            expect(regionAt(model.spots, closest), `${region} picked back`).toBe(region);
        }
    });
});
