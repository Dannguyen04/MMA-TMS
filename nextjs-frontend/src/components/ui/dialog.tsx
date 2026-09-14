"use client";

import { TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { FormMessage } from "./form";

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    /** Renders as a sheet that slides in from the right (drawer). */
    side?: "center" | "right";
    /** Prevents closing via Escape/backdrop while an action is running. */
    dismissible?: boolean;
    /** Element to focus once the dialog opens (the browser focuses the first focusable element otherwise). */
    initialFocusRef?: RefObject<HTMLElement | null>;
    className?: string;
}

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

/**
 * Accessible modal built on the native <dialog> element: focus is trapped and
 * restored by the browser, Escape closes, and the page behind is inert.
 */
export function Dialog({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = "md",
    side = "center",
    dismissible = true,
    initialFocusRef,
    className,
}: DialogProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            initialFocusRef?.current?.focus();
        }
        if (!open && dialog.open) dialog.close();
    }, [open, initialFocusRef]);

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            onCancel={(event) => {
                // A nested dialog's Escape must not also close this one.
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                if (dismissible) onClose();
            }}
            onClick={(event) => {
                if (dismissible && event.target === event.currentTarget) onClose();
            }}
            className={cn(
                "m-auto w-[calc(100%-2rem)] border border-border bg-surface p-0 text-fg shadow-dialog backdrop:bg-overlay",
                side === "center" && cn("max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl", SIZES[size]),
                side === "right" &&
                    cn("mr-0 h-dvh max-h-dvh w-full rounded-none rounded-l-2xl sm:w-[min(100%,34rem)]", size === "xl" && "sm:w-[min(100%,52rem)]"),
                className,
            )}
        >
            {open && (
                <div className={cn("flex flex-col", side === "right" ? "h-full max-h-dvh" : "h-full max-h-[calc(100dvh-2rem-2px)]")}>
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
                        <div className="min-w-0">
                            <h2 id={titleId} className="text-base font-semibold text-fg">
                                {title}
                            </h2>
                            {description && (
                                <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                                    {description}
                                </p>
                            )}
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog" disabled={!dismissible}>
                            <X />
                        </Button>
                    </div>
                    {children && <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
                    {footer && (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted/50 px-5 py-3">
                            {footer}
                        </div>
                    )}
                </div>
            )}
        </dialog>
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    /** Explain the consequence in plain language. */
    description: ReactNode;
    confirmLabel: string;
    tone?: "danger" | "primary";
    pending?: boolean;
    /** Why the last attempt failed. Rendered inside the dialog, because toasts are hidden while a modal is open. */
    error?: string;
    children?: ReactNode;
}

/** Confirmation step for destructive or irreversible actions. */
export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    tone = "danger",
    pending = false,
    error,
    children,
}: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="sm"
            dismissible={!pending}
            title={
                <span className="flex items-center gap-2">
                    {tone === "danger" && <TriangleAlert aria-hidden className="size-4 text-danger-fg" />}
                    {title}
                </span>
            }
            description={description}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={pending}>
                        Cancel
                    </Button>
                    <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={pending}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {(children || error) && (
                <div className="flex flex-col gap-3">
                    {children}
                    <FormMessage status={error ? "error" : "idle"} message={error} />
                </div>
            )}
        </Dialog>
    );
}
