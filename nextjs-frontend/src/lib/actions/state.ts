import type { ZodError } from "zod";

import type { WriteResult } from "@/lib/domain/write-result";

/**
 * Result shape returned by every Server Action used with useActionState.
 * Expected failures (validation, permissions) are returned, never thrown.
 */
export interface ActionState<T = undefined> {
    status: "idle" | "success" | "error";
    message?: string;
    /** First error message per form field name. */
    fieldErrors?: Record<string, string>;
    data?: T;
}

export const IDLE: ActionState = { status: "idle" };

/** Form-level message when individual fields carry the errors. */
export const FIX_FIELDS = "Please fix the highlighted fields.";

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionState<never> {
    return { status: "error", message, fieldErrors };
}

export function actionSuccess<T = undefined>(message: string, data?: T): ActionState<T> {
    return { status: "success", message, data };
}

/** A service write's outcome as the form's state. */
export function writeResultState(result: WriteResult, successMessage: string): ActionState {
    return result.ok ? actionSuccess(successMessage) : actionError(result.message, result.fieldErrors);
}

export function validationError(error: ZodError, message: string = FIX_FIELDS): ActionState<never> {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message, fieldErrors };
}
