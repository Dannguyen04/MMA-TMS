"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { toFormData } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { updateHealthStatusAction } from "@/lib/actions/medical";
import { IDLE } from "@/lib/actions/state";
import { HEALTH_STATUS_DESCRIPTIONS, HEALTH_STATUS_LABELS } from "@/lib/domain/labels";
import type { HealthStatus } from "@/lib/domain/types";

const STATUSES = Object.keys(HEALTH_STATUS_LABELS) as HealthStatus[];

export interface HealthStatusControlProps {
    fighterId: string;
    fighterName: string;
    current: HealthStatus;
}

/** Manual health status change, confirmed because coaches see and are notified of the change. */
export function HealthStatusControl({ fighterId, fighterName, current }: HealthStatusControlProps) {
    const [selected, setSelected] = useState<HealthStatus>(current);
    const toast = useToast();
    const selectId = useId();

    const update = useConfirmAction((status: HealthStatus) => updateHealthStatusAction(IDLE, toFormData({ fighterId, status })), {
        onSuccess: (_state, status) => toast({ title: `${fighterName}: ${HEALTH_STATUS_LABELS[status]}`, description: "Their coaches have been notified of the change." }),
    });
    const target = update.payload ?? selected;
    const hint = selected === current ? "Choose a new status to update it." : HEALTH_STATUS_DESCRIPTIONS[selected];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
                <Field label="Change health status" htmlFor={selectId} className="min-w-0 flex-1">
                    <Select id={selectId} value={selected} onChange={(event) => setSelected(event.target.value as HealthStatus)} aria-describedby={`${selectId}-status-hint`}>
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {HEALTH_STATUS_LABELS[status]}
                                {status === current ? " (current)" : ""}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Button variant="secondary" disabled={selected === current} onClick={() => update.request(selected)}>
                    Update
                </Button>
            </div>
            <p id={`${selectId}-status-hint`} className="text-[13px] text-fg-subtle">
                {hint}
            </p>

            <ConfirmDialog
                {...update.dialogProps}
                tone="primary"
                title={`Set ${fighterName} to ${HEALTH_STATUS_LABELS[target]}?`}
                description={`${fighterName}'s coaches will see the new status straight away and get a notification. Medical Clearance doesn't change — update it separately if training limits should change.`}
                confirmLabel="Update health status"
            />
        </div>
    );
}
