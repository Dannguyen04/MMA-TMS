"use client";

import { UserPen } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
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

/** Edits the signed-in user's name and phone. Email and job title are managed by an administrator. */
export function ProfileForm({ name, phone, email, title }: ProfileFormProps) {
    const toast = useToast();
    const t = useT();
    const phoneHint = t("account.profile.phoneHint");
    const accountHint = t("account.profile.accountHint");

    const form = useActionForm(updateProfileAction, {
        id: "profile",
        onSuccess: (state) =>
            toast(
                state.data?.changed === false
                    ? { title: t("account.profile.noChangesTitle"), description: state.message, tone: "info" }
                    : { title: t("account.profile.savedTitle"), description: state.message },
            ),
    });
    const nameControl = form.control("name", { required: true });
    const phoneControl = form.control("phone", { hint: phoneHint });

    return (
        <Card className="min-w-0 overflow-hidden">
            <CardHeader title={t("account.profile.editTitle")} description={t("account.profile.editDescription")} icon={<UserPen />} />
            <form {...form.formProps}>
                <div className="flex flex-col gap-4 px-5 pb-5">
                    <Field label={t("account.profile.fullName")} htmlFor={nameControl.id} required error={form.error("name")}>
                        <Input {...nameControl} autoComplete="name" maxLength={NAME_MAX_LENGTH} defaultValue={name} />
                    </Field>
                    <Field label={t("account.profile.phone")} htmlFor={phoneControl.id} optional hint={phoneHint} error={form.error("phone")}>
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
                    <Field label={t("account.profile.email")} htmlFor="profile-email" hint={accountHint}>
                        <Input id="profile-email" type="email" value={email} readOnly className="bg-surface-muted text-fg-muted" />
                    </Field>
                    <p className="-mt-1 text-[13px] text-fg-muted">
                        {t("account.profile.jobTitle", { title })}
                    </p>
                    <FormMessage {...form.message} />
                </div>
                <CardFooter className="justify-end bg-surface-muted/50">
                    <SubmitButton pending={form.pending} pendingLabel={t("account.profile.saving")}>
                        {t("account.profile.saveChanges")}
                    </SubmitButton>
                </CardFooter>
            </form>
        </Card>
    );
}
