"use client";

import { Trash2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { deleteVideoAction } from "@/lib/actions/admin";
import { IDLE, type ActionState } from "@/lib/actions/state";

/** Deletes one video after a confirmation that spells out what is removed and what is kept. */
export function DeleteVideoButton({ videoId, title, fighterName }: { videoId: string; title: string; fighterName: string }) {
    const t = useT();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const [, dispatch, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
        const result = await deleteVideoAction(previous, formData);
        if (result.status === "success") {
            setOpen(false);
            toast({ title: result.message ?? t("screens.admin.deleteVideo.deleted"), description: t("screens.admin.deleteVideo.deletedDescription") });
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
                aria-label={t("screens.admin.deleteVideo.aria", { title })}
                title={t("screens.admin.deleteVideo.button")}
            >
                <Trash2 aria-hidden />
            </Button>
            <ConfirmDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={confirm}
                pending={pending}
                title={t("screens.admin.deleteVideo.title")}
                confirmLabel={t("screens.admin.deleteVideo.button")}
                description={t("screens.admin.deleteVideo.description")}
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
