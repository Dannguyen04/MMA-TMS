"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Field, Input } from "./form";
import type { ActionForm } from "./use-action-form";

/** A password field with a show/hide toggle. Pass `autoComplete` ("current-password" or "new-password"). */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
            >
                {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
        </div>
    );
}

const NEW_PASSWORD_HINT = "8 to 128 characters. A few unrelated words make a strong password.";

/** A new password typed twice, named `newPassword` and `confirmPassword` as the auth actions read them. */
export function NewPasswordFields({ form, label = "New password" }: { form: ActionForm<undefined>; label?: string }) {
    const newPassword = form.control("newPassword", { id: "newPassword", required: true, hint: NEW_PASSWORD_HINT });
    const confirmPassword = form.control("confirmPassword", { id: "confirmPassword", required: true });
    return (
        <>
            <Field label={label} htmlFor={newPassword.id} required hint={NEW_PASSWORD_HINT} error={form.error("newPassword")}>
                <PasswordInput {...newPassword} autoComplete="new-password" minLength={8} maxLength={128} />
            </Field>
            <Field label={`Confirm ${label.toLowerCase()}`} htmlFor={confirmPassword.id} required error={form.error("confirmPassword")}>
                <PasswordInput {...confirmPassword} autoComplete="new-password" maxLength={128} />
            </Field>
        </>
    );
}
