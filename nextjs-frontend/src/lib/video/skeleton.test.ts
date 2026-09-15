import { describe, expect, it } from "vitest";

import type { PoseFrame } from "@/lib/domain/types";
import { indexAtOrBefore, nearestFrame } from "./skeleton";

const frames: PoseFrame[] = [0, 100, 200, 300].map((timeMs) => ({ timeMs, keypoints: [] }));

describe("indexAtOrBefore", () => {
    it("finds the last frame at or before the time", () => {
        expect(indexAtOrBefore(frames, 0)).toBe(0);
        expect(indexAtOrBefore(frames, 150)).toBe(1);
        expect(indexAtOrBefore(frames, 200)).toBe(2);
        expect(indexAtOrBefore(frames, 999)).toBe(3);
    });

    it("returns -1 before the first frame or for an empty list", () => {
        expect(indexAtOrBefore(frames, -1)).toBe(-1);
        expect(indexAtOrBefore([], 100)).toBe(-1);
    });
});

describe("nearestFrame", () => {
    it("picks the closer neighbour and prefers the earlier frame on ties", () => {
        expect(nearestFrame(frames, 140)?.timeMs).toBe(100);
        expect(nearestFrame(frames, 160)?.timeMs).toBe(200);
        expect(nearestFrame(frames, 150)?.timeMs).toBe(100);
    });

    it("clamps to the ends and handles an empty list", () => {
        expect(nearestFrame(frames, -50)?.timeMs).toBe(0);
        expect(nearestFrame(frames, 5000)?.timeMs).toBe(300);
        expect(nearestFrame([], 10)).toBeNull();
    });
});
