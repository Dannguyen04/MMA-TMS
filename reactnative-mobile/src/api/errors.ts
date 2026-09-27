export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

type ErrorEnvelope = {
  success?: boolean;
  error?: {
    statusCode?: number;
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export function apiErrorFromBody(status: number, body: unknown): ApiError {
  const envelope = body as ErrorEnvelope;
  const nested = envelope?.error;
  const code =
    typeof nested?.code === "string"
      ? nested.code
      : status === 401
        ? "UNAUTHORIZED"
        : status === 409
          ? "CONFLICT"
          : status === 422
            ? "VALIDATION_ERROR"
            : status === 429
              ? "TOO_MANY_REQUESTS"
              : `HTTP_${status}`;
  const message =
    typeof nested?.message === "string" ? nested.message : "Request failed";
  return new ApiError(status, code, message, nested?.details);
}

export const MEDICAL_GATE_CODE = "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED";

export const MEDICAL_ELIGIBILITY_REASONS = [
  "REVIEW_REQUEST_PENDING",
  "EXAMINATION_NOT_ELIGIBLE",
  "CLEARANCE_REQUIRED",
  "CLEARANCE_EXPIRED",
  "SESSION_TYPE_RESTRICTED",
] as const;
export type MedicalEligibilityReason = (typeof MEDICAL_ELIGIBILITY_REASONS)[number];

/**
 * Reason codes from a 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`
 * (`error.details.reasons`), or null when the error is not the medical gate.
 * Unknown codes are kept so the UI can still show that the gate blocked.
 */
export function medicalGateReasons(error: unknown): string[] | null {
  if (!isApiError(error) || error.code !== MEDICAL_GATE_CODE) return null;
  const details = error.details as { reasons?: unknown } | undefined;
  const raw = details && Array.isArray(details.reasons) ? details.reasons : [];
  return raw.filter((item): item is string => typeof item === "string");
}
