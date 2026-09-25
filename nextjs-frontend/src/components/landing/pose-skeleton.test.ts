import { describe, expect, it } from "vitest";

import { BONES, FIGHTER_IMAGE, jointAngle, KEYPOINT_NAMES, KEYPOINTS, LEFT_KNEE_ANGLE, pixelToModel } from "./pose-skeleton";

describe("pose skeleton", () => {
    it("has the 17 COCO keypoints, all on the fighter", () => {
        expect(KEYPOINTS).toHaveLength(17);
        expect(KEYPOINT_NAMES).toHaveLength(17);
        for (const [x, y, z] of KEYPOINTS) {
            expect(Math.abs(x)).toBeLessThan(0.6);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(1.72);
            expect(z).toBe(0);
        }
    });

    it("maps the image so the soles stand on the floor and the fighter's left is +X", () => {
        expect(pixelToModel(FIGHTER_IMAGE.centerX, FIGHTER_IMAGE.feetY)).toEqual([0, 0, 0]);
        const [leftShoulder, rightShoulder] = [KEYPOINTS[5], KEYPOINTS[6]];
        expect(leftShoulder[0]).toBeGreaterThan(rightShoulder[0]);
    });

    it("stacks the body from head to ankles on each side", () => {
        const height = (index: number) => KEYPOINTS[index][1];
        for (const side of [0, 1]) {
            expect(height(1 + side)).toBeGreaterThan(height(5 + side));
            expect(height(5 + side)).toBeGreaterThan(height(11 + side));
            expect(height(11 + side)).toBeGreaterThan(height(13 + side));
            expect(height(13 + side)).toBeGreaterThan(height(15 + side));
        }
    });

    it("connects every keypoint with valid bones", () => {
        const used = new Set(BONES.flat());
        expect(used.size).toBe(17);
        for (const [a, b] of BONES) {
            expect(a).not.toBe(b);
            expect(KEYPOINTS[a]).toBeDefined();
            expect(KEYPOINTS[b]).toBeDefined();
        }
    });

    it("measures joint angles in degrees", () => {
        expect(jointAngle([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90);
        expect(jointAngle([1, 0, 0], [0, 0, 0], [-1, 0, 0])).toBeCloseTo(180);
        expect(jointAngle([0, 0, 0], [0, 0, 0], [1, 0, 0])).toBe(0);
        // A bent-knee fighting stance, not a locked leg.
        expect(LEFT_KNEE_ANGLE).toBeGreaterThan(140);
        expect(LEFT_KNEE_ANGLE).toBeLessThan(170);
    });
});
