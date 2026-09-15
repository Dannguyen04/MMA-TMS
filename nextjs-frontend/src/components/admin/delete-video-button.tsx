"use client";

import { Trash2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { deleteVideoAction } from "@/lib/actions/admin";
import { IDLE, type ActionState } from "@/lib/actions/state";

/** Deletes one video after a confirmation that spells out what is removed and what is kept. */
export function DeleteVideoButton({ videoId, title, fighterName }: { videoId: string; title: string; fighterName: string }) {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await deleteVideoAction(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ title: result.message ?? "Video deleted.", description: "Its AI job history and analysis were removed." });
        } else {
            setError(result.message);
        }
        return result;
    }, IDLE);

    const confirm = () => {
        const formData = new FormData();
        formData.set("videoId", videoId);
        startTransition(() => dispatch(formData));
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon-sm"
                className="text-fg-subtle hover:bg-danger-soft hover:text-danger-fg"
                onClick={() => {
                    setError(undefined);
                    setOpen(true);
                }}
                aria-label={`Delete “${title}”`}
                title="Delete video"
            >
                <Trash2 aria-hidden />
            </Button>
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                title="Delete this video?"
                confirmLabel="Delete video"
                description="Deletes the footage, its AI analysis and job history. Doctor-reviewed observations are kept. This can't be undone."
            >
                <div className="flex flex-col gap-3">
                    <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
                        <p className="font-medium text-fg">{title}</p>
                        <p className="text-[13px] text-fg-muted">{fighterName}</p>
                    </div>
                    <FormMessage status={error ? "error" : "idle"} message={error} />
                </div>
            </ConfirmDialog>
        </>
    );
}
