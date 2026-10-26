import fixture from "./pose-model.fixture.json";
import { containRect, frameIndexAt, jointAngle, parseWorkerResult, strikeAt } from "./pose-model";

describe("parseWorkerResult", () => {
  const result = parseWorkerResult(fixture)!;

  it("reads meta, poses and the persisted action", () => {
    expect(result.fps).toBe(30);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.frames).toHaveLength(5);
    expect(result.frames[0]!.keypoints).toHaveLength(17);
    expect(result.strikes[0]).toMatchObject({ actionId: "action_001", family: "punch", technique: "cross", side: "right" });
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("hides discontinuous frames instead of drawing a stale pose", () => {
    expect(result.frames[1]!.keypoints).toHaveLength(0);
  });

  it("rejects payloads that are not worker results", () => {
    expect(parseWorkerResult({ frames: [] })).toBeNull();
    expect(parseWorkerResult(null)).toBeNull();
  });

  it("falls back to punches when actions are missing", () => {
    const legacy = parseWorkerResult({ ...fixture, actions: undefined })!;
    expect(legacy.strikes[0]).toMatchObject({ actionId: null, family: "punch", side: "right", guardKept: true });
  });
});

describe("frame lookup", () => {
  const frames = [0, 33, 66, 200].map((timeMs) => ({ timeMs, keypoints: [] }));
  it("picks the nearest pose within 120 ms", () => {
    expect(frameIndexAt(frames, 40)).toBe(1);
    expect(frameIndexAt(frames, 60)).toBe(2);
    expect(frameIndexAt(frames, 140)).toBe(3);
    expect(frameIndexAt(frames, 400)).toBe(-1);
  });
  it("finds the strike under the playhead", () => {
    const s = { startMs: 100, endMs: 300 } as Parameters<typeof strikeAt>[0][number];
    expect(strikeAt([s], 200)).toBe(s);
    expect(strikeAt([s], 301)).toBeNull();
  });
});

describe("geometry", () => {
  it("letterboxes a portrait clip in a landscape box", () => {
    expect(containRect(400, 300, 1080, 1920)).toEqual({ x: 115.625, y: 0, width: 168.75, height: 300 });
  });
  it("measures a right angle", () => {
    expect(Math.round(jointAngle({ x: 0, y: 1, conf: 1 }, { x: 0, y: 0, conf: 1 }, { x: 1, y: 0, conf: 1 }, 1))).toBe(90);
  });
});
