"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends ButtonProps {
    pendingLabel?: string;
    /** Pending state from the caller (e.g. useActionForm); overrides the parent form's status when provided. */
    pending?: boolean;
}

/** Submit button that shows a pending state while its parent form's action runs. */
export function SubmitButton({ children, pendingLabel, pending: pendingProp, ...props }: SubmitButtonProps) {
    const status = useFormStatus();
    const pending = pendingProp ?? status.pending;
    return (
        <Button type="submit" loading={pending} {...props}>
            {pending && pendingLabel ? pendingLabel : children}
        </Button>
    );
}
