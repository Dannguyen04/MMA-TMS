import { isApiError, MEDICAL_GATE_CODE } from "@/api/errors";
import { vi } from "@/i18n/vi";

/** Maps Nest `error.code` / HTTP status to everyday copy. Never show codes to the user. */
export function mapApiMessage(error: unknown): string {
  if (!isApiError(error)) {
    console.warn("[auth]", "UNKNOWN", error);
    return vi.api.generic;
  }

  console.warn("[auth]", error.code, error.status);

  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return vi.api.invalidCredentials;
    case "UNAUTHORIZED":
      return vi.api.sessionExpired;
    case "FORBIDDEN":
    case "MEDICAL_ACCESS_DENIED":
      return vi.api.forbidden;
    case "REGISTRATION_CONFLICT":
      return vi.api.registrationConflict;
    case MEDICAL_GATE_CODE:
      return vi.api.medicalGate;
    case "INVALID_SESSION_STATUS_TRANSITION":
    case "INVALID_PLAN_STATUS_TRANSITION":
      return vi.api.invalidTransition;
    case "INVALID_SESSION_PLAN":
    case "FIGHTER_PLAN_MISMATCH":
    case "INVALID_SESSION_PLAN_REFERENCE":
      return vi.api.sessionPlanInvalid;
    case "FIGHTER_APPLICATION_ALREADY_OPEN":
      return vi.api.applicationAlreadyOpen;
    case "FIGHTER_APPLICATION_STATE_CONFLICT":
      return vi.api.applicationStateConflict;
    case "FIGHTER_APPLICATION_ASSESSMENT_EXISTS":
      return vi.api.assessmentExists;
    case "VALIDATION_ERROR":
      return vi.api.validation;
    case "TOO_MANY_REQUESTS":
      return vi.api.tooManyRequests;
    case "NETWORK_ERROR":
      return vi.api.network;
    case "AUTH_PROVIDER_UNAVAILABLE":
      return vi.api.unavailable;
    case "REGISTRATION_FAILED":
      return vi.api.generic;
    case "RESET_TOKEN_INVALID":
      return vi.api.resetTokenInvalid;
    case "RESET_PASSWORD_SAME_AS_CURRENT":
      return vi.api.resetSamePassword;
    case "RESET_PASSWORD_TOO_WEAK":
      return vi.api.resetTooWeak;
    case "RESET_PASSWORD_IN_PROGRESS":
      return vi.api.resetInProgress;
    case "RESET_PASSWORD_PROVIDER_FAILED":
      return vi.api.unavailable;
    case "RESET_PASSWORD_CONFIRMATION_FAILED":
      return vi.api.generic;
    default:
      if (error.status === 422) return vi.api.validation;
      if (error.status === 429) return vi.api.tooManyRequests;
      if (error.status === 401) return vi.api.sessionExpired;
      if (error.status === 403) return vi.api.forbidden;
      if (error.status === 404) return vi.api.notFound;
      if (error.status === 409) return vi.api.conflict;
      return vi.api.generic;
  }
}
