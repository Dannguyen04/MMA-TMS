"use client";

import { Rocket } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { setModelStatusAction } from "@/lib/actions/admin";
import { IDLE, type ActionState } from "@/lib/actions/state";

export interface PromoteModelButtonProps {
    modelId: string;
    modelLabel: string;
    taskLabel: string;
    /** "name version" of the model currently active for the task, if any. */
    activeLabel: string | null;
}

/** Promotes a staging model to active after confirming that the current active model is deprecated. */
export function PromoteModelButton({ modelId, modelLabel, taskLabel, activeLabel }: PromoteModelButtonProps) {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await setModelStatusAction(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ title: result.message ?? "Model promoted." });
        } else {
            setError(result.message);
        }
        return result;
    }, IDLE);

    const confirm = () => {
        const formData = new FormData();
        formData.set("modelId", modelId);
        formData.set("status", "active");
        startTransition(() => dispatch(formData));
    };

    return (
        <>
            <Button
                onClick={() => {
                    setError(undefined);
                    setOpen(true);
                }}
            >
                <Rocket aria-hidden />
                Promote to active
            </Button>
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                tone="primary"
                title={`Promote ${modelLabel}?`}
                confirmLabel="Promote to active"
                description={
                    activeLabel
                        ? `New jobs will use ${modelLabel} for ${taskLabel.toLowerCase()}. The currently active model, ${activeLabel}, will be deprecated and kept for rollback. Jobs already queued or running aren't affected.`
                        : `New jobs will use ${modelLabel} for ${taskLabel.toLowerCase()}. Jobs already queued or running aren't affected.`
                }
            >
                <FormMessage status={error ? "error" : "idle"} message={error} />
            </ConfirmDialog>
        </>
    );
}
