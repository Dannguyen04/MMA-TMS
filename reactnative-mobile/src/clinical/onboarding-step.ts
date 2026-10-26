export type ClinicalStep =
  | "assign-doctor"
  | "baseline-exam"
  | "clearance"
  | "not-eligible"
  | "eligible";

/**
 * Next responsible step from assignment plus the server eligibility object.
 * `eligible: false` with an empty reason list stays blocked.
 * An active doctor is required before a baseline exam is the next step.
 */
export function nextClinicalStep(input: {
  hasActiveDoctor: boolean;
  eligible: boolean;
  reasons: readonly string[];
}): { step: ClinicalStep; reasons: string[] } {
  const reasons = input.reasons.filter((item) => item.length > 0);
  if (!input.hasActiveDoctor) {
    return { step: "assign-doctor", reasons };
  }
  if (reasons.includes("EXAMINATION_REQUIRED")) {
    return { step: "baseline-exam", reasons };
  }
  if (reasons.includes("CLEARANCE_REQUIRED") || reasons.includes("CLEARANCE_EXPIRED")) {
    return { step: "clearance", reasons };
  }
  if (!input.eligible) {
    return { step: "not-eligible", reasons };
  }
  return { step: "eligible", reasons };
}

export type ClearanceFollowUp =
  | { kind: "unconfirmed"; claimEligible: false }
  | { kind: "eligible"; claimEligible: true }
  | { kind: "blocked"; claimEligible: false; reasons: string[] };

/**
 * Clearance POST success is not training eligibility.
 * `eligible` is claimed only after a refetch returns `eligible: true`.
 */
export function clearanceFollowUp(
  eligibility: { eligible: boolean; reasons: readonly string[] } | null | undefined,
): ClearanceFollowUp {
  if (!eligibility || typeof eligibility.eligible !== "boolean") {
    return { kind: "unconfirmed", claimEligible: false };
  }
  if (eligibility.eligible === true) {
    return { kind: "eligible", claimEligible: true };
  }
  return {
    kind: "blocked",
    claimEligible: false,
    reasons: eligibility.reasons.filter((item) => item.length > 0),
  };
}
