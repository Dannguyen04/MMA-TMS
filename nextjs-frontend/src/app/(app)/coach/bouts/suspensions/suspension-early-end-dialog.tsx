"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { endSuspensionEarlyAction } from "@/lib/actions/suspensions";
import { filterEarlyEndExaminations } from "@/lib/domain/suspension-rules";
import type { MedicalExamination, Suspension } from "@/lib/domain/types";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { formatShortDate } from "@/lib/format";

export interface SuspensionEarlyEndDialogProps {
    suspension: Suspension | null;
    fighterName?: string;
    examinations?: MedicalExamination[];
    doctorId?: string;
    open: boolean;
    onClose: () => void;
}

export function SuspensionEarlyEndAlert({ error }: { error: string | null }) {
    if (!error) return null;
    return (
        <div
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-fg ring-1 ring-inset ring-danger-border"
        >
            {error}
        </div>
    );
}

export function handleEarlyEndActionResult(
    result: {
        status: "idle" | "success" | "error";
        message?: string;
        fieldErrors?: { note?: string; liftReference?: string; examinationId?: string };
    },
    callbacks: {
        setServerError: (msg: string) => void;
        setClientError?: (msg: string) => void;
        toastError?: (msg: string) => void;
        onSuccess?: () => void;
        fallbackErrorMessage?: string;
    },
) {
    if (result.status === "success") {
        callbacks.onSuccess?.();
    } else {
        const errMsg = result.message || callbacks.fallbackErrorMessage || "";
        callbacks.toastError?.(errMsg);
        callbacks.setServerError(errMsg);
        callbacks.setClientError?.(
            result.fieldErrors?.note ||
                result.fieldErrors?.liftReference ||
                result.fieldErrors?.examinationId ||
                errMsg,
        );
    }
}

