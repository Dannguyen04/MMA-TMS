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
    fighterId: string;
    fighterName: string;
    size?: ButtonSize;
    /** "quiet" suits dense lists where many rows show the action. */
    emphasis?: "default" | "quiet";
    className?: string;
}

const REASON_HINT = "Lưu vào lịch sử giấy phép và chia sẻ với các bác sĩ khác phụ trách võ sĩ này.";

/** Revokes an active clearance after a confirmation that requires a clinical reason. */
export function RevokeClearanceButton({ clearanceId, fighterId, fighterName, size = "sm", emphasis = "default", className }: RevokeClearanceButtonProps) {
    const toast = useToast();
    const reasonId = useId();
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const [reason, setReason] = useState("");
    const [reasonEdited, setReasonEdited] = useState(false);

    const revoke = useConfirmAction((id: string) => revokeClearanceAction(IDLE, toFormData({ clearanceId: id, fighterId, reason })), {
        onSuccess: () =>
            toast({
                tone: "warning",
                title: `${fighterName} hiện chưa được tập`,
                description: "Võ sĩ và HLV đã được thông báo. Võ sĩ không được tập cho đến khi có giấy phép mới.",
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
                Thu hồi
                <span className="sr-only"> {fighterName}— giấy phép</span>
            </Button>
            <ConfirmDialog
                {...revoke.dialogProps}
                title={`Thu hồi giấy phép của ${fighterName}?`}
                description="Võ sĩ và HLV sẽ được thông báo ngay; võ sĩ không được tập cho đến khi có giấy phép mới."
                confirmLabel="Thu hồi giấy phép"
            >
                <Field label="Lý do thu hồi" htmlFor={reasonId} required hint={REASON_HINT} error={reasonError}>
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
                        placeholder="VD: Va chạm đầu khi đấu tập — thu hồi chờ tầm soát chấn động."
                    />
                </Field>
            </ConfirmDialog>
        </>
    );
}
