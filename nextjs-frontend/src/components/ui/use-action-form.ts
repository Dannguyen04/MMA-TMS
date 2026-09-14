"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEventHandler, type ReactNode, type RefObject } from "react";

import type { ActionState } from "@/lib/actions/state";
import { focusFirstInvalid } from "./form";

export type FormAction<T> = (prev: ActionState<T>, fd: FormData) => Promise<ActionState<T>>;

export interface UseActionFormOptions<T> {
    /** Form id; generated when omitted. Controls get `${id}-${name}` ids. */
    id?: string;
    initialState?: ActionState<T>;
    /** Runs inside the action after a successful result. */
    onSuccess?(state: ActionState<T>, fd: FormData): void;
    onError?(state: ActionState<T>, fd: FormData): void;
    /** Client-side checks before the server is called; return an error state to stop there. */
    prepare?(fd: FormData): ActionState<T> | void;
    /** Move focus to the first invalid control after an error (default true). */
    focusOnError?: boolean;
    /** Field names without a visible control (e.g. serialized hidden inputs); their errors join the form message. */
    hiddenFields?: string[];
}

export interface ActionFormControl {
    id: string;
    name: string;
    required?: boolean;
    "aria-required"?: true;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
}

export interface ActionForm<T> {
    state: ActionState<T>;
    pending: boolean;
    formProps: {
        id: string;
        ref: RefObject<HTMLFormElement | null>;
        noValidate: true;
        /** Only runs without hydration (JS off, or a submit React replays after hydrating); `onSubmit` handles every hydrated submit. */
        action: (fd: FormData) => void;
        "aria-busy"?: true;
        onSubmit: FormEventHandler<HTMLFormElement>;
        onChange: FormEventHandler<HTMLFormElement>;
    };
    /** Submits the form's current values, or the given FormData, or the form's values with these fields replaced. */
    submit(fields?: FormData | Record<string, string | string[]>): void;
    /** The field's error from the last result, hidden once the field (or a dot-prefix of its name) is edited. */
    error(name: string): string | undefined;
    /** id, name, required and aria wiring for a control, matching the ids a `<Field htmlFor>` renders. */
    control(name: string, options?: { id?: string; hint?: ReactNode; required?: boolean }): ActionFormControl;
    /** Hides errors for a field or group that changed without a native change event (row builders, custom widgets). */
    markEdited(nameOrPrefix: string): void;
    /** Back to the initial state with no errors. */
    reset(): void;
    message: { status: "idle" | "success" | "error"; message?: string };
}

const IDLE_STATE = { status: "idle" } as const;
const NO_NAMES: ReadonlySet<string> = new Set();

/** "a.0.b" → ["a", "a.0", "a.0.b"] */
function namePrefixes(name: string): string[] {
    const parts = name.split(".");
    return parts.map((_, index) => parts.slice(0, index + 1).join("."));
}

/**
 * Server Action form without React's automatic form reset: values stay in the DOM after an error,
 * errors clear as fields are edited, focus moves to the first problem, and pending is exposed for the
 * submit button. Spread `formProps` on a `<form>` (never pass your own `action`).
 *
 * `formProps.action` is the useActionState dispatch, so a `<form>` never falls back to a native GET that would
 * put field values (passwords) in the URL. When no client callbacks are given, the Server Action itself backs
 * the state, which lets the form submit and render its result without JavaScript (progressive enhancement).
 */
