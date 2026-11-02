"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from "react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { focusFirstInvalid } from "./form";
import { firstStepWithError, missingRequiredControls, type StepState } from "./form-steps-state";

export interface FormStepDefinition {
    id: string;
    label: string;
    /** One short line under the label; hidden on small screens. */
    description?: string;
    /** Optional steps offer "Skip", which jumps straight to the last step. */
    optional?: boolean;
}

interface StepsContextValue {
    activeId: string;
    goTo(id: string): void;
}

const StepsContext = createContext<StepsContextValue | null>(null);

function findPanel(root: HTMLElement | null, id: string): HTMLElement | null {
    return root?.querySelector<HTMLElement>(`[data-form-step="${CSS.escape(id)}"]`) ?? null;
}

/** The active step and a way to jump to another one, e.g. "Edit" links on a review step. */
export function useFormSteps(): StepsContextValue {
    const value = useContext(StepsContext);
    if (!value) throw new Error("useFormSteps must be used inside <FormSteps>.");
    return value;
}

export interface FormStepsProps {
    steps: FormStepDefinition[];
    /** The form's action state (`form.state`). After a failed submit the stepper opens the step holding the first error. */
    state?: StepState;
    /** Shown instead of "Next" on the last step: normally the submit button. */
    submit: ReactNode;
    /** Left side of the footer on every step, e.g. a Cancel link. */
    cancel?: ReactNode;
    /** Shown above the footer on the last step, e.g. `<FormMessage {...form.message} />`. */
    message?: ReactNode;
    /** Extra checks before leaving a step. Return a sentence to stay on the step, or null to continue. */
    validateStep?(stepId: string, panel: HTMLElement): string | null;
    /** Called whenever the active step changes. */
    onStepChange?(stepId: string): void;
    className?: string;
    /** `<FormStep id>` panels, in the same order as `steps`. */
    children: ReactNode;
}

/**
 * Splits one long form into steps without splitting the submission: every step stays mounted (inactive ones
 * are `hidden`), so the browser keeps what was typed, a single Server Action receives every field, and a
 * server-side error sends the user back to the step that holds it. "Next" only checks that the step's
 * required controls are filled; the server stays the authority on validation.
 */
