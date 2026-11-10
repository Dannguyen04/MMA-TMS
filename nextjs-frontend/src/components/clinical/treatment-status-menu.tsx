"use client";

import { Ellipsis } from "lucide-react";
import { useTransition } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { updateTreatmentStatusAction } from "@/lib/actions/clinical";
import { TREATMENT_STATUS_LABELS } from "@/lib/domain/labels";
import type { TreatmentStatus, TreatmentType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { TREATMENT_STATUS_META } from "./clinical-badges";
import { treatmentTypeText } from "./clinical-copy";

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
    const t = useT();
    const changeLabel = t("doctorClinical.treatmentMenu.changeStatusOf", { type: treatmentTypeText(t, type) });

    const change = (next: TreatmentStatus, close: () => void) => {
        close();
        startTransition(async () => {
            const result = await updateTreatmentStatusAction({ injuryId, treatmentId, status: next });
            toast(
                result.status === "success"
                    ? { title: t("doctorClinical.treatmentMenu.updated"), description: result.message }
                    : { tone: "error", title: t("doctorClinical.treatmentMenu.updateFailed"), description: result.message },
            );
        });
    };

    return (
        <Popover
            label={changeLabel}
            align="end"
            trigger={(props) => (
                <Button {...props} variant="ghost" size="icon-sm" loading={pending} aria-label={changeLabel}>
                    {!pending && <Ellipsis />}
                </Button>
            )}
            className="w-52 p-1.5"
        >
            {(close) => (
                <div className="flex flex-col">
                    <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-fg-subtle">{t("doctorClinical.treatmentMenu.changeStatus")}</p>
                    {STATUSES.map((value) => {
                        const meta = TREATMENT_STATUS_META[value];
                        const label = t(meta.label);
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
                                {current ? t("doctorClinical.treatmentMenu.current", { status: label }) : t("doctorClinical.treatmentMenu.moveTo", { status: label.toLowerCase() })}
                            </button>
                        );
                    })}
                </div>
            )}
        </Popover>
    );
}
