"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { signIn } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

export function LoginForm({ next }: { next: string | null }) {
    const form = useActionForm(signIn, { id: "login" });
    const [showPassword, setShowPassword] = useState(false);
    const email = form.control("email", { id: "email", required: true });
    const password = form.control("password", { id: "password", required: true });

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            {next && <input type="hidden" name="next" value={next} />}
            <FormMessage {...form.message} />

            <Field label="Email" htmlFor={email.id} error={form.error("email")}>
                <Input {...email} type="email" autoComplete="email" placeholder="you@lotus-combat.test" />
            </Field>

            <Field label="Password" htmlFor={password.id} error={form.error("password")}>
                <div className="relative">
                    <Input {...password} type={showPassword ? "text" : "password"} autoComplete="current-password" className="pr-10" />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                    >
                        {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                    </button>
                </div>
            </Field>

            <div className="flex justify-end">
                <Link href={routes.forgotPassword} className="text-sm font-medium text-primary-soft-fg hover:underline">
                    Forgot password?
                </Link>
            </div>

            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Signing in…">
                Sign in
            </SubmitButton>
        </form>
    );
}
