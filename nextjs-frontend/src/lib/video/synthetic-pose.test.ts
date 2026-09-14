import { describe, expect, it } from "vitest";

import type { Detection, MovementEvent, PoseKeypoint } from "@/lib/domain/types";
import { KEYPOINT, KEYPOINT_COUNT } from "./skeleton";
import { buildSyntheticPoseTrack, createSyntheticPoseSampler } from "./synthetic-pose";

function detection(overrides: Partial<Detection>): Detection {
    return {
        id: "det-1",
        type: "jab",
        limb: "left_arm",
        startMs: 2000,
        peakMs: 2150,
        endMs: 2300,
        confidence: 0.88,
        peakSpeed: 7.2,
        accelerationProxy: 6,
        jointAngleDeg: 165,
        hipRotationDeg: 12,
        guardMaintained: true,
        combinationId: null,
        review: null,
        ...overrides,
    };
}

const distance = (a: PoseKeypoint, b: PoseKeypoint) => Math.hypot((a.x - b.x) * (16 / 9), a.y - b.y);

describe("buildSyntheticPoseTrack", () => {
    const analysis = { durationMs: 4000, detections: [detection({})], movementEvents: [] as MovementEvent[] };

    it("produces 17 normalised keypoints per frame at the requested rate", () => {
        const track = buildSyntheticPoseTrack(analysis, "orthodox", 30);
        expect(track).toHaveLength(121);
        expect(track[1].timeMs).toBeCloseTo(33.3, 1);
        for (const frame of track) {
            expect(frame.keypoints).toHaveLength(KEYPOINT_COUNT);
            for (const point of frame.keypoints) {
                expect(point.x).toBeGreaterThanOrEqual(0);
                expect(point.x).toBeLessThanOrEqual(1);
                expect(point.y).toBeGreaterThanOrEqual(0);
                expect(point.y).toBeLessThanOrEqual(1);
                expect(point.conf).toBeGreaterThan(0);
            }
        }
    });

    it("is deterministic", () => {
        expect(buildSyntheticPoseTrack(analysis, "orthodox", 10)).toEqual(buildSyntheticPoseTrack(analysis, "orthodox", 10));
    });

    it("extends the lead wrist away from the shoulder at the jab peak", () => {
        const sample = createSyntheticPoseSampler(analysis, "orthodox", { cameraAngle: "side" });
        const guard = sample(1000).keypoints;
        const peak = sample(2150).keypoints;
        const reach = (points: PoseKeypoint[]) => distance(points[KEYPOINT.leftWrist], points[KEYPOINT.leftShoulder]);
        expect(reach(peak)).toBeGreaterThan(reach(guard) * 1.4);
        expect(sample(2150).activeJoint?.angleDeg).toBeGreaterThan(150);
    });

    it("animates the right arm for a southpaw jab", () => {
        const southpaw = { ...analysis, detections: [detection({ limb: "right_arm" })] };
        const sample = createSyntheticPoseSampler(southpaw, "southpaw", { cameraAngle: "side" });
        const reach = (points: PoseKeypoint[]) => distance(points[KEYPOINT.rightWrist], points[KEYPOINT.rightShoulder]);
        expect(reach(sample(2150).keypoints)).toBeGreaterThan(reach(sample(1000).keypoints) * 1.4);
    });

    it("bends the elbow to the recorded hook angle and chambers the knee on a kick", () => {
        const hookAnalysis = {
            durationMs: 6000,
            detections: [
                detection({ id: "hook", type: "hook", startMs: 1000, peakMs: 1200, endMs: 1400, jointAngleDeg: 100, hipRotationDeg: 40 }),
                detection({ id: "kick", type: "kick", limb: "right_leg", startMs: 3000, peakMs: 3350, endMs: 3700, jointAngleDeg: 160, hipRotationDeg: 70 }),
            ],
            movementEvents: [],
        };
        const sample = createSyntheticPoseSampler(hookAnalysis, "orthodox");
        expect(sample(1200).activeJoint?.angleDeg).toBeGreaterThanOrEqual(95);
        expect(sample(1200).activeJoint?.angleDeg).toBeLessThanOrEqual(105);
        const standing = sample(2500).keypoints[KEYPOINT.rightAnkle];
        const kicking = sample(3350).keypoints[KEYPOINT.rightAnkle];
        expect(kicking.y).toBeLessThan(standing.y - 0.2);
    });

    it("lowers the named hand during a guard drop", () => {
        const withDrop = {
            durationMs: 4000,
            detections: [],
            movementEvents: [{ id: "mv-1", type: "guard_drop" as const, startMs: 1000, endMs: 1800, confidence: 0.8, detail: "Right hand dropped below the chin after the hook" }],
        };
        const sample = createSyntheticPoseSampler(withDrop, "orthodox");
        expect(sample(1400).keypoints[KEYPOINT.rightWrist].y).toBeGreaterThan(sample(600).keypoints[KEYPOINT.rightWrist].y + 0.08);
    });
});
