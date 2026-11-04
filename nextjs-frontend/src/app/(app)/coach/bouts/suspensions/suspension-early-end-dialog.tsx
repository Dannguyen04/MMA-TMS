"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { clinicalLinks } from "@/components/clinical/clinical-links";
import { GradedReturnSteps } from "@/components/domain/graded-return-steps";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { endSuspensionEarlyAction } from "@/lib/actions/suspensions";
import {
    academyDateOf,
    earlyEndPreview,
    filterEarlyEndExaminations,
    suspensionReasonLabel,
} from "@/lib/domain/suspension-rules";
import type { MedicalExamination, Suspension } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface SuspensionEarlyEndDialogProps {
    suspension: Suspension | null;
    fighterName?: string;
    examinations?: MedicalExamination[];
    doctorId?: string;
    open: boolean;
    onClose: () => void;
    today?: string;
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

export interface SuspensionEarlyEndBodyProps {
    suspension: Suspension;
    fighterName?: string;
    examinations?: MedicalExamination[];
    eligibleExams?: MedicalExamination[];
    doctorId?: string;
    today?: string;
    locale?: Locale;
    note?: string;
    onNoteChange?: (value: string) => void;
    liftReference?: string;
    onLiftReferenceChange?: (value: string) => void;
    examinationId?: string;
    onExaminationIdChange?: (value: string) => void;
    clientError?: string | null;
    serverError?: string | null;
    isPending?: boolean;
    onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
    onClose?: () => void;
}

export function SuspensionEarlyEndBody({
    suspension,
    examinations = [],
    eligibleExams,
    doctorId,
    today,
    locale,
    note = "",
    onNoteChange,
    liftReference = "",
    onLiftReferenceChange,
    examinationId = "",
    onExaminationIdChange,
    clientError,
    serverError,
    isPending = false,
    onSubmit,
    onClose,
}: SuspensionEarlyEndBodyProps) {
    const contextLocale = useLocale();
    const activeLocale = locale ?? contextLocale;
    const t = useMemo(() => createTranslator(activeLocale), [activeLocale]);

    const isOrganizer = suspension.issuedBy === "ORGANIZER";
    const activeToday = today ?? academyDateOf();
    const preview = earlyEndPreview(suspension, activeToday);

    const exams =
        eligibleExams ??
        (isOrganizer ? [] : filterEarlyEndExaminations(examinations, suspension, { doctorId }));
    const noEligibleExams = !isOrganizer && exams.length === 0;
    const effectiveExamId = examinationId || (exams.length === 1 ? exams[0].id : "");
    const trimmedNoteLength = note.trim().length;

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <SuspensionEarlyEndAlert error={serverError ?? null} />

            {/* Block 1: Đình chỉ đang kết thúc */}
            <div className="flex flex-col gap-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                    {t("suspensions.earlyEndDialog.sectionSuspension")}
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs rounded-lg border border-border/70 bg-surface-muted/20 p-3">
                    <div>
                        <dt className="text-fg-muted">{t("suspensions.earlyEndDialog.reasonLabel")}</dt>
                        <dd className="font-medium text-fg">{suspensionReasonLabel(suspension.reason, t)}</dd>
                    </div>
                    <div>
                        <dt className="text-fg-muted">{t("suspensions.earlyEndDialog.periodLabel")}</dt>
                        <dd className="font-medium text-fg">
                            {formatShortDate(suspension.startsOn, activeLocale)} – {formatShortDate(suspension.endsOn, activeLocale)}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-fg-muted">{t("suspensions.earlyEndDialog.sourceLabel")}</dt>
                        <dd className="font-medium text-fg">
                            {isOrganizer
                                ? t("suspensions.earlyEndDialog.sourceOrganizer")
                                : t("suspensions.earlyEndDialog.sourceClub")}
                        </dd>
                    </div>
                    {isOrganizer && suspension.issuerReference && (
                        <div>
                            <dt className="text-fg-muted">{t("suspensions.earlyEndDialog.originalReference")}</dt>
                            <dd className="font-medium text-fg">{suspension.issuerReference}</dd>
                        </div>
                    )}
                    <div className="sm:col-span-full border-t border-border/50 pt-2 font-medium text-info-fg">
                        {preview.daysCut > 0
                            ? t("suspensions.earlyEndDialog.cutDays", {
                                  n: preview.daysCut,
                                  date: formatShortDate(suspension.endsOn, activeLocale),
                              })
                            : t("suspensions.earlyEndDialog.lastDay")}
                    </div>
                </dl>
            </div>

            {/* Block 2: Căn cứ */}
            <div className="flex flex-col gap-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                    {t("suspensions.earlyEndDialog.sectionBasis")}
                </h3>
                {isOrganizer ? (
                    <Field
                        htmlFor="lift-reference-input"
                        label={t("suspensions.earlyEndDialog.liftReferenceLabel")}
                        required
                        hint={
                            suspension.issuerReference
                                ? t("suspensions.earlyEndDialog.liftReferenceHint", {
                                      reference: suspension.issuerReference,
                                  })
                                : undefined
                        }
                        error={clientError && liftReference.trim().length < 3 ? clientError : undefined}
                    >
                        <Input
                            id="lift-reference-input"
                            value={liftReference}
                            onChange={(e) => onLiftReferenceChange?.(e.target.value)}
                            placeholder={t("suspensions.earlyEndDialog.liftReferencePlaceholder")}
                            maxLength={200}
                            disabled={isPending}
                            required
                        />
                    </Field>
                ) : noEligibleExams ? (
                    <div className="flex items-start gap-3 rounded-lg border border-warning-border/80 bg-warning-soft/40 p-3.5 text-xs">
                        <AlertCircle aria-hidden className="size-4 shrink-0 text-warning-fg mt-0.5" />
                        <div className="flex flex-col gap-1 min-w-0">
                            <p className="font-medium text-fg">
                                {t("suspensions.earlyEndDialog.noExamTitle")}
                            </p>
                            <p className="text-fg-muted">
                                {t("suspensions.earlyEndDialog.noExamDesc", {
                                    date: formatShortDate(suspension.startsOn, activeLocale),
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
                    <fieldset className="flex flex-col gap-1.5">
                        <legend className="text-sm font-medium text-fg">
                            {t("suspensions.earlyEndDialog.examLabel")}
                            <span className="ml-0.5 text-danger-fg" aria-hidden>*</span>
                        </legend>
                        <div className="flex flex-col gap-2">
                            {exams.map((exam) => {
                                const isChecked = effectiveExamId === exam.id;
                                const radioId = `exam-radio-${exam.id}`;
                                const outcomeText =
                                    exam.outcome === "fit"
                                        ? t("suspensions.earlyEndDialog.outcomeFit")
                                        : t("suspensions.earlyEndDialog.outcomeFitWithRestrictions");
                                return (
                                    <label
                                        key={exam.id}
                                        htmlFor={radioId}
                                        className={cn(
                                            "relative flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs transition-colors",
                                            "hover:border-control-border",
                                            "has-checked:border-primary has-checked:bg-primary-soft/30 has-checked:ring-1 has-checked:ring-primary",
                                            "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2",
                                            isChecked
                                                ? "border-primary bg-primary-soft/30 ring-1 ring-primary"
                                                : "border-border bg-surface",
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            id={radioId}
                                            name="examinationId"
                                            value={exam.id}
                                            checked={isChecked}
                                            onChange={() => onExaminationIdChange?.(exam.id)}
                                            disabled={isPending}
                                            required
                                            className="mt-0.5 size-4 shrink-0 accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="font-semibold text-fg">
                                                    {formatShortDate(exam.date, activeLocale)}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                                                        exam.outcome === "fit"
                                                            ? "bg-success-soft text-success-fg"
                                                            : "bg-warning-soft text-warning-fg",
                                                    )}
                                                >
                                                    {outcomeText}
                                                </span>
                                                {exam.validUntil && (
                                                    <span className="text-fg-subtle text-[11px]">
                                                        {t("suspensions.earlyEndDialog.validUntil", {
                                                            date: formatShortDate(exam.validUntil, activeLocale),
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                            {exam.summary && (
                                                <p className="text-fg-muted line-clamp-2">
                                                    {exam.summary}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        {clientError && !effectiveExamId && (
                            <p className="text-[13px] font-medium text-danger-fg">
                                {clientError}
                            </p>
                        )}
                    </fieldset>
                )}
            </div>

            {/* Block 3: Sau khi kết thúc */}
            {!noEligibleExams && (
                <div className="flex flex-col gap-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                        {t("suspensions.earlyEndDialog.sectionConsequence")}
                    </h3>
                    <p className="text-xs text-fg-muted">
                        {t("suspensions.earlyEndDialog.afterEndDesc")}
                    </p>
                    <GradedReturnSteps
                        gradedReturn={preview.gradedReturn}
                        locale={activeLocale}
                    />
                </div>
            )}

            {/* Ghi chú */}
            {!noEligibleExams && (
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
                        onChange={(e) => onNoteChange?.(e.target.value)}
                        placeholder={t("suspensions.earlyEndDialog.notePlaceholder")}
                        rows={3}
                        maxLength={500}
                        disabled={isPending}
                        required
                        className="w-full"
                    />
                </Field>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                {noEligibleExams ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        {t("suspensions.earlyEndDialog.close")}
                    </Button>
                ) : (
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            {t("suspensions.earlyEndDialog.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={isPending}
                            disabled={isPending}
                        >
                            {t("suspensions.earlyEndDialog.confirm")}
                        </Button>
                    </>
                )}
            </div>
        </form>
    );
}

export function SuspensionEarlyEndDialog({
    suspension,
    fighterName,
    examinations = [],
    doctorId,
    open,
    onClose,
    today,
}: SuspensionEarlyEndDialogProps) {
    const t = useT();
    const router = useRouter();
    const toast = useToast();

    const [note, setNote] = useState("");
    const [liftReference, setLiftReference] = useState("");
    const isOrganizer = suspension?.issuedBy === "ORGANIZER";
    const eligibleExams = suspension
        ? isOrganizer
            ? []
            : filterEarlyEndExaminations(examinations, suspension, { doctorId })
        : [];
    const [examinationId, setExaminationId] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (!suspension) return null;

    const effectiveExamId =
        examinationId || (eligibleExams.length === 1 ? eligibleExams[0].id : "");
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
            if (!effectiveExamId) {
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
            formData.set("examinationId", effectiveExamId);
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
            <SuspensionEarlyEndBody
                suspension={suspension}
                fighterName={fighterName}
                eligibleExams={eligibleExams}
                today={today}
                note={note}
                onNoteChange={(val) => {
                    setNote(val);
                    if (clientError) setClientError(null);
                    if (serverError) setServerError(null);
                }}
                liftReference={liftReference}
                onLiftReferenceChange={(val) => {
                    setLiftReference(val);
                    if (clientError) setClientError(null);
                    if (serverError) setServerError(null);
                }}
                examinationId={examinationId}
                onExaminationIdChange={(val) => {
                    setExaminationId(val);
                    if (clientError) setClientError(null);
                    if (serverError) setServerError(null);
                }}
                clientError={clientError}
                serverError={serverError}
                isPending={isPending}
                onSubmit={handleSubmit}
                onClose={handleDialogClose}
            />
        </Dialog>
    );
}