export function useActionForm<T = undefined>(action: FormAction<T>, options: UseActionFormOptions<T> = {}): ActionForm<T> {
    const { focusOnError = true, hiddenFields = [] } = options;
    const generatedId = useId();
    const formId = options.id ?? generatedId;
    const formRef = useRef<HTMLFormElement>(null);
    const [initialState] = useState<ActionState<T>>(() => options.initialState ?? IDLE_STATE);

    const hasClientCallbacks = Boolean(options.prepare || options.onSuccess || options.onError);
    const [latest, dispatch, pending] = useActionState(
        hasClientCallbacks
            ? async (previous: ActionState<T>, fd: FormData): Promise<ActionState<T>> => {
                  const prepared = options.prepare?.(fd);
                  const result = prepared ? prepared : await action(previous, fd);
                  if (result.status === "success") options.onSuccess?.(result, fd);
                  else if (result.status === "error") options.onError?.(result, fd);
                  return result;
              }
            : action,
        initialState,
    );

    const [resetFrom, setResetFrom] = useState<ActionState<T> | null>(null);
    const state = resetFrom === latest ? initialState : latest;

    // Every new result starts a fresh round of errors (derived during render, no effect needed).
    const [edited, setEdited] = useState<{ result: ActionState<T>; names: ReadonlySet<string> }>({ result: state, names: NO_NAMES });
    const editedNames = edited.result === state ? edited.names : NO_NAMES;
    if (edited.result !== state) setEdited({ result: state, names: NO_NAMES });

    useEffect(() => {
        if (!focusOnError || state.status !== "error" || state === initialState) return;
        const frame = window.requestAnimationFrame(() => focusFirstInvalid(formRef.current));
        return () => window.cancelAnimationFrame(frame);
    }, [state, focusOnError, initialState]);

    const markEdited = (name: string) =>
        setEdited((current) => {
            const names = current.result === state ? current.names : NO_NAMES;
            return names.has(name) ? current : { result: state, names: new Set(names).add(name) };
        });

    const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
    const error = (name: string) => (namePrefixes(name).some((prefix) => editedNames.has(prefix)) ? undefined : fieldErrors[name]);

    const dispatchForm = (fd: FormData) => {
        setResetFrom(null);
        startTransition(() => dispatch(fd));
    };

    const submit: ActionForm<T>["submit"] = (fields) => {
        if (fields instanceof FormData) return dispatchForm(fields);
        const fd = formRef.current ? new FormData(formRef.current) : new FormData();
        for (const [key, value] of Object.entries(fields ?? {})) {
            fd.delete(key);
            for (const item of Array.isArray(value) ? value : [value]) fd.append(key, item);
        }
        dispatchForm(fd);
    };

    const control: ActionForm<T>["control"] = (name, { id, hint, required } = {}) => {
        const controlId = id ?? `${formId}-${name}`;
        const message = error(name);
        return {
            id: controlId,
            name,
            required: required || undefined,
            "aria-required": required ? true : undefined,
            "aria-invalid": message ? true : undefined,
            "aria-describedby": message ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined,
        };
    };

    const fieldKeys = Object.keys(fieldErrors);
    const hasFieldErrors = fieldKeys.length > 0;
    const visibleFieldError = fieldKeys.some((key) => !hiddenFields.includes(key) && error(key) !== undefined);
    const hiddenMessages = hiddenFields.map((key) => error(key)).filter((message): message is string => Boolean(message));
    const messageParts = state.status === "error" ? [!hasFieldErrors || visibleFieldError ? state.message : undefined, ...hiddenMessages] : [];
    const errorMessage = messageParts.filter(Boolean).join(" ");

    return {
        state,
        pending,
        formProps: {
            id: formId,
            ref: formRef,
            noValidate: true,
            action: dispatch,
            "aria-busy": pending ? true : undefined,
            onSubmit: (event) => {
                event.preventDefault();
                if (pending) return;
                const submitter = (event.nativeEvent as SubmitEvent).submitter;
                dispatchForm(new FormData(event.currentTarget, submitter));
            },
            onChange: (event) => {
                const name = (event.target as Partial<HTMLInputElement>).name;
                if (name) markEdited(name);
            },
        },
        submit,
        error,
        control,
        markEdited,
        reset: () => {
            setResetFrom(latest);
            setEdited({ result: initialState, names: NO_NAMES });
        },
        message: { status: errorMessage ? "error" : "idle", message: errorMessage || undefined },
    };
}

/** FormData from plain values: arrays append one entry each, `true` becomes "on" (like a checkbox), empty values are skipped. */
export function toFormData(fields: Record<string, string | string[] | number | boolean | null | undefined>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined || value === false) continue;
        if (value === true) fd.append(key, "on");
        else if (Array.isArray(value)) value.forEach((item) => fd.append(key, item));
        else fd.append(key, String(value));
    }
    return fd;
}
