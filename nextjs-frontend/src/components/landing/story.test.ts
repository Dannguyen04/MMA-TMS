import { describe, expect, it } from "vitest";

import { CAGE, cageReach, CHAPTERS, initialStory, presence, SCAN_BOTTOM, SCAN_TOP, stageAt, type StoryState } from "./story";

function story(overrides: Partial<StoryState> = {}): StoryState {
    return { ...initialStory(), intro: 1, ...overrides };
}

describe("stageAt", () => {
    it("starts far back in the dark and dollies in as the intro plays", () => {
        const dark = stageAt(story({ intro: 0 }));
        const lit = stageAt(story({ intro: 1 }));

        expect(dark.lights).toBe(0);
        expect(dark.strips).toBe(0);
        const reach = (frame: typeof dark) => Math.hypot(...frame.camera.position.map((value, axis) => value - frame.camera.target[axis]));
        expect(reach(dark)).toBeGreaterThan(reach(lit) + 5);
        expect(lit.lights).toBe(1);
        expect(lit.strips).toBe(1);
    });

    it("orbits between chapter framings instead of cutting through the fighter", () => {
        const axisDistance = (position: number) => {
            const { camera } = stageAt(story({ position }));
            return Math.hypot(camera.position[0] - camera.target[0], camera.position[2] - camera.target[2]);
        };
        for (let chapter = 0; chapter < CHAPTERS.length - 1; chapter++) {
            const low = Math.min(axisDistance(chapter), axisDistance(chapter + 1));
            for (let step = 1; step < 10; step++) expect(axisDistance(chapter + step / 10)).toBeGreaterThanOrEqual(low - 0.3);
        }
        expect(stageAt(story({ position: 0.999 })).camera.position[0]).toBeCloseTo(stageAt(story({ position: 1 })).camera.position[0], 2);
    });

    it("keeps the copy side free: the fighter sits right in the hero and left in the analysis chapter", () => {
        const screenSide = (position: number) => {
            const { camera } = stageAt(story({ position }));
            // Sign of the fighter (origin) relative to the camera's right vector.
            const forward = [camera.target[0] - camera.position[0], camera.target[2] - camera.position[2]];
            const right = [-forward[1], forward[0]];
            const toFighter = [-camera.position[0], -camera.position[2]];
            return Math.sign(right[0] * toFighter[0] + right[1] * toFighter[1]);
        };
        expect(screenSide(0)).toBe(1);
        expect(screenSide(1)).toBe(-1);
    });

    it("keeps close shots inside the cage and only ever crosses the fence above its top rail", () => {
        for (const compact of [false, true]) {
            for (let step = 0; step <= 600; step++) {
                const position = (step / 600) * (CHAPTERS.length - 1);
                const [x, y, z] = stageAt(story({ position, compact })).camera.position;
                const reach = cageReach(x, z);
                if (Math.abs(reach - CAGE.apothem) < 0.35) expect(y, `position ${position.toFixed(3)}, compact ${compact}`).toBeGreaterThan(CAGE.fenceHeight + 0.1);
            }
            for (let step = 0; step <= 200; step++) {
                const [x, y, z] = stageAt(story({ intro: step / 200, compact })).camera.position;
                if (Math.abs(cageReach(x, z) - CAGE.apothem) < 0.35) expect(y, `intro ${step / 200}, compact ${compact}`).toBeGreaterThan(CAGE.fenceHeight + 0.1);
            }
            for (const chapter of CHAPTERS.filter((id) => id !== "roles")) {
                const [x, , z] = stageAt(story({ position: CHAPTERS.indexOf(chapter), compact })).camera.position;
                expect(cageReach(x, z), `${chapter}, compact ${compact}`).toBeLessThan(CAGE.apothem - 0.2);
            }
        }
    });

    it("turns the fighter to face the camera", () => {
        for (const position of [0, 1, 2.5, 4]) {
            const { camera } = stageAt(story({ position }));
            const toCamera = Math.atan2(camera.position[0], camera.position[2]);
            expect(Math.abs(camera.facing - toCamera)).toBeLessThanOrEqual(0.3 + 1e-9);
        }
    });

    it("clamps positions outside the story", () => {
        expect(stageAt(story({ position: -3 }))).toEqual(stageAt(story({ position: 0 })));
        expect(stageAt(story({ position: 99 }))).toEqual(stageAt(story({ position: CHAPTERS.length - 1 })));
    });

    it("sweeps the scan from head to feet and reveals the skeleton only in the analysis chapter", () => {
        const start = stageAt(story({ position: 1, local: { ...initialStory().local, analysis: 0 } }));
        const done = stageAt(story({ position: 1, local: { ...initialStory().local, analysis: 1 } }));

        expect(start.scanY).toBeCloseTo(SCAN_TOP);
        expect(done.scanY).toBeCloseTo(SCAN_BOTTOM);
        expect(done.skeleton).toBe(1);
        expect(done.angle).toBe(1);
        expect(stageAt(story({ position: 0 })).skeleton).toBe(0);
        expect(stageAt(story({ position: 3 })).skeleton).toBe(0);
    });

    it("keeps each chapter's effect to its own chapter", () => {
        const local = Object.fromEntries(CHAPTERS.map((id) => [id, 1])) as StoryState["local"];
        const performance = stageAt(story({ position: 3, local }));
        const medicine = stageAt(story({ position: 4, local }));
        const roles = stageAt(story({ position: 5, local }));

        expect(performance.bars).toBe(1);
        expect(performance.xray).toBe(0);
        expect(medicine.xray).toBe(1);
        expect(medicine.focus).toBe(1);
        expect(medicine.bars).toBe(0);
        expect(roles.beams).toBe(1);
        expect(roles.xray).toBe(0);
    });

    it("frames the fighter in the centre on compact layouts", () => {
        const compact = stageAt(story({ compact: true }));
        const wide = stageAt(story({ compact: false }));

        expect(Math.abs(compact.camera.target[0])).toBeLessThan(Math.abs(wide.camera.target[0]));
    });
});

describe("presence", () => {
    it("peaks in its chapter and fades over one chapter", () => {
        expect(presence(2, "training")).toBe(1);
        expect(presence(2.5, "training")).toBe(0.5);
        expect(presence(3, "training")).toBe(0);
        expect(presence(0, "training")).toBe(0);
    });
});
