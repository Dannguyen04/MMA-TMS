"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { clearSuspensionAction } from "@/lib/actions/suspensions";
import type { Suspension } from "@/lib/domain/types";

export interface SuspensionClearanceDialogProps {
    suspension: Suspension | null;
    fighterName?: string;
    open: boolean;
    onClose: () => void;
}

export function SuspensionClearanceDialog({
    suspension,
    fighterName,
    open,
    onClose,
}: SuspensionClearanceDialogProps) {
    const t = useT();
    const router = useRouter();
    const toast = useToast();
    const [note, setNote] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!suspension) return null;

    const trimmedLength = note.trim().length;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setClientError(null);

        if (trimmedLength < 3 || trimmedLength > 500) {
            setClientError(t("suspensions.action.clearanceNoteLength"));
            return;
        }

        const formData = new FormData();
        formData.set("id", suspension.id);
        formData.set("clearanceNote", note.trim());

        startTransition(async () => {
            const result = await clearSuspensionAction({ status: "idle" }, formData);
            if (result.status === "success") {
                toast({ title: result.message || t("suspensions.action.cleared"), tone: "success" });
                setNote("");
                setClientError(null);
                onClose();
                router.refresh();
            } else {
                const errMsg = result.message || t("suspensions.action.failed");
                toast({ title: errMsg, tone: "error" });
                if (result.fieldErrors?.clearanceNote) {
                    setClientError(result.fieldErrors.clearanceNote);
                } else {
                    setClientError(errMsg);
                }
            }
        });
    };

    return (
        <Dialog
            open={open}
            onClose={() => {
                if (!isPending) {
                    setClientError(null);
                    onClose();
                }
            }}
            title={t("suspensions.clearDialog.title")}
            description={
                fighterName
                    ? `${fighterName} · ${t("suspensions.clearDialog.description")}`
                    : t("suspensions.clearDialog.description")
            }
            size="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field
                    htmlFor="clearance-note-textarea"
                    label={t("suspensions.clearDialog.noteLabel")}
                    required
                    error={clientError ?? undefined}
                    hint={t("suspensions.clearDialog.charCount", { current: trimmedLength })}
                >
                    <Textarea
                        id="clearance-note-textarea"
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            if (clientError) setClientError(null);
                        }}
                        placeholder={t("suspensions.clearDialog.notePlaceholder")}
                        rows={4}
                        maxLength={500}
                        disabled={isPending}
                        required
                        className="w-full"
                    />
                </Field>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isPending}
                    >
                        {t("suspensions.clearDialog.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={isPending}
                        disabled={isPending}
                    >
                        {t("suspensions.clearDialog.confirm")}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}
