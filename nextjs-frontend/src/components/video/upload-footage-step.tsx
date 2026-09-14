"use client";

import { Camera, CloudUpload, FileVideoCamera, Lightbulb, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

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
                                    Reading length…
                                </span>
                            )}
                            {footage.durationStatus === "read" && footage.durationSec !== null && <span>{formatClock(footage.durationSec)} long</span>}
                            {footage.durationStatus === "unreadable" && <span>Length couldn&apos;t be read in this browser</span>}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                            <RefreshCw aria-hidden />
                            Replace
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onRemove}>
                            <Trash2 aria-hidden />
                            Remove
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
                        <p className="text-base font-semibold text-fg">Drag a training video here</p>
                        <p id={hintId} className="mt-1 text-sm text-fg-muted">
                            {formatList(limits.allowedVideoFormats)} · up to {formatFileSize(limits.videoMaxSizeMb)} · {MIN_DURATION_SEC} seconds to {MAX_DURATION_SEC / 60} minutes
                        </p>
                    </div>
                    <Button onClick={() => inputRef.current?.click()} aria-describedby={error ? `${errorId} ${hintId}` : hintId}>
                        <FileVideoCamera aria-hidden />
                        Choose video
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
                    label="Approximate length (seconds)"
                    htmlFor={durationId}
                    required
                    hint="Your browser can't read this file's length. Enter an estimate — the analysis server reads the exact length."
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
                        <span className="font-medium text-fg">For the most reliable analysis</span> — the AI needs to see the whole body.
                    </span>
                </p>
                {[
                    "Full body in frame, head to feet, for the whole clip",
                    "Camera steady at chest height, 3–4 m away",
                    "Good, even light — avoid filming into windows",
                    "One fighter in frame (sparring partners are fine)",
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
