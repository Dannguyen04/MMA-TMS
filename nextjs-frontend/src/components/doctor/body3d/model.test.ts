import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BODY_MODEL, FEMALE_BODY_MODEL, doctorBodyFor } from "./model";

const publicFile = (url: string) => readFileSync(fileURLToPath(new URL(`../../../../public${url}`, import.meta.url)));

/** Vertex count of a GLB's first primitive, from its JSON chunk. */
function vertexCount(glb: Buffer): number {
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
    return json.accessors[json.meshes[0].primitives[0].attributes.POSITION].count;
}

describe("doctor body models", () => {
    it("picks the female body for women and the male one otherwise", () => {
        expect(doctorBodyFor("female")).toBe(FEMALE_BODY_MODEL);
        expect(doctorBodyFor("male")).toBe(BODY_MODEL);
        expect(doctorBodyFor(null)).toBe(BODY_MODEL);
    });

    it("bakes the female region fields into the male file's slots", () => {
        expect(Object.keys(FEMALE_BODY_MODEL.meta.regions)).toEqual(Object.keys(BODY_MODEL.meta.regions));
        for (const [name, region] of Object.entries(BODY_MODEL.meta.regions)) {
            expect(FEMALE_BODY_MODEL.meta.regions[name]).toMatchObject({ slot: region.slot, ch: region.ch });
        }
        expect(FEMALE_BODY_MODEL.meta.mask).toEqual(BODY_MODEL.meta.mask);
        expect(Object.keys(FEMALE_BODY_MODEL.extras)).toEqual(Object.keys(BODY_MODEL.extras));
    });

    it("has one field value per vertex and channel, each region starting from its seeds", () => {
        const count = vertexCount(publicFile(FEMALE_BODY_MODEL.url));
        const fields = publicFile(FEMALE_BODY_MODEL.fields!);
        expect(fields.length).toBe(count * 16);
        const channel = (slot: number, ch: number) => Array.from({ length: count }, (_, i) => fields[slot * count * 4 + i * 4 + ch]);
        for (const [name, region] of Object.entries(FEMALE_BODY_MODEL.meta.regions)) {
            const values = channel(region.slot, region.ch);
            // Seeds sit at 0; most of the body is beyond DMAX (255), so a region stays local.
            expect(Math.min(...values), name).toBe(0);
            expect(values.filter((v) => v === 255).length / count, name).toBeGreaterThan(0.6);
        }
    });
});
