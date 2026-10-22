import { withQuery } from "./query";
import {
  MEASUREMENT_READ_PERMISSION,
  MEASUREMENT_READ_ROLES,
  roleMayListTrainingSessions,
  roleMayReadMeasurements,
  roleMayWriteMeasurements,
} from "./role-contracts";
import { videoListPath } from "./media";

describe("measurement role baseline", () => {
  it("keeps GET measurements on the existing fighter route for coach and admin only", () => {
    expect(MEASUREMENT_READ_ROLES).toEqual(["COACH", "ADMIN"]);
    expect(MEASUREMENT_READ_PERMISSION).toBe("fighter.measurement:read");
    expect(roleMayReadMeasurements("FIGHTER")).toBe(false);
    expect(roleMayReadMeasurements("DOCTOR")).toBe(false);
    expect(roleMayReadMeasurements("COACH")).toBe(true);
    expect(roleMayReadMeasurements("ADMIN")).toBe(true);
    expect(roleMayWriteMeasurements("FIGHTER")).toBe(false);
    expect(roleMayWriteMeasurements("COACH")).toBe(false);
    expect(roleMayWriteMeasurements("DOCTOR")).toBe(false);
    expect(roleMayWriteMeasurements("ADMIN")).toBe(true);
    expect(
      withQuery("/fighters/3915bd44-1f5b-49d9-a9e6-7e6865b5d37a/measurements", {
        page: 1,
        limit: 20,
        includeSuperseded: false,
      }),
    ).toBe(
      "/fighters/3915bd44-1f5b-49d9-a9e6-7e6865b5d37a/measurements?page=1&limit=20&includeSuperseded=false",
    );
  });

  it("does not treat a doctor as allowed to list training sessions", () => {
    expect(roleMayListTrainingSessions("DOCTOR")).toBe(false);
    expect(roleMayListTrainingSessions("FIGHTER")).toBe(true);
    expect(roleMayListTrainingSessions("COACH")).toBe(true);
  });
});

describe("video list path", () => {
  it("calls GET /videos with the fighter id query the controller accepts", () => {
    expect(videoListPath({ fighterId: "3915bd44-1f5b-49d9-a9e6-7e6865b5d37a", limit: 50 })).toBe(
      "/videos?fighterId=3915bd44-1f5b-49d9-a9e6-7e6865b5d37a&limit=50",
    );
  });
});
