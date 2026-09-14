"use client";

import { createContext, useContext } from "react";

import type { ActionState } from "@/lib/actions/state";

/** Review capabilities shared by the workspace panels (only coaches with ai_findings:review can review). */
export interface ReviewContextValue {
    canReview: boolean;
    analysisId: string;
    /**
     * Applies the decision optimistically, saves it and returns the result. The result is also reported with a
     * toast unless `report` is false — dialogs pass false and report after closing, since a toast behind an
     * open modal is inert and never announced.
     */
    submitFindingReview: (formData: FormData, options?: SubmitReviewOptions) => Promise<ActionState<unknown>>;
    submitDetectionReview: (formData: FormData, options?: SubmitReviewOptions) => Promise<ActionState<unknown>>;
}

export interface SubmitReviewOptions {
    report?: boolean;
}

export const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview(): ReviewContextValue {
    const value = useContext(ReviewContext);
    if (!value) throw new Error("useReview must be used inside the analysis workspace.");
    return value;
}
