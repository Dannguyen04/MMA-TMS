/// <reference types="jest" />
import { paintFor } from "./body-3d";
import { MARK_COLOR } from "./body-map";

jest.mock("@/components/body3d/body-canvas", () => ({ __esModule: true, default: () => null }));

describe("paintFor", () => {
  it("paints injuries red over a joint to avoid, and the head after a KO", () => {
    const p = paintFor({ hurt: ["LEFT_ANKLE"], avoid: ["RIGHT_ANKLE", "SPINE_CORE"], head: true });
    expect(p.L_ANKLE.color).toBe(MARK_COLOR.hurt);
    expect(p.R_ANKLE.color).toBe(MARK_COLOR.avoid);
    expect(p.SPINE.core).toBe(0.1);
    expect(p.HEAD.color).toBe(MARK_COLOR.hurt);
    expect(paintFor({ hurt: ["UNKNOWN"], avoid: [], head: false })).toEqual({});
  });
});
