"use client";

import { History, NotebookPen } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ScaleSlider } from "@/components/ui/scale-slider";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { addCheckInAction } from "@/lib/actions/clinical";
import type { RecoveryCheckIn } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { painLabel } from "./clinical-copy";

export interface CheckInDialogProps {
    planId: string;
    fighterName: string;
    /** YYYY-MM-DD bounds in the academy timezone. */
    minDate: string;
    today: string;
    lastCheckIn: RecoveryCheckIn | null;
}

const PAIN_ANCHORS = [
    { value: 0, label: "No pain" },
    { value: 5, label: "Moderate" },
    { value: 10, label: "Worst imaginable" },
];

/** "Log check-in" button with a dialog: date, pain slider, mobility and strength, and a note. */
export function CheckInDialog({ planId, fighterName, minDate, today, lastCheckIn }: CheckInDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <NotebookPen aria-hidden />
                Log check-in
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Log recovery check-in"
                description={`How ${fighterName} is responding today. Pain is self-reported; mobility and strength are compared with the healthy side.`}
                action={addCheckInAction}
                submitLabel="Log check-in"
                pendingLabel="Saving…"
                onSuccess={(state) => toast({ title: "Check-in logged", description: state.message })}
            >
                {(form) => <CheckInFields form={form} planId={planId} minDate={minDate} today={today} lastCheckIn={lastCheckIn} />}
            </ActionDialog>
        </>
    );
}

function CheckInFields({ form, planId, minDate, today, lastCheckIn }: Omit<CheckInDialogProps, "fighterName"> & { form: ActionForm<undefined> }) {
    const [painLevel, setPainLevel] = useState(lastCheckIn?.painLevel ?? 0);
    const { control, error } = form;

    const percentField = (name: "mobilityPct" | "strengthPct", label: string, hint: string) => (
        <Field label={label} htmlFor={control(name).id} error={error(name)} required hint={hint}>
            <Input
                {...control(name, { hint, required: true })}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                suffix="%"
                defaultValue={lastCheckIn ? lastCheckIn[name] : undefined}
            />
        </Field>
    );

    return (
        <>
            <input type="hidden" name="planId" value={planId} />
            {lastCheckIn && (
                <InlineNote icon={History}>
                    Last check-in {formatDate(lastCheckIn.date)}: pain {lastCheckIn.painLevel}/10, mobility {lastCheckIn.mobilityPct}%, strength{" "}
                    {lastCheckIn.strengthPct}%
                </InlineNote>
            )}

            <Field label="Date" htmlFor={control("date").id} error={error("date")} required>
                <Input {...control("date", { required: true })} type="date" defaultValue={today} min={minDate} max={today} className="sm:max-w-48" />
            </Field>

            <ScaleSlider
                id={control("painLevel").id}
                name="painLevel"
                label="Pain"
                min={0}
                max={10}
                value={painLevel}
                onChange={setPainLevel}
                formatValue={(level) => `${level}/10 · ${painLabel(level)}`}
                anchors={PAIN_ANCHORS}
                showTicks
                hint="Self-reported by the fighter, from 0 (no pain) to 10 (worst imaginable)."
                error={error("painLevel")}
                required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {percentField("mobilityPct", "Mobility", "Range of motion vs the healthy side, as a percentage")}
                {percentField("strengthPct", "Strength", "Strength vs the healthy side, as a percentage")}
            </div>

            <Field label="Note" htmlFor={control("note").id} error={error("note")} optional>
                <Textarea {...control("note")} rows={3} maxLength={500} placeholder="What was done, how it felt, anything that changed" />
            </Field>
        </>
    );
}
