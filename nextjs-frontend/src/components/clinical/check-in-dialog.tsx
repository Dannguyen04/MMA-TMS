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
    { value: 0, label: "Không đau" },
    { value: 5, label: "Trung bình" },
    { value: 10, label: "Đau tột độ" },
];

/** "Log check-in" button with a dialog: date, pain slider, mobility and strength, and a note. */
export function CheckInDialog({ planId, fighterName, minDate, today, lastCheckIn }: CheckInDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <NotebookPen aria-hidden />
                Ghi kiểm tra
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Ghi kiểm tra phục hồi"
                description={`Đáp ứng hôm nay của ${fighterName}. Mức đau do võ sĩ tự báo; vận động và sức mạnh so với bên lành.`}
                action={addCheckInAction}
                submitLabel="Ghi kiểm tra"
                pendingLabel="Đang lưu…"
                onSuccess={(state) => toast({ title: "Đã ghi kiểm tra", description: state.message })}
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
                    Lần kiểm tra gần nhất {formatDate(lastCheckIn.date)}: đau {lastCheckIn.painLevel}/10, mobility {lastCheckIn.mobilityPct}%, sức mạnh{" "}
                    {lastCheckIn.strengthPct}%
                </InlineNote>
            )}

            <Field label="Ngày" htmlFor={control("date").id} error={error("date")} required>
                <Input {...control("date", { required: true })} type="date" defaultValue={today} min={minDate} max={today} className="sm:max-w-48" />
            </Field>

            <ScaleSlider
                id={control("painLevel").id}
                name="painLevel"
                label="Đau"
                min={0}
                max={10}
                value={painLevel}
                onChange={setPainLevel}
                formatValue={(level) => `${level}/10 · ${painLabel(level)}`}
                anchors={PAIN_ANCHORS}
                showTicks
                hint="Võ sĩ tự báo, từ 0 (không đau) đến 10 (đau tột độ)."
                error={error("painLevel")}
                required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {percentField("mobilityPct", "Vận động", "Biên độ vận động so với bên lành, tính theo %")}
                {percentField("strengthPct", "Sức mạnh", "Sức mạnh so với bên lành, tính theo %")}
            </div>

            <Field label="Ghi chú" htmlFor={control("note").id} error={error("note")} optional>
                <Textarea {...control("note")} rows={3} maxLength={500} placeholder="Đã làm gì, cảm giác thế nào, có gì thay đổi" />
            </Field>
        </>
    );
}
