import type { ZodError } from "zod";

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

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionState<never> {
    return { status: "error", message, fieldErrors };
}

export function actionSuccess<T = undefined>(message: string, data?: T): ActionState<T> {
    return { status: "success", message, data };
}

export function validationError(error: ZodError): ActionState<never> {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
}