export function SuspensionEarlyEndDialog({
    suspension,
    fighterName,
    examinations = [],
    doctorId,
    open,
    onClose,
}: SuspensionEarlyEndDialogProps) {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const toast = useToast();

    const [note, setNote] = useState("");
    const [liftReference, setLiftReference] = useState("");
    const [examinationId, setExaminationId] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!suspension) return null;

    const isOrganizer = suspension.issuedBy === "ORGANIZER";
    const eligibleExams = isOrganizer
        ? []
        : filterEarlyEndExaminations(examinations, suspension, { doctorId });
    const noEligibleExams = !isOrganizer && eligibleExams.length === 0;

    const trimmedNoteLength = note.trim().length;

    const handleDialogClose = () => {
        if (!isPending) {
            setClientError(null);
            setServerError(null);
            onClose();
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setClientError(null);
        setServerError(null);

        if (isOrganizer) {
            const trimmedLift = liftReference.trim();
            if (trimmedLift.length < 3 || trimmedLift.length > 200) {
                setClientError(t("suspensions.action.liftReferenceLength"));
                return;
            }
        } else {
            if (!examinationId) {
                setClientError(t("suspensions.earlyEndDialog.examRequired"));
                return;
            }
        }

        if (trimmedNoteLength < 3 || trimmedNoteLength > 500) {
            setClientError(t("suspensions.action.earlyEndNoteLength"));
            return;
        }

        const formData = new FormData();
        formData.set("id", suspension.id);
        formData.set("note", note.trim());
        if (isOrganizer) {
            formData.set("liftReference", liftReference.trim());
        } else {
            formData.set("examinationId", examinationId);
        }

        startTransition(async () => {
            const result = await endSuspensionEarlyAction({ status: "idle" }, formData);
            handleEarlyEndActionResult(result, {
                setServerError,
                setClientError,
                toastError: (errMsg) => toast({ title: errMsg, tone: "error" }),
                onSuccess: () => {
                    toast({
                        title: result.message || t("suspensions.action.earlyEnded"),
                        tone: "success",
                    });
                    setNote("");
                    setLiftReference("");
                    setExaminationId("");
                    setClientError(null);
                    setServerError(null);
                    onClose();
                    router.refresh();
                },
                fallbackErrorMessage: t("suspensions.action.failed"),
            });
        });
    };

    const title = isOrganizer
        ? t("suspensions.earlyEndDialog.organizerTitle")
        : t("suspensions.earlyEndDialog.medicalTitle");

    const description = isOrganizer
        ? fighterName
            ? `${fighterName} · ${t("suspensions.earlyEndDialog.organizerDesc")}`
            : t("suspensions.earlyEndDialog.organizerDesc")
        : fighterName
          ? `${fighterName} · ${t("suspensions.earlyEndDialog.medicalDesc")}`
          : t("suspensions.earlyEndDialog.medicalDesc");

    return (
        <Dialog
            open={open}
            onClose={handleDialogClose}
            title={title}
            description={description}
            size="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <SuspensionEarlyEndAlert error={serverError} />
                {isOrganizer ? (
                    <Field
                        htmlFor="lift-reference-input"
                        label={t("suspensions.earlyEndDialog.liftReferenceLabel")}
                        required
                        error={clientError && liftReference.trim().length < 3 ? clientError : undefined}
                    >
                        <Input
                            id="lift-reference-input"
                            value={liftReference}
                            onChange={(e) => {
                                setLiftReference(e.target.value);
                                if (clientError) setClientError(null);
                                if (serverError) setServerError(null);
                            }}
                            placeholder={t("suspensions.earlyEndDialog.liftReferencePlaceholder")}
                            maxLength={200}
                            disabled={isPending}
                            required
                        />
                    </Field>
                ) : (
                    <>
                        {noEligibleExams ? (
                            <div className="flex items-start gap-3 rounded-xl border border-warning-border/80 bg-warning-soft/40 p-4 text-xs">
                                <AlertCircle aria-hidden className="size-4 shrink-0 text-warning-fg mt-0.5" />
                                <div className="flex flex-col gap-1 min-w-0">
                                    <p className="font-medium text-fg">
                                        {t("suspensions.earlyEndDialog.noExamTitle")}
                                    </p>
                                    <p className="text-fg-muted">
                                        {t("suspensions.earlyEndDialog.noExamDesc", {
                                            date: formatShortDate(suspension.startsOn, locale),
                                        })}
                                    </p>
                                    <p className="mt-1">
                                        <Link
                                            href={clinicalLinks.newExaminationFor(suspension.fighterId)}
                                            className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                        >
                                            {t("suspensions.earlyEndDialog.createExamLink")}
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <Field
                                htmlFor="examination-select"
                                label={t("suspensions.earlyEndDialog.examLabel")}
                                required
                                error={clientError && !examinationId ? clientError : undefined}
                                hint={t("suspensions.earlyEndDialog.examHint")}
                            >
                                <Select
                                    id="examination-select"
                                    value={examinationId}
                                    onChange={(e) => {
                                        setExaminationId(e.target.value);
                                        if (clientError) setClientError(null);
                                        if (serverError) setServerError(null);
                                    }}
                                    required
                                    disabled={isPending}
                                    className="w-full"
                                >
                                    <option value="">{t("suspensions.earlyEndDialog.examSelectPlaceholder")}</option>
                                    {eligibleExams.map((exam) => {
                                        return (
                                            <option key={exam.id} value={exam.id}>
                                                {t("suspensions.earlyEndDialog.examOption", {
                                                    date: formatShortDate(exam.date, locale),
                                                })}
                                                {exam.summary ? ` · ${exam.summary}` : ""}
                                            </option>
                                        );
                                    })}
                                </Select>
                            </Field>
                        )}
                    </>
                )}

                <Field
                    htmlFor="early-end-note-textarea"
                    label={t("suspensions.earlyEndDialog.noteLabel")}
                    required
                    error={
                        clientError && (trimmedNoteLength < 3 || trimmedNoteLength > 500)
                            ? clientError
                            : undefined
                    }
                    hint={t("suspensions.earlyEndDialog.charCount", { current: trimmedNoteLength })}
                >
                    <Textarea
                        id="early-end-note-textarea"
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            if (clientError) setClientError(null);
                            if (serverError) setServerError(null);
                        }}
                        placeholder={t("suspensions.earlyEndDialog.notePlaceholder")}
                        rows={4}
                        maxLength={500}
                        disabled={isPending || noEligibleExams}
                        required
                        className="w-full"
                    />
                </Field>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleDialogClose}
                        disabled={isPending}
                    >
                        {t("suspensions.earlyEndDialog.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={isPending}
                        disabled={isPending || noEligibleExams}
                    >
                        {t("suspensions.earlyEndDialog.confirm")}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}