export function FormSteps({ steps, state, submit, cancel, message, validateStep, onStepChange, className, children }: FormStepsProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [reached, setReached] = useState(0);
    const [stepError, setStepError] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const lastHandledState = useRef<StepState | undefined>(state);
    const t = useT();

    const active = steps[activeIndex] ?? steps[0];
    const isLast = activeIndex === steps.length - 1;

    const panel = (id: string) => findPanel(rootRef.current, id);

    const show = (index: number, { focus = true }: { focus?: boolean } = {}) => {
        const next = Math.max(0, Math.min(index, steps.length - 1));
        setActiveIndex(next);
        setReached((current) => Math.max(current, next));
        setStepError(null);
        onStepChange?.(steps[next].id);
        if (!focus) return;
        window.requestAnimationFrame(() => {
            rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            panel(steps[next].id)?.focus({ preventScroll: true });
        });
    };

    const goTo = (id: string) => {
        const index = steps.findIndex((step) => step.id === id);
        if (index >= 0) show(index);
    };

    const next = () => {
        const current = panel(active.id);
        if (current) {
            const missing = missingRequiredControls(current);
            if (missing.length > 0) {
                const names = [...new Set(missing.map((item) => item.label).filter(Boolean))];
                setStepError(names.length > 0 ? t("screens.training.formSteps.fillIn", { fields: names.join(", ") }) : t("screens.training.formSteps.fillInRequired"));
                missing[0].element.focus();
                return;
            }
            const custom = validateStep?.(active.id, current);
            if (custom) {
                setStepError(custom);
                return;
            }
        }
        show(activeIndex + 1);
    };

    // After a failed submit, open the step that holds the first invalid control (or the last step for a
    // form-level message) and focus it there. useActionForm also tries to focus, but a hidden step can't take focus.
    useEffect(() => {
        if (state === lastHandledState.current) return;
        lastHandledState.current = state;
        if (!state || state.status !== "error" || !rootRef.current) return;
        const target = firstStepWithError(rootRef.current) ?? steps[steps.length - 1].id;
        const index = steps.findIndex((step) => step.id === target);
        // The error markers only exist in the DOM after the render, so the step follows them here.
        setActiveIndex(index);
        setReached((current) => Math.max(current, index));
        const root = rootRef.current;
        const frame = window.requestAnimationFrame(() => focusFirstInvalid(findPanel(root, target)));
        return () => window.cancelAnimationFrame(frame);
    }, [state, steps]);

    // Enter in a text field moves to the next step instead of submitting a half-seen form.
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" || isLast || event.defaultPrevented) return;
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(target.type)) {
            event.preventDefault();
            next();
        }
    };

    return (
        <StepsContext.Provider value={{ activeId: active.id, goTo }}>
            <div ref={rootRef} className={cn("flex scroll-mt-24 flex-col gap-6", className)} onKeyDown={onKeyDown}>
                <nav aria-label={t("screens.training.formSteps.nav")}>
                    <p className="mb-2 text-xs font-medium text-fg-subtle sm:hidden">
                        {t("screens.training.formSteps.stepOf", { n: activeIndex + 1, total: steps.length })} <span className="text-fg">{active.label}</span>
                    </p>
                    <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                        {steps.map((step, index) => {
                            const current = index === activeIndex;
                            const done = index < activeIndex || (index <= reached && index !== activeIndex);
                            const reachable = index <= reached;
                            return (
                                <li key={step.id} aria-current={current ? "step" : undefined} className="min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => show(index)}
                                        disabled={!reachable || current}
                                        className={cn(
                                            "flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:cursor-default",
                                            reachable && !current && "hover:bg-surface-hover",
                                        )}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1",
                                                current
                                                    ? "bg-primary text-primary-fg ring-primary"
                                                    : done
                                                      ? "bg-success-soft text-success-fg ring-success-border"
                                                      : "bg-surface text-fg-muted ring-border",
                                            )}
                                        >
                                            {done && !current ? <Check className="size-4" /> : index + 1}
                                        </span>
                                        <span className="min-w-0 max-sm:sr-only">
                                            <span className={cn("block truncate text-sm font-semibold", current ? "text-fg" : "text-fg-muted")}>
                                                {step.label}
                                                {step.optional && <span className="ml-1 text-xs font-normal text-fg-subtle">{t("screens.training.formSteps.optional")}</span>}
                                            </span>
                                            {step.description && <span className="block truncate text-xs text-fg-subtle max-md:hidden">{step.description}</span>}
                                        </span>
                                        <span className="sr-only">{done && !current ? t("screens.training.formSteps.completed") : current ? t("screens.training.formSteps.current") : ""}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                <div className="min-w-0">{children}</div>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    {stepError && (
                        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-fg ring-1 ring-inset ring-danger-border">
                            {stepError}
                        </p>
                    )}
                    {isLast && message}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                        {cancel && <div className="sm:mr-auto">{cancel}</div>}
                        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                            {activeIndex > 0 && (
                                <Button variant="secondary" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" onClick={() => show(activeIndex - 1)}>
                                    <ArrowLeft aria-hidden />
                                    {t("screens.training.formSteps.back")}
                                </Button>
                            )}
                            {active.optional && !isLast && (
                                <Button variant="ghost" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" onClick={() => show(steps.length - 1)}>
                                    {t("screens.training.formSteps.skip")}
                                </Button>
                            )}
                            {isLast ? (
                                submit
                            ) : (
                                <Button size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" onClick={next}>
                                    {t("screens.training.formSteps.next")}
                                    <ArrowRight aria-hidden />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </StepsContext.Provider>
    );
}

export interface FormStepProps {
    id: string;
    /** Visible heading at the top of the step; defaults to nothing (the stepper already names it). */
    title?: ReactNode;
    description?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** One step's panel. It stays mounted while hidden so its values are kept and submitted. */
export function FormStep({ id, title, description, className, children }: FormStepProps) {
    const context = useContext(StepsContext);
    if (!context) throw new Error("<FormStep> must be used inside <FormSteps>.");
    const active = context.activeId === id;
    return (
        <section data-form-step={id} hidden={!active} tabIndex={-1} aria-label={typeof title === "string" ? title : undefined} className={cn("focus:outline-none", className)}>
            {(title || description) && (
                <header className="mb-5">
                    {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
                    {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
                </header>
            )}
            {children}
        </section>
    );
}
