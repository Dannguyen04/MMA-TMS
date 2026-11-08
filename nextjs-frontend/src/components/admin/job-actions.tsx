"use client";

import { CircleStop, RotateCcw, TriangleAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cancelJobAction, retryJobAction } from "@/lib/actions/admin";
import { IDLE, type ActionState } from "@/lib/actions/state";
import type { AIJobStatus } from "@/lib/domain/types";

export interface JobActionsProps {
    jobId: string;
    status: AIJobStatus;
    attempts: number;
    videoTitle: string;
    /** Whether a retry on the same file is likely to succeed. */
    retryHelps: boolean;
}

/** Retry (failed jobs) or cancel (queued / processing jobs), each confirmed first. */
export function JobActions({ jobId, status, attempts, videoTitle, retryHelps }: JobActionsProps) {
    const t = useT();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const mode = status === "failed" ? "retry" : status === "queued" || status === "processing" ? "cancel" : null;

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await (mode === "retry" ? retryJobAction : cancelJobAction)(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ tone: mode === "retry" ? "success" : "warning", title: result.message ?? t("adminForms.jobUpdated") });
        } else {
            setError(result.message);
        }
        return result;
    }, IDLE);

    if (!mode) return null;

    const confirm = () => {
        const formData = new FormData();
        formData.set("jobId", jobId);
        startTransition(() => dispatch(formData));
    };

    const openConfirm = () => {
        setError(undefined);
        setOpen(true);
    };

    return (
        <>
            {mode === "retry" ? (
                <Button onClick={openConfirm}>
                    <RotateCcw aria-hidden />
                    {t("adminForms.retryJob")}
                </Button>
            ) : (
                <Button variant="danger-soft" onClick={openConfirm}>
                    <CircleStop aria-hidden />
                    {t("adminForms.cancelJob")}
                </Button>
            )}
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                tone={mode === "retry" ? "primary" : "danger"}
                title={mode === "retry" ? t("adminForms.retryTitle") : t("adminForms.cancelTitle")}
                confirmLabel={mode === "retry" ? t("adminForms.retryAttempt", { n: attempts + 1 }) : t("adminForms.cancelJob")}
                description={mode === "retry" ? t("adminForms.retryDesc", { title: videoTitle }) : t("adminForms.cancelDesc", { title: videoTitle })}
            >
                <div className="flex flex-col gap-3">
                    {mode === "retry" && !retryHelps && (
                        <InlineNote icon={TriangleAlert} tone="warning">
                            {t("adminForms.retryWarn")}
                        </InlineNote>
                    )}
                    <FormMessage status={error ? "error" : "idle"} message={error} />
                </div>
            </ConfirmDialog>
        </>
    );
}
