"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastInput {
    title: string;
    description?: string;
    tone?: ToastTone;
}

interface ToastItem extends ToastInput {
    id: number;
    tone: ToastTone;
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const ICON_CLASS: Record<ToastTone, string> = {
    success: "text-success-fg",
    error: "text-danger-fg",
    warning: "text-warning-fg",
    info: "text-info-fg",
};

/**
 * Toasts render outside any dialog, so while a modal <dialog> is open they sit in the inert page behind
 * it: hidden from assistive technology and unreachable. Show dialog errors inline (FormMessage or
 * ConfirmDialog `error`) and fire success toasts only after the dialog has closed.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((items) => items.filter((t) => t.id !== id));
    }, []);

    const push = useCallback(
        (input: ToastInput) => {
            counter.current += 1;
            const id = counter.current;
            setToasts((items) => [...items.slice(-3), { ...input, tone: input.tone ?? "success", id }]);
            window.setTimeout(() => dismiss(id), input.tone === "error" ? 8000 : 5000);
        },
        [dismiss],
    );

    const value = useMemo(() => push, [push]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                aria-live="polite"
                aria-relevant="additions"
                className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
            >
                {toasts.map((toast) => {
                    const Icon = ICONS[toast.tone];
                    return (
                        <div
                            key={toast.id}
                            role={toast.tone === "error" ? "alert" : "status"}
                            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-popover"
                        >
                            <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", ICON_CLASS[toast.tone])} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-fg">{toast.title}</p>
                                {toast.description && <p className="mt-0.5 text-[13px] text-fg-muted">{toast.description}</p>}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismiss(toast.id)}
                                className="-m-1 rounded-md p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg"
                                aria-label="Dismiss notification"
                            >
                                <X aria-hidden className="size-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const toast = useContext(ToastContext);
    if (!toast) throw new Error("useToast must be used inside <ToastProvider>.");
    return toast;
}
