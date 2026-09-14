"use client";

import { UserPen } from "lucide-react";

import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { updateProfileAction } from "@/lib/actions/account";
import { NAME_MAX_LENGTH, PHONE_MAX_LENGTH } from "./account-limits";

export interface ProfileFormProps {
    name: string;
    phone: string | null;
    email: string;
    title: string;
}

const PHONE_HINT = "Include the country code, e.g. +84 90 123 4567. Your coaches and doctors can see it.";
const ACCOUNT_HINT = "Email and job title are managed by your academy administrator.";

/** Edits the signed-in user's name and phone. Email and job title are managed by an administrator. */
export function ProfileForm({ name, phone, email, title }: ProfileFormProps) {
    const toast = useToast();
    const form = useActionForm(updateProfileAction, {
        id: "profile",
        onSuccess: (state) =>
            toast(
                state.data?.changed === false
                    ? { title: "No changes to save", description: state.message, tone: "info" }
                    : { title: "Profile saved", description: state.message },
            ),
    });
    const nameControl = form.control("name", { required: true });
    const phoneControl = form.control("phone", { hint: PHONE_HINT });

    return (
        <Card className="min-w-0 overflow-hidden">
            <CardHeader title="Edit profile" description="How your name and contact details appear to your team." icon={<UserPen />} />
            <form {...form.formProps}>
                <div className="flex flex-col gap-4 px-5 pb-5">
                    <Field label="Full name" htmlFor={nameControl.id} required error={form.error("name")}>
                        <Input {...nameControl} autoComplete="name" maxLength={NAME_MAX_LENGTH} defaultValue={name} />
                    </Field>
                    <Field label="Phone" htmlFor={phoneControl.id} optional hint={PHONE_HINT} error={form.error("phone")}>
                        <Input
                            {...phoneControl}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            maxLength={PHONE_MAX_LENGTH}
                            placeholder="+84 90 123 4567"
                            defaultValue={phone ?? ""}
                        />
                    </Field>
                    <Field label="Email" htmlFor="profile-email" hint={ACCOUNT_HINT}>
                        <Input id="profile-email" type="email" value={email} readOnly className="bg-surface-muted text-fg-muted" />
                    </Field>
                    <p className="-mt-1 text-[13px] text-fg-muted">
                        Job title: <span className="font-medium text-fg">{title}</span>
                    </p>
                    <FormMessage {...form.message} />
                </div>
                <CardFooter className="justify-end bg-surface-muted/50">
                    <SubmitButton pending={form.pending} pendingLabel="Saving…">
                        Save changes
                    </SubmitButton>
                </CardFooter>
            </form>
        </Card>
    );
}
