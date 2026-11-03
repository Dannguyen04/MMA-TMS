"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

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

    return (
        <>
            <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                Thêm điều trị
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title="Thêm điều trị"
                description={
                    mode === "service"
                        ? "Võ sĩ xem được trên trang Sức khỏe; HLV không xem được. Điều trị không thể sửa sau khi lưu."
                        : "Võ sĩ xem điều trị trên trang Sức khỏe. HLV không xem được."
                }
                action={mode === "service" ? recordTreatmentAction : addTreatmentAction}
                submitLabel="Thêm điều trị"
                pendingLabel="Đang thêm…"
                onSuccess={(state) => toast({ title: "Đã thêm điều trị", description: state.message })}
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
            <Field label="Loại điều trị" {...field("type")} required>
                <Select {...control("type", { required: true })} defaultValue="">
                    <option value="">Chọn loại…</option>
                    {TYPES.map((value) => (
                        <option key={value} value={value}>
                            {TREATMENT_TYPE_LABELS[value]}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Trạng thái" {...field("status")} required>
                <Select {...control("status", { required: true })} value={status} onChange={(event) => setStatus(event.target.value as TreatmentStatus)}>
                    {STATUSES.map((value) => (
                        <option key={value} value={value}>
                            {TREATMENT_STATUS_LABELS[value]}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Mô tả" {...field("description")} required className="sm:col-span-2">
                <Input {...control("description", { required: true })} placeholder="VD: Chương trình tải lệch tâm cơ đùi sau" maxLength={300} />
            </Field>
            <Field label="Nơi thực hiện" {...field("providerName")} required>
                <Input {...control("providerName", { required: true })} defaultValue={providerName} maxLength={120} />
            </Field>
            <Field label="Tần suất" {...field("frequency")} required hint="VD: 3 lần/tuần, hằng ngày, một lần">
                <Input {...control("frequency", { hint: true, required: true })} maxLength={120} />
            </Field>
            <Field label="Ngày bắt đầu" {...field("startDate")} required>
                <Input {...control("startDate", { required: true })} type="date" value={startDate} onChange={(event) => changeStart(event.target.value)} />
            </Field>
            <Field
                label="Ngày kết thúc"
                {...field("endDate")}
                optional={status !== "completed"}
                required={status === "completed"}
                hint={status === "completed" ? "Bắt buộc với điều trị đã hoàn tất." : "Để trống nếu điều trị chưa có ngày kết thúc."}
            >
                <Input {...control("endDate", { hint: true, required: status === "completed" })} type="date" min={startDate || undefined} />
            </Field>
            <Field label="Ghi chú" {...field("notes")} optional className="sm:col-span-2">
                <Textarea {...control("notes")} rows={3} maxLength={1000} />
            </Field>
        </div>
    );
}

/** A treatment as the medical service records it: what was done, when, and when to review it. */
function ServiceTreatmentFields({ form, injuryId, fighterId, today }: { form: ActionForm<undefined>; injuryId: string; fighterId: string; today: string }) {
    const [treatmentDate, setTreatmentDate] = useState(today);
    const { control, error } = form;
    const field = (name: string) => ({ htmlFor: control(name).id, error: error(name) });

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="injuryId" value={injuryId} />
            <input type="hidden" name="fighterId" value={fighterId} />
            <Field label="Điều trị" {...field("treatmentType")} required hint="VD: Vật lý trị liệu, chườm lạnh và băng ép, chuyển chụp MRI" className="sm:col-span-2">
                <Input {...control("treatmentType", { hint: true, required: true })} maxLength={MEDICAL_TEXT_LIMITS.treatmentType} />
            </Field>
            <Field label="Ngày" {...field("treatmentDate")} required>
                <Input {...control("treatmentDate", { required: true })} type="date" value={treatmentDate} max={today} onChange={(event) => setTreatmentDate(event.target.value)} />
            </Field>
            <Field label="Đánh giá lại ngày" {...field("nextReviewAt")} optional hint="Ngày bạn kiểm tra lại hiệu quả.">
                <Input {...control("nextReviewAt", { hint: true })} type="date" min={treatmentDate || undefined} />
            </Field>
            <Field label="Chi tiết" {...field("description")} optional className="sm:col-span-2">
                <Textarea {...control("description")} rows={3} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
            </Field>
            <Field label="Ghi chú kết quả" {...field("outcomeNotes")} optional className="sm:col-span-2">
                <Textarea {...control("outcomeNotes")} rows={2} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
            </Field>
        </div>
    );
}
