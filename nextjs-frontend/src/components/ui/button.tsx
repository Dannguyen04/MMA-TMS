import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BASE =
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors select-none " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-primary text-primary-fg shadow-card hover:bg-primary-hover",
    secondary: "border border-border bg-surface text-fg shadow-card hover:bg-surface-hover",
    ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
    danger: "bg-danger-solid text-white shadow-card hover:brightness-110",
    "danger-soft": "bg-danger-soft text-danger-fg ring-1 ring-inset ring-danger-border hover:brightness-95 dark:hover:brightness-125",
};

const SIZES: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
    md: "h-9 px-3.5 text-sm [&_svg]:size-4",
    lg: "h-11 px-5 text-[15px] [&_svg]:size-[18px]",
    icon: "size-9 [&_svg]:size-[18px]",
    "icon-sm": "size-8 [&_svg]:size-4",
};

export function buttonClasses({
    variant = "primary",
    size = "md",
    className,
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
} = {}) {
    return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ComponentProps<"button"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /**
     * Shows a spinner and announces the busy state. The button stays focusable (no native `disabled`),
     * so keyboard focus is kept while an action runs; clicks and implicit form submission are ignored.
     */
    loading?: boolean;
}

/** Swallows activation while loading: blocks clicks, repeat presses and implicit Enter submission. */
function ignoreActivation(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
}

/** Server Components may render Button too, so a handler is only attached when one is needed. */
export function Button({ variant, size, loading = false, className, children, type = "button", onClick, ...props }: ButtonProps) {
    return (
        <button
            type={type}
            className={buttonClasses({ variant, size, className })}
            aria-disabled={loading || undefined}
            aria-busy={loading || undefined}
            data-loading={loading || undefined}
            onClick={loading ? ignoreActivation : onClick}
            {...props}
        >
            {loading && <Spinner className="size-4" />}
            {children}
        </button>
    );
}

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
    return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
