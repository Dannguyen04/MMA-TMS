"use client";

import { ShieldOff } from "lucide-react";
import { useId, useRef, useState } from "react";

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
    fighterName: string;
    size?: ButtonSize;
    /** "quiet" suits dense lists where many rows show the action. */
    emphasis?: "default" | "quiet";
    className?: string;
}

const REASON_HINT = "Saved to the clearance history and shared with other doctors assigned to this fighter.";

/** Revokes an active clearance after a confirmation that requires a clinical reason. */
export function RevokeClearanceButton({ clearanceId, fighterName, size = "sm", emphasis = "default", className }: RevokeClearanceButtonProps) {
    const toast = useToast();
    const reasonId = useId();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const [reason, setReason] = useState("");
    const [reasonEdited, setReasonEdited] = useState(false);

    const revoke = useConfirmAction((id: string) => revokeClearanceAction(IDLE, toFormData({ clearanceId: id, reason })), {
        onSuccess: () =>
            toast({
                tone: "warning",
                title: `${fighterName} is now Not Cleared`,
                description: "Their coaches and the fighter have been notified. Training stays blocked until you issue a new clearance.",
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
                Revoke
                <span className="sr-only"> {fighterName}&apos;s clearance</span>
            </Button>
            <ConfirmDialog
                {...revoke.dialogProps}
                title={`Revoke ${fighterName}'s clearance?`}
                description="Coaches and the fighter will be notified immediately and training will be blocked until you issue a new clearance."
                confirmLabel="Revoke clearance"
            >
                <Field label="Reason for revoking" htmlFor={reasonId} required hint={REASON_HINT} error={reasonError}>
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
                        placeholder="e.g. New head impact in sparring — withdrawn pending concussion screening."
                    />
                </Field>
            </ConfirmDialog>
        </>
    );
}
