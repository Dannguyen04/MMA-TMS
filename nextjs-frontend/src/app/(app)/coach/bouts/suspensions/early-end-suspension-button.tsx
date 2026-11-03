"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import type { MedicalExamination, Suspension } from "@/lib/domain/types";
import { SuspensionEarlyEndDialog } from "./suspension-early-end-dialog";

export interface EarlyEndSuspensionButtonProps {
    suspension: Suspension;
    fighterName?: string;
    examinations?: MedicalExamination[];
    doctorId?: string;
    label: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
}

export function EarlyEndSuspensionButton({
    suspension,
    fighterName,
    examinations,
    doctorId,
    label,
    variant = "secondary",
    size = "sm",
    className = "text-xs font-medium",
}: EarlyEndSuspensionButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                onClick={() => setOpen(true)}
                className={className}
            >
                <CheckCircle2 aria-hidden className="size-3.5 text-warning-fg" />
                {label}
            </Button>
            <SuspensionEarlyEndDialog
                open={open}
                onClose={() => setOpen(false)}
                suspension={suspension}
                fighterName={fighterName}
                examinations={examinations}
                doctorId={doctorId}
            />
        </>
    );
}
