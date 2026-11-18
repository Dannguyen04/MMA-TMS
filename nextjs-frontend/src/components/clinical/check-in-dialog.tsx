"use client";

import { History, NotebookPen } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useLocale, useT } from "@/components/i18n/locale-provider";
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
    { value: 0, label: "doctorClinical.pain.none" },
    { value: 5, label: "doctorClinical.pain.moderate" },
    { value: 10, label: "doctorClinical.pain.worst" },
] as const;

/** "Log check-in" button with a dialog: date, pain slider, mobility and strength, and a note. */
export function CheckInDialog({ planId, fighterName, minDate, today, lastCheckIn }: CheckInDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();
    const t = useT();

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <NotebookPen aria-hidden />
                {t("doctorClinical.checkIn.log")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("doctorClinical.checkIn.title")}
                description={t("doctorClinical.checkIn.description", { name: fighterName })}
                action={addCheckInAction}
                submitLabel={t("doctorClinical.checkIn.log")}
                pendingLabel={t("doctorClinical.common.saving")}
                onSuccess={(state) => toast({ title: t("doctorClinical.checkIn.logged"), description: state.message })}
            >
                {(form) => <CheckInFields form={form} planId={planId} minDate={minDate} today={today} lastCheckIn={lastCheckIn} />}
            </ActionDialog>
        </>
    );
}

function CheckInFields({ form, planId, minDate, today, lastCheckIn }: Omit<CheckInDialogProps, "fighterName"> & { form: ActionForm<undefined> }) {
    const [painLevel, setPainLevel] = useState(lastCheckIn?.painLevel ?? 0);
    const { control, error } = form;
    const t = useT();
    const locale = useLocale();

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
                    {t("doctorClinical.checkIn.last", {
                        date: formatDate(lastCheckIn.date, locale),
                        pain: lastCheckIn.painLevel,
                        mobility: lastCheckIn.mobilityPct,
                        strength: lastCheckIn.strengthPct,
                    })}
                </InlineNote>
            )}

            <Field label={t("doctorClinical.common.date")} htmlFor={control("date").id} error={error("date")} required>
                <Input {...control("date", { required: true })} type="date" defaultValue={today} min={minDate} max={today} className="sm:max-w-48" />
            </Field>

            <ScaleSlider
                id={control("painLevel").id}
                name="painLevel"
                label={t("doctorClinical.checkIn.pain")}
                min={0}
                max={10}
                value={painLevel}
                onChange={setPainLevel}
                formatValue={(level) => `${level}/10 · ${painLabel(level, undefined, t)}`}
                anchors={PAIN_ANCHORS.map((anchor) => ({ value: anchor.value, label: t(anchor.label) }))}
                showTicks
                hint={t("doctorClinical.checkIn.painHint")}
                error={error("painLevel")}
                required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {percentField("mobilityPct", t("doctorClinical.checkIn.mobility"), t("doctorClinical.checkIn.mobilityHint"))}
                {percentField("strengthPct", t("doctorClinical.checkIn.strength"), t("doctorClinical.checkIn.strengthHint"))}
            </div>

            <Field label={t("doctorClinical.common.notes")} htmlFor={control("note").id} error={error("note")} optional>
                <Textarea {...control("note")} rows={3} maxLength={500} placeholder={t("doctorClinical.checkIn.notePlaceholder")} />
            </Field>
        </>
    );
}
