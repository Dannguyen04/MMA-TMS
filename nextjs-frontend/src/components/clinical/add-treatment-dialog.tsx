"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { addTreatmentAction } from "@/lib/actions/clinical";
import { recordTreatmentAction } from "@/lib/actions/medical-contract";
import { TREATMENT_STATUS_LABELS, TREATMENT_TYPE_LABELS } from "@/lib/domain/labels";
import { MEDICAL_TEXT_LIMITS } from "@/lib/domain/medical-contract";
import type { TreatmentStatus, TreatmentType } from "@/lib/domain/types";
import { treatmentStatusText, treatmentTypeText } from "./clinical-copy";

const TYPES = Object.keys(TREATMENT_TYPE_LABELS) as TreatmentType[];
const STATUSES = Object.keys(TREATMENT_STATUS_LABELS) as TreatmentStatus[];

export interface AddTreatmentDialogProps {
    injuryId: string;
    fighterId: string;
    /** "service" records a treatment in the medical service's terms (append-only, no status); "demo" uses the demo form. */
    mode: "demo" | "service";
    /** Default provider — usually the signed-in doctor. */
    providerName: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    variant?: ButtonVariant;
}

/** "Add treatment" button with a dialog form. Stays on the injury and confirms with a toast. */
export function AddTreatmentDialog({ injuryId, fighterId, mode, providerName, today, variant = "secondary" }: AddTreatmentDialogProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();
    const t = useT();

    return (
        <>
            <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                {t("doctorClinical.treatment.add")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={t("doctorClinical.treatment.add")}
                description={mode === "service" ? t("doctorClinical.treatment.serviceDescription") : t("doctorClinical.treatment.demoDescription")}
                action={mode === "service" ? recordTreatmentAction : addTreatmentAction}
                submitLabel={t("doctorClinical.treatment.add")}
                pendingLabel={t("doctorClinical.common.adding")}
                onSuccess={(state) => toast({ title: t("doctorClinical.treatment.added"), description: state.message })}
            >
                {(form) =>
                    mode === "service" ? (
                        <ServiceTreatmentFields form={form} injuryId={injuryId} fighterId={fighterId} today={today} />
                    ) : (
                        <TreatmentFields form={form} injuryId={injuryId} providerName={providerName} today={today} />
                    )
                }
            </ActionDialog>
        </>
    );
}

function TreatmentFields({ form, injuryId, providerName, today }: { form: ActionForm<undefined>; injuryId: string; providerName: string; today: string }) {
    const t = useT();
    const [startDate, setStartDate] = useState(today);
    const [status, setStatus] = useState<TreatmentStatus>("ongoing");
    const { control, error } = form;
    const field = (name: string) => ({ htmlFor: control(name).id, error: error(name) });

    const changeStart = (value: string) => {
        setStartDate(value);
        setStatus((current) => (value > today ? "planned" : current === "planned" ? "ongoing" : current));
    };

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="injuryId" value={injuryId} />
            <Field label={t("doctorClinical.treatment.type")} {...field("type")} required>
                <Select {...control("type", { required: true })} defaultValue="">
                    <option value="">{t("doctorClinical.common.chooseType")}</option>
                    {TYPES.map((value) => (
                        <option key={value} value={value}>
                            {treatmentTypeText(t, value)}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={t("doctorClinical.treatment.status")} {...field("status")} required>
                <Select {...control("status", { required: true })} value={status} onChange={(event) => setStatus(event.target.value as TreatmentStatus)}>
                    {STATUSES.map((value) => (
                        <option key={value} value={value}>
                            {treatmentStatusText(t, value)}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label={t("doctorClinical.common.description")} {...field("description")} required className="sm:col-span-2">
                <Input {...control("description", { required: true })} placeholder={t("doctorClinical.treatment.descriptionPlaceholder")} maxLength={300} />
            </Field>
            <Field label={t("doctorClinical.treatment.provider")} {...field("providerName")} required>
                <Input {...control("providerName", { required: true })} defaultValue={providerName} maxLength={120} />
            </Field>
            <Field label={t("doctorClinical.treatment.frequency")} {...field("frequency")} required hint={t("doctorClinical.treatment.frequencyHint")}>
                <Input {...control("frequency", { hint: true, required: true })} maxLength={120} />
            </Field>
            <Field label={t("doctorClinical.common.startDate")} {...field("startDate")} required>
                <Input {...control("startDate", { required: true })} type="date" value={startDate} onChange={(event) => changeStart(event.target.value)} />
            </Field>
            <Field
                label={t("doctorClinical.treatment.endDate")}
                {...field("endDate")}
                optional={status !== "completed"}
                required={status === "completed"}
                hint={status === "completed" ? t("doctorClinical.treatment.endDateRequired") : t("doctorClinical.treatment.endDateOptional")}
            >
                <Input {...control("endDate", { hint: true, required: status === "completed" })} type="date" min={startDate || undefined} />
            </Field>
            <Field label={t("doctorClinical.common.notes")} {...field("notes")} optional className="sm:col-span-2">
                <Textarea {...control("notes")} rows={3} maxLength={1000} />
            </Field>
        </div>
    );
}

/** A treatment as the medical service records it: what was done, when, and when to review it. */
function ServiceTreatmentFields({ form, injuryId, fighterId, today }: { form: ActionForm<undefined>; injuryId: string; fighterId: string; today: string }) {
    const t = useT();
    const [treatmentDate, setTreatmentDate] = useState(today);
    const { control, error } = form;
    const field = (name: string) => ({ htmlFor: control(name).id, error: error(name) });

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="injuryId" value={injuryId} />
            <input type="hidden" name="fighterId" value={fighterId} />
            <Field label={t("doctorClinical.treatmentType.fallback")} {...field("treatmentType")} required hint={t("doctorClinical.treatment.serviceTypeHint")} className="sm:col-span-2">
                <Input {...control("treatmentType", { hint: true, required: true })} maxLength={MEDICAL_TEXT_LIMITS.treatmentType} />
            </Field>
            <Field label={t("doctorClinical.common.date")} {...field("treatmentDate")} required>
                <Input {...control("treatmentDate", { required: true })} type="date" value={treatmentDate} max={today} onChange={(event) => setTreatmentDate(event.target.value)} />
            </Field>
            <Field label={t("doctorClinical.treatment.nextReview")} {...field("nextReviewAt")} optional hint={t("doctorClinical.treatment.nextReviewHint")}>
                <Input {...control("nextReviewAt", { hint: true })} type="date" min={treatmentDate || undefined} />
            </Field>
            <Field label={t("doctorClinical.treatment.details")} {...field("description")} optional className="sm:col-span-2">
                <Textarea {...control("description")} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
            </Field>
            <Field label={t("doctorClinical.treatment.outcomeNotes")} {...field("outcomeNotes")} optional className="sm:col-span-2">
                <Textarea {...control("outcomeNotes")} rows={2} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
            </Field>
        </div>
    );
}
