"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useT } from "@/components/i18n/locale-provider";
import type { ActionState } from "@/lib/actions/state";
import { Button } from "./button";
import { Dialog, type DialogProps } from "./dialog";
import { FormMessage } from "./form";
import { useActionForm, type ActionForm, type FormAction } from "./use-action-form";

const FIRST_FIELD = "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)";

export interface ActionDialogProps<T> {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    size?: DialogProps["size"];
    action: FormAction<T>;
    initialState?: ActionState<T>;
    submitLabel: ReactNode;
    pendingLabel?: string;
    submitVariant?: "primary" | "danger";
    /** Called after the dialog has closed, so a toast is visible and announced. */
    onSuccess?(state: ActionState<T>): void;
    prepare?(fd: FormData): ActionState<T> | void;
    hiddenFields?: string[];
    children?: (form: ActionForm<T>) => ReactNode;
    /** Hide the default FormMessage when the form handles error display itself. */
    showMessage?: boolean | ((state: ActionState<T>) => boolean);
    submitDisabled?: boolean | ((state: ActionState<T>) => boolean);
}

/**
 * A dialog whose body is one Server Action form, with the standard footer (Cancel + submit).
 * Every opening starts from a clean form; Escape and Cancel are disabled while saving.
 */
export function ActionDialog<T = undefined>(props: ActionDialogProps<T>) {
    const [openCount, setOpenCount] = useState(0);
    const [wasOpen, setWasOpen] = useState(false);
    if (props.open !== wasOpen) {
        setWasOpen(props.open);
        if (props.open) setOpenCount((count) => count + 1);
    }
    return <ActionDialogInstance key={openCount} {...props} />;
}

function ActionDialogInstance<T>({
    open,
    onClose,
    title,
    description,
    size,
    action,
    initialState,
    submitLabel,
    pendingLabel,
    submitVariant = "primary",
    onSuccess,
    prepare,
    hiddenFields,
    children,
    showMessage,
    submitDisabled,
}: ActionDialogProps<T>) {
    const t = useT();
    const succeeded = useRef<ActionState<T> | null>(null);
    const onSuccessRef = useRef(onSuccess);
    const firstField = useRef<HTMLElement | null>(null);

    const form = useActionForm(action, {
        initialState,
        prepare,
        hiddenFields,
        onSuccess: (state) => {
            succeeded.current = state;
            onClose();
        },
    });

    useEffect(() => {
        onSuccessRef.current = onSuccess;
    });

    // Report success once the dialog has closed, or when the dialog unmounts because the change removed its trigger.
    useEffect(() => {
        const flush = () => {
            const state = succeeded.current;
            succeeded.current = null;
            if (state) onSuccessRef.current?.(state);
        };
        if (!open) flush();
        return () => {
            if (!open) return;
            flush();
        };
    }, [open]);

    const findFirstField = (node: HTMLDivElement | null) => {
        firstField.current = node?.querySelector<HTMLElement>(FIRST_FIELD) ?? null;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            size={size}
            dismissible={!form.pending}
            initialFocusRef={firstField}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={form.pending}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="submit" form={form.formProps.id} variant={submitVariant} loading={form.pending} disabled={(typeof submitDisabled === "function" ? submitDisabled(form.state) : Boolean(submitDisabled)) || form.pending}>
                        {form.pending && pendingLabel ? pendingLabel : submitLabel}
                    </Button>
                </>
            }
        >
            <form {...form.formProps} className="flex flex-col gap-5">
                <div ref={findFirstField} className="contents">
                    {children?.(form)}
                </div>
                {(typeof showMessage === "function" ? showMessage(form.state) : (showMessage ?? true)) && <FormMessage {...form.message} />}
            </form>
        </Dialog>
    );
}
