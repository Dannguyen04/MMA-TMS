import { ChevronDown } from "lucide-react";
import { Children, Fragment, cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
    "w-full rounded-lg border border-control-border bg-surface text-sm text-fg shadow-card transition-colors " +
    "placeholder:text-fg-subtle hover:border-fg-subtle " +
    "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40 " +
    "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-subtle " +
    "aria-invalid:border-danger-solid aria-invalid:focus-visible:outline-danger-solid/40";

/** What a Field tells its controls: hint and error ids, and whether it is invalid or required. */
interface FieldWiring {
    hintId?: string;
    errorId?: string;
    invalid: boolean;
    required: boolean;
}

type AriaFieldProps = Pick<ComponentProps<"input">, "aria-describedby" | "aria-invalid" | "aria-required">;
type WirableProps = AriaFieldProps & { children?: ReactNode };

/**
 * Passes the Field's hint/error wiring to the Input, Select and Textarea elements it contains, looking
 * through plain wrapper elements such as `<div className="relative">`. Props the caller set always win.
 * Implemented without React context so Field keeps working in Server Components.
 */
function wireControls(children: ReactNode, wiring: FieldWiring): ReactNode {
    return Children.map(children, (child) => {
        if (!isValidElement<WirableProps>(child)) return child;
        const element: ReactElement<WirableProps> = child;
        if (element.type === Input || element.type === Select || element.type === Textarea) {
            const describedBy = [wiring.errorId, wiring.hintId].filter(Boolean).join(" ") || undefined;
            return cloneElement(element, {
                "aria-describedby": element.props["aria-describedby"] ?? describedBy,
                "aria-invalid": element.props["aria-invalid"] ?? (wiring.invalid || undefined),
                "aria-required": element.props["aria-required"] ?? (wiring.required || undefined),
            });
        }
        if ((typeof element.type === "string" || element.type === Fragment) && element.props.children !== undefined) {
            return cloneElement(element, undefined, wireControls(element.props.children, wiring));
        }
        return element;
    });
}

export interface FieldProps {
    label: ReactNode;
    /** id of the control this label describes. */
    htmlFor: string;
    hint?: ReactNode;
    error?: string;
    required?: boolean;
    /** Marks the field as optional in the label (use when most fields are required). */
    optional?: boolean;
    className?: string;
    children: ReactNode;
}

/**
 * Label + control + hint + error. Input, Select and Textarea inside a Field pick up
 * aria-describedby, aria-invalid and aria-required automatically; explicit props still win.
 * The Field never assigns ids: set the control's id to `htmlFor` yourself.
 */
export function Field({ label, htmlFor, hint, error, required, optional, className, children }: FieldProps) {
    const wiring: FieldWiring = {
        hintId: hint && !error ? `${htmlFor}-hint` : undefined,
        errorId: error ? `${htmlFor}-error` : undefined,
        invalid: Boolean(error),
        required: Boolean(required),
    };
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
                {label}
                {required && (
                    <span className="ml-0.5 text-danger-fg" aria-hidden>
                        *
                    </span>
                )}
                {optional && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(optional)</span>}
            </label>
            {wireControls(children, wiring)}
            {hint && !error && (
                <p id={`${htmlFor}-hint`} className="text-[13px] text-fg-subtle">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${htmlFor}-error`} className="text-[13px] font-medium text-danger-fg">
                    {error}
                </p>
            )}
        </div>
    );
}

export function fieldDescribedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }): string | undefined {
    const ids = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
}

export interface InputProps extends ComponentProps<"input"> {
    /** Unit shown inside the right edge, e.g. "kg". Decorative: repeat the unit in the label or hint. */
    suffix?: string;
}

export function Input({ className, suffix, style, ...props }: InputProps) {
    if (!suffix) return <input className={cn(CONTROL, "h-9 px-3", className)} style={style} {...props} />;
    return (
        <div className="relative">
            <input
                className={cn(CONTROL, "h-9 pl-3", className)}
                style={{ paddingRight: `calc(${suffix.length}ch + 1.5rem)`, ...style }}
                {...props}
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-subtle">
                {suffix}
            </span>
        </div>
    );
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
    return <textarea rows={rows} className={cn(CONTROL, "min-h-20 px-3 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
    return (
        <div className={cn("relative", className)}>
            <select className={cn(CONTROL, "h-9 appearance-none pr-9 pl-3")} {...props}>
                {children}
            </select>
            <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
            />
        </div>
    );
}

export function Checkbox({ label, description, className, id, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
    return (
        <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3", className)}>
            <input
                id={id}
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-control-border accent-[var(--primary)]"
                {...props}
            />
            <span className="text-sm">
                <span className="font-medium text-fg">{label}</span>
                {description && <span className="mt-0.5 block text-[13px] text-fg-muted">{description}</span>}
            </span>
        </label>
    );
}

/** Groups related fields under a heading, e.g. "Schedule" in the session form. */
export function FormSection({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <fieldset
            className={cn(
                "grid gap-x-8 gap-y-4 border-t border-border py-6 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-[220px_1fr]",
                className,
            )}
        >
            <legend className="sr-only">{title}</legend>
            <div>
                <p aria-hidden className="text-sm font-semibold text-fg">
                    {title}
                </p>
                {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
            </div>
            <div className="grid min-w-0 gap-5">{children}</div>
        </fieldset>
    );
}

/** Inline form-level message for action results. Focusable so a failed submit can move focus to it. */
export function FormMessage({ status, message, className }: { status: "success" | "error" | "idle"; message?: string; className?: string }) {
    if (status === "idle" || !message) return null;
    return (
        <p
            role={status === "error" ? "alert" : "status"}
            tabIndex={-1}
            data-form-message
            className={cn(
                "rounded-lg px-3 py-2 text-sm ring-1 ring-inset focus:outline-none",
                status === "error" ? "bg-danger-soft text-danger-fg ring-danger-border" : "bg-success-soft text-success-fg ring-success-border",
                className,
            )}
        >
            {message}
        </p>
    );
}

const FOCUSABLE_INSIDE = "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)";

/**
 * Moves focus to the first invalid control (or the first control inside an invalid group) after a
 * failed submit; falls back to the form-level message. Returns whether focus moved.
 */
export function focusFirstInvalid(container: HTMLElement | null): boolean {
    if (!container) return false;
    const invalid = container.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
    const target = invalid
        ? invalid.matches(FOCUSABLE_INSIDE)
            ? invalid
            : invalid.querySelector<HTMLElement>(FOCUSABLE_INSIDE)
        : container.querySelector<HTMLElement>("[data-form-message]");
    if (!target) return false;
    target.focus();
    return true;
}
