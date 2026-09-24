import { describe, expect, it } from "vitest";

import { createFighterController, gestureAction, poseForAction } from "./fighter-motion";

describe("gestureAction", () => {
    it("maps deliberate horizontal and upward gestures to strikes", () => {
        expect(gestureAction(90, 5)).toBe("hook-right");
        expect(gestureAction(-90, 5)).toBe("hook-left");
        expect(gestureAction(4, -80)).toBe("uppercut");
    });

    it("ignores short, downward, and ambiguous gestures", () => {
        expect(gestureAction(6, 5)).toBeNull();
        expect(gestureAction(4, 80)).toBeNull();
        expect(gestureAction(60, -58)).toBeNull();
    });
});

describe("fighter controller", () => {
    it("rejects attacks during cooldown and returns to idle after recovery", () => {
        const controller = createFighterController({ reducedMotion: false, cooldownMs: 500 });

        expect(controller.trigger("jab-cross", 1_000)).toBe(true);
        expect(controller.trigger("uppercut", 1_200)).toBe(false);
        expect(controller.sample(1_450).action).toBe("jab-cross");
        expect(controller.sample(2_200).action).toBe("idle");
        expect(controller.trigger("hook-left", 2_200)).toBe(true);
    });

    it("never starts attacks when reduced motion is requested", () => {
        const controller = createFighterController({ reducedMotion: true, cooldownMs: 500 });

        expect(controller.trigger("uppercut", 1_000)).toBe(false);
        expect(controller.sample(1_500)).toEqual({ action: "idle", progress: 0 });
    });
});

describe("poseForAction", () => {
    it("clamps action progress and keeps values finite", () => {
        const before = poseForAction("uppercut", -1, 0, { x: 0, y: 0 });
        const start = poseForAction("uppercut", 0, 0, { x: 0, y: 0 });
        const after = poseForAction("uppercut", 2, 0, { x: 0, y: 0 });
        const end = poseForAction("uppercut", 1, 0, { x: 0, y: 0 });

        expect(before).toEqual(start);
        expect(after).toEqual(end);
        expect(Object.values(after).flatMap((value) => (Array.isArray(value) ? value : [value])).every(Number.isFinite)).toBe(true);
    });

    it("tracks the pointer subtly only while idle", () => {
        const idle = poseForAction("idle", 0, 0, { x: 1, y: 0 });
        const strike = poseForAction("hook-right", 0.5, 0, { x: 1, y: 0 });

        expect(idle.headYaw).toBeGreaterThan(0);
        expect(Math.abs(strike.headYaw)).toBeLessThan(Math.abs(idle.headYaw));
        expect(strike.impact).toBeGreaterThan(0);
    });
});
