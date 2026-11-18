"use client";

import { ShieldOff } from "lucide-react";
import { useId, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button, type ButtonSize } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { toFormData } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { revokeClearanceAction } from "@/lib/actions/medical";
import { IDLE } from "@/lib/actions/state";
import { cn } from "@/lib/utils";

export interface RevokeClearanceButtonProps {
    clearanceId: string;
    fighterId: string;
    fighterName: string;
    size?: ButtonSize;
    /** "quiet" suits dense lists where many rows show the action. */
    emphasis?: "default" | "quiet";
    className?: string;
}

/** Revokes an active clearance after a confirmation that requires a clinical reason. */
export function RevokeClearanceButton({ clearanceId, fighterId, fighterName, size = "sm", emphasis = "default", className }: RevokeClearanceButtonProps) {
    const t = useT();
    const toast = useToast();
    const reasonId = useId();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const [reason, setReason] = useState("");
    const [reasonEdited, setReasonEdited] = useState(false);

    const revoke = useConfirmAction((id: string) => revokeClearanceAction(IDLE, toFormData({ clearanceId: id, fighterId, reason })), {
        onSuccess: () =>
            toast({
                tone: "warning",
                title: t("doctorMedical.revoke.toastTitle", { name: fighterName }),
                description: t("doctorMedical.revoke.toastDescription"),
            }),
        onError: (state) => {
            if (!state.fieldErrors?.reason) return;
            setReasonEdited(false);
            window.requestAnimationFrame(() => reasonRef.current?.focus());
        },
    });
    const reasonError = reasonEdited ? undefined : revoke.fieldErrors.reason;

    return (
        <>
            <Button
                variant={emphasis === "quiet" ? "ghost" : "danger-soft"}
                size={size}
                className={cn(emphasis === "quiet" && "text-danger-fg hover:bg-danger-soft hover:text-danger-fg", className)}
                onClick={() => {
                    setReason("");
                    setReasonEdited(false);
                    revoke.request(clearanceId);
                }}
            >
                <ShieldOff aria-hidden />
                {t("doctorMedical.revoke.button")}
                <span className="sr-only"> {t("doctorMedical.revoke.buttonSr", { name: fighterName })}</span>
            </Button>
            <ConfirmDialog
                {...revoke.dialogProps}
                title={t("doctorMedical.revoke.confirmTitle", { name: fighterName })}
                description={t("doctorMedical.revoke.confirmDescription")}
                confirmLabel={t("doctorMedical.revoke.confirm")}
            >
                <Field label={t("doctorMedical.revoke.reason")} htmlFor={reasonId} required hint={t("doctorMedical.revoke.reasonHint")} error={reasonError}>
                    <Textarea
                        ref={reasonRef}
                        id={reasonId}
                        name="reason"
                        rows={3}
                        required
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setReasonEdited(true);
                        }}
                        placeholder={t("doctorMedical.revoke.reasonPlaceholder")}
                    />
                </Field>
            </ConfirmDialog>
        </>
    );
}
