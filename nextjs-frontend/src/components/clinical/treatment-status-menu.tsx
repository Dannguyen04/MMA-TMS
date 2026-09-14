"use client";

import { Ellipsis } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { updateTreatmentStatusAction } from "@/lib/actions/clinical";
import { TREATMENT_STATUS_LABELS, TREATMENT_TYPE_LABELS } from "@/lib/domain/labels";
import type { TreatmentStatus, TreatmentType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { TREATMENT_STATUS_META } from "./clinical-badges";

const STATUSES = Object.keys(TREATMENT_STATUS_LABELS) as TreatmentStatus[];

export interface TreatmentStatusMenuProps {
    injuryId: string;
    treatmentId: string;
    type: TreatmentType;
    status: TreatmentStatus;
}

/** Small menu to move a treatment between planned, ongoing and completed. */
export function TreatmentStatusMenu({ injuryId, treatmentId, type, status }: TreatmentStatusMenuProps) {
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    const change = (next: TreatmentStatus, close: () => void) => {
        close();
        startTransition(async () => {
            const result = await updateTreatmentStatusAction({ injuryId, treatmentId, status: next });
            toast(
                result.status === "success"
                    ? { title: "Treatment updated", description: result.message }
                    : { tone: "error", title: "Couldn't update the treatment", description: result.message },
            );
        });
    };

    return (
        <Popover
            label={`Change status of ${TREATMENT_TYPE_LABELS[type]}`}
            align="end"
            trigger={(props) => (
                <Button {...props} variant="ghost" size="icon-sm" loading={pending} aria-label={`Change status of ${TREATMENT_TYPE_LABELS[type]}`}>
                    {!pending && <Ellipsis />}
                </Button>
            )}
            className="w-52 p-1.5"
        >
            {(close) => (
                <div className="flex flex-col">
                    <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-fg-subtle">Change status</p>
                    {STATUSES.map((value) => {
                        const meta = TREATMENT_STATUS_META[value];
                        const Icon = meta.icon;
                        const current = value === status;
                        return (
                            <button
                                key={value}
                                type="button"
                                disabled={current}
                                aria-current={current || undefined}
                                onClick={() => change(value, close)}
                                className={cn(
                                    "flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors",
                                    current ? "cursor-default text-fg-subtle" : "text-fg hover:bg-surface-hover",
                                )}
                            >
                                <Icon aria-hidden className="size-4 text-fg-muted" />
                                {current ? `${meta.label} (current)` : `Mark ${meta.label.toLowerCase()}`}
                            </button>
                        );
                    })}
                </div>
            )}
        </Popover>
    );
}
