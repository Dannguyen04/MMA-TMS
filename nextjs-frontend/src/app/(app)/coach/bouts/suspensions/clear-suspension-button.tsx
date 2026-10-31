"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { Suspension } from "@/lib/domain/types";
import { SuspensionClearanceDialog } from "./suspension-clearance-dialog";

export interface ClearSuspensionButtonProps {
    suspension: Suspension;
    fighterName?: string;
}

export function ClearSuspensionButton({
    suspension,
    fighterName,
}: ClearSuspensionButtonProps) {
    const t = useT();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(true)}
                className="text-xs font-medium"
            >
                <CheckCircle2 aria-hidden className="size-3.5 text-warning-fg" />
                {t("suspensions.row.clearAction")}
            </Button>
            <SuspensionClearanceDialog
                open={open}
                onClose={() => setOpen(false)}
                suspension={suspension}
                fighterName={fighterName}
            />
        </>
    );
}
