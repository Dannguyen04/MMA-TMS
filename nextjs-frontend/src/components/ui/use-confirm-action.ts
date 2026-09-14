"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { ActionState } from "@/lib/actions/state";

export interface ConfirmActionOptions<P, T> {
    /** Runs after the dialog has closed, so a toast is visible and announced. */
    onSuccess?(state: ActionState<T>, payload: P): void;
    /** Runs when the action fails; the dialog stays open showing the error. */
    onError?(state: ActionState<T>, payload: P): void;
}

export interface ConfirmAction<P> {
    /** What the open confirmation is about; null while closed. */
    payload: P | null;
    /** Opens the confirmation for this payload with no error from an earlier attempt. */
    request(payload: P): void;
    /** Field errors from the last failed attempt, for inputs inside the dialog (e.g. a reason). */
    fieldErrors: Record<string, string>;
    dialogProps: { open: boolean; onClose(): void; onConfirm(): void; pending: boolean; error?: string };
}

function flushSuccess<P, T>(
    succeeded: { current: { state: ActionState<T>; payload: P } | null },
    onSuccess: ConfirmActionOptions<P, T>["onSuccess"],
) {
    const result = succeeded.current;
    succeeded.current = null;
    if (result) onSuccess?.(result.state, result.payload);
}

/**
 * State for a ConfirmDialog that runs an action: errors stay inside the dialog (toasts are hidden behind
 * a modal), a failed attempt keeps it open, and success closes it before `onSuccess` runs.
 */
export function useConfirmAction<P, T = undefined>(
    run: (payload: P) => Promise<ActionState<T>>,
    options: ConfirmActionOptions<P, T> = {},
): ConfirmAction<P> {
    const { onSuccess, onError } = options;
    const [payload, setPayload] = useState<P | null>(null);
    const [failure, setFailure] = useState<ActionState<T> | null>(null);
    const [pending, startConfirm] = useTransition();
    const succeeded = useRef<{ state: ActionState<T>; payload: P } | null>(null);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
    });

    // Report success once the dialog has closed, or when the trigger unmounts because the change removed it.
    useEffect(() => {
        if (payload === null) flushSuccess(succeeded, onSuccessRef.current);
    }, [payload]);
    useEffect(() => () => flushSuccess(succeeded, onSuccessRef.current), []);

    const confirm = () => {
        if (payload === null || pending) return;
        const current = payload;
        startConfirm(async () => {
            const result = await run(current);
            startConfirm(() => {
                if (result.status === "error") {
                    setFailure(result);
                    onError?.(result, current);
                } else {
                    succeeded.current = { state: result, payload: current };
                    setFailure(null);
                    setPayload(null);
                }
            });
        });
    };

    const fieldErrors = failure?.fieldErrors ?? {};
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;

    return {
        payload,
        request: (next) => {
            setFailure(null);
            setPayload(next);
        },
        fieldErrors,
        dialogProps: {
            open: payload !== null,
            onClose: () => {
                if (!pending) setPayload(null);
            },
            onConfirm: confirm,
            pending,
            error: failure && !hasFieldErrors ? (failure.message ?? "That didn't work. Try again.") : undefined,
        },
    };
}
