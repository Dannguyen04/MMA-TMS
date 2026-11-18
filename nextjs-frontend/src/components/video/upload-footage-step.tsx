"use client";

import { Camera, CloudUpload, FileVideoCamera, Lightbulb, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { formatClock, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fileSizeMb, formatList, MAX_DURATION_SEC, MIN_DURATION_SEC, type FootageState, type UploadLimits } from "./upload-wizard-state";

export interface FootageStepProps {
    footage: FootageState;
    limits: UploadLimits;
    error: string | null;
    onSelect: (file: File) => void;
    onRemove: () => void;
    onManualDuration: (value: string) => void;
}

/** Step 1: accessible dropzone (button + drag and drop), file facts and length. */
export function FootageStep({ footage, limits, error, onSelect, onRemove, onManualDuration }: FootageStepProps) {
    const baseId = useId();
    const t = useT();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const hintId = `${baseId}-hint`;
    const errorId = `${baseId}-error`;
    const durationId = `${baseId}-duration`;
    const accept = limits.allowedVideoFormats.map((f) => `.${f}`).join(",");

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onSelect(file);
    };

    const picker = (
        <input
            ref={inputRef}
            type="file"
            accept={`${accept},video/*`}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onSelect(file);
                event.target.value = "";
            }}
        />
    );

    return (
        <div className="flex flex-col gap-5">
            {footage.file ? (
                <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted/60 p-4 sm:flex-row sm:items-center">
                    <span aria-hidden className="octagon flex size-12 shrink-0 items-center justify-center bg-nav-bg text-nav-fg-active">
                        <FileVideoCamera className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{footage.file.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-fg-muted" aria-live="polite">
                            <span>{formatFileSize(fileSizeMb(footage.file))}</span>
                            <span aria-hidden>·</span>
                            {footage.durationStatus === "reading" && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Spinner className="size-3.5" />
                                    {t("screens.video.upload.readingLength")}
                                </span>
                            )}
                            {footage.durationStatus === "read" && footage.durationSec !== null && <span>{t("screens.video.upload.lengthRead", { length: formatClock(footage.durationSec) })}</span>}
                            {footage.durationStatus === "unreadable" && <span>{t("screens.video.upload.lengthUnreadable")}</span>}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                            <RefreshCw aria-hidden />
                            {t("screens.video.upload.replace")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onRemove}>
                            <Trash2 aria-hidden />
                            {t("screens.video.upload.remove")}
                        </Button>
                    </div>
                    {picker}
                </div>
            ) : (
                <div
                    data-invalid={error ? "true" : undefined}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                        dragging ? "border-primary bg-primary-soft" : error ? "border-danger-border bg-danger-soft/30" : "border-border-strong bg-surface-muted/40",
                    )}
                >
                    <span aria-hidden className="octagon flex size-14 items-center justify-center bg-surface text-fg-muted shadow-card">
                        <CloudUpload className="size-6" />
                    </span>
                    <div>
                        <p className="text-base font-semibold text-fg">{t("screens.video.upload.drag")}</p>
                        <p id={hintId} className="mt-1 text-sm text-fg-muted">
                            {t("screens.video.upload.limits", {
                                formats: formatList(limits.allowedVideoFormats, t),
                                size: formatFileSize(limits.videoMaxSizeMb),
                                min: MIN_DURATION_SEC,
                                max: MAX_DURATION_SEC / 60,
                            })}
                        </p>
                    </div>
                    <Button onClick={() => inputRef.current?.click()} aria-describedby={error ? `${errorId} ${hintId}` : hintId}>
                        <FileVideoCamera aria-hidden />
                        {t("screens.video.upload.chooseVideo")}
                    </Button>
                    {picker}
                </div>
            )}

            {error && (
                <div id={errorId}>
                    <FormMessage status="error" message={error} />
                </div>
            )}

            {footage.file && footage.durationStatus === "unreadable" && (
                <Field
                    label={t("screens.video.upload.approxLength")}
                    htmlFor={durationId}
                    required
                    hint={t("screens.video.upload.approxLengthHint")}
                    className="max-w-xs"
                >
                    <Input
                        id={durationId}
                        type="number"
                        inputMode="numeric"
                        min={MIN_DURATION_SEC}
                        max={MAX_DURATION_SEC}
                        value={footage.manualDurationSec}
                        onChange={(event) => onManualDuration(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${errorId} ${durationId}-hint` : `${durationId}-hint`}
                    />
                </Field>
            )}

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
                <p className="flex items-start gap-2 text-[13px] text-fg-muted sm:col-span-2">
                    <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
                    <span>
                        <span className="font-medium text-fg">{t("screens.video.upload.tipsLead")}</span> {t("screens.video.upload.tipsBody")}
                    </span>
                </p>
                {[
                    t("screens.video.upload.tip1"),
                    t("screens.video.upload.tip2"),
                    t("screens.video.upload.tip3"),
                    t("screens.video.upload.tip4"),
                ].map((tip) => (
                    <p key={tip} className="flex items-start gap-2 text-[13px] text-fg">
                        <Camera aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        {tip}
                    </p>
                ))}
            </div>
        </div>
    );
}
