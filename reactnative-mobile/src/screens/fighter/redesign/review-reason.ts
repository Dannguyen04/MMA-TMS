export const REVIEW_REASON_MAX = 2000;

export type ReviewReasonIssue = "empty" | "tooLong" | null;

/** Whitespace-only is invalid. Length is counted after trim, matching the submitted payload. */
export function reviewReasonIssue(value: string): ReviewReasonIssue {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > REVIEW_REASON_MAX) return "tooLong";
  return null;
}

export function canSubmitReviewReason(value: string, sending: boolean): boolean {
  return !sending && reviewReasonIssue(value) === null;
}
