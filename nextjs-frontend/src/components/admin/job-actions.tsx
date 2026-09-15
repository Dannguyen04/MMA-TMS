"use client";

import { CircleStop, RotateCcw, TriangleAlert } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const mode = status === "failed" ? "retry" : status === "queued" || status === "processing" ? "cancel" : null;

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await (mode === "retry" ? retryJobAction : cancelJobAction)(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ tone: mode === "retry" ? "success" : "warning", title: result.message ?? "Job updated." });
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
                    Retry job
                </Button>
            ) : (
                <Button variant="danger-soft" onClick={openConfirm}>
                    <CircleStop aria-hidden />
                    Cancel job
                </Button>
            )}
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                tone={mode === "retry" ? "primary" : "danger"}
                title={mode === "retry" ? "Queue this job again?" : "Cancel this job?"}
                confirmLabel={mode === "retry" ? `Retry as attempt ${attempts + 1}` : "Cancel job"}
                description={
                    mode === "retry"
                        ? `“${videoTitle}” goes back to the queue and is processed from the start with the currently active models.`
                        : `Processing of “${videoTitle}” stops and the job is marked failed with code CANCELLED. The uploader is notified and can retry later.`
                }
            >
                <div className="flex flex-col gap-3">
                    {mode === "retry" && !retryHelps && (
                        <InlineNote icon={TriangleAlert} tone="warning">
                            This error usually repeats with the same file. Asking the uploader for a new recording is more likely to work.
                        </InlineNote>
                    )}
                    <FormMessage status={error ? "error" : "idle"} message={error} />
                </div>
            </ConfirmDialog>
        </>
    );
}
