"use client";

import { Rocket } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
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
    const t = useT();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await setModelStatusAction(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ title: result.message ?? t("screens.admin.promote.done") });
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

    const task = taskLabel.toLowerCase();

    return (
        <>
            <Button
                onClick={() => {
                    setError(undefined);
                    setOpen(true);
                }}
            >
                <Rocket aria-hidden />
                {t("screens.admin.promote.button")}
            </Button>
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                tone="primary"
                title={t("screens.admin.promote.title", { model: modelLabel })}
                confirmLabel={t("screens.admin.promote.button")}
                description={
                    activeLabel
                        ? t("screens.admin.promote.descriptionReplace", { model: modelLabel, task, active: activeLabel })
                        : t("screens.admin.promote.description", { model: modelLabel, task })
                }
            >
                <FormMessage status={error ? "error" : "idle"} message={error} />
            </ConfirmDialog>
        </>
    );
}
