import { ApiError, MEDICAL_GATE_CODE } from "@/api/errors";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";

describe("mapApiMessage", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses registration copy only for REGISTRATION_CONFLICT", () => {
    expect(mapApiMessage(new ApiError(409, "REGISTRATION_CONFLICT", "x"))).toBe(
      vi.api.registrationConflict,
    );
    expect(mapApiMessage(new ApiError(409, "SESSION_STATE_CONFLICT", "x"))).toBe(vi.api.conflict);
    expect(mapApiMessage(new ApiError(409, "SOMETHING_NEW", "x"))).not.toBe(
      vi.api.registrationConflict,
    );
  });

  it("gives the medical gate its own copy", () => {
    expect(mapApiMessage(new ApiError(409, MEDICAL_GATE_CODE, "x", { reasons: [] }))).toBe(
      vi.api.medicalGate,
    );
  });

  it("maps admission conflicts to their own copy", () => {
    expect(mapApiMessage(new ApiError(409, "FIGHTER_APPLICATION_ASSESSMENT_EXISTS", "x"))).toBe(
      vi.api.assessmentExists,
    );
    expect(mapApiMessage(new ApiError(409, "FIGHTER_APPLICATION_STATE_CONFLICT", "x"))).toBe(
      vi.api.applicationStateConflict,
    );
  });

  it("maps access and session codes", () => {
    expect(mapApiMessage(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(vi.api.sessionExpired);
    expect(mapApiMessage(new ApiError(403, "MEDICAL_ACCESS_DENIED", "x"))).toBe(vi.api.forbidden);
    expect(mapApiMessage(new ApiError(404, "SESSION_NOT_FOUND", "x"))).toBe(vi.api.notFound);
    expect(mapApiMessage(new ApiError(400, "INVALID_SESSION_STATUS_TRANSITION", "x"))).toBe(
      vi.api.invalidTransition,
    );
    expect(mapApiMessage(new ApiError(400, "FIGHTER_PLAN_MISMATCH", "x"))).toBe(
      vi.api.sessionPlanInvalid,
    );
  });

  it("keeps existing auth copy", () => {
    expect(mapApiMessage(new ApiError(401, "INVALID_CREDENTIALS", "x"))).toBe(
      vi.api.invalidCredentials,
    );
    expect(mapApiMessage(new Error("offline"))).toBe(vi.api.generic);
  });
});
