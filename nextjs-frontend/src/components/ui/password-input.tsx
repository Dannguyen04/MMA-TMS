"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { Field, Input } from "./form";
import type { ActionForm } from "./use-action-form";

/** A password field with a show/hide toggle. Pass `autoComplete` ("current-password" or "new-password"). */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = useState(false);
    const t = useT();
    return (
        <div className="relative">
            <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
                aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
                aria-pressed={visible}
            >
                {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
        </div>
    );
}

/** A new password typed twice, named `newPassword` and `confirmPassword` as the auth actions read them. */
export function NewPasswordFields({ form, label }: { form: ActionForm<undefined>; label?: string }) {
    const t = useT();
    const resolvedLabel = label ?? t("auth.newPassword");
    const hint = t("auth.newPasswordHint", { min: PASSWORD_LENGTH.min, max: PASSWORD_LENGTH.max });
    const confirmLabel = label ? `Confirm ${label.toLowerCase()}` : t("auth.confirmNewPassword");
    const newPassword = form.control("newPassword", { id: "newPassword", required: true, hint });
    const confirmPassword = form.control("confirmPassword", { id: "confirmPassword", required: true });
    return (
        <>
            <Field label={resolvedLabel} htmlFor={newPassword.id} required hint={hint} error={form.error("newPassword")}>
                <PasswordInput {...newPassword} autoComplete="new-password" minLength={PASSWORD_LENGTH.min} maxLength={PASSWORD_LENGTH.max} />
            </Field>
            <Field label={confirmLabel} htmlFor={confirmPassword.id} required error={form.error("confirmPassword")}>
                <PasswordInput {...confirmPassword} autoComplete="new-password" maxLength={PASSWORD_LENGTH.max} />
            </Field>
        </>
    );
}
