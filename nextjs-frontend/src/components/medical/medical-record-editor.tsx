"use client";

import { FilePlus, Plus, SquarePen, X } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { updateMedicalRecordAction } from "@/lib/actions/medical";
import type { MedicalRecord } from "@/lib/domain/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not recorded"];
const NOTES_HINT = "Background a colleague should know before examining this fighter.";

export type EditableMedicalRecord = Pick<
    MedicalRecord,
    "bloodType" | "allergies" | "chronicConditions" | "medications" | "surgicalHistory" | "emergencyContact" | "notes"
>;

export interface MedicalRecordEditorProps {
    fighterId: string;
    fighterName: string;
    /** Null when no record has been opened yet — saving opens one. */
    record: EditableMedicalRecord | null;
}

/** "Edit record" button and dialog for the fighter's medical record. */
export function MedicalRecordEditor({ fighterId, fighterName, record }: MedicalRecordEditorProps) {
    const [open, setOpen] = useState(false);
    const toast = useToast();
    return (
        <>
            <Button variant={record ? "secondary" : "primary"} onClick={() => setOpen(true)}>
                {record ? <SquarePen aria-hidden /> : <FilePlus aria-hidden />}
                {record ? "Edit record" : "Open medical record"}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title={record ? "Edit medical record" : "Open medical record"}
                description={`${fighterName} · Visible to assigned sports doctors only. Coaches never see this record.`}
                action={updateMedicalRecordAction}
                submitLabel="Save record"
                pendingLabel="Saving…"
                onSuccess={() => toast({ title: "Medical record saved", description: "Changes are visible to the fighter's assigned sports doctors." })}
            >
                {(form) => <RecordFields form={form} fighterId={fighterId} record={record} />}
            </ActionDialog>
        </>
    );
}

interface SurgeryRow {
    key: number;
    year: string;
    procedure: string;
}

function RecordFields({ form, fighterId, record }: { form: ActionForm<undefined>; fighterId: string; record: EditableMedicalRecord | null }) {
    const [surgeries, setSurgeries] = useState<SurgeryRow[]>(() =>
        (record?.surgicalHistory ?? []).map((entry, index) => ({ key: index, year: String(entry.year), procedure: entry.procedure })),
    );
    const [nextKey, setNextKey] = useState(surgeries.length);

    const { control, error, markEdited } = form;
    const id = (name: string) => control(name).id;
    const bloodTypes = record && !BLOOD_TYPES.includes(record.bloodType) ? [record.bloodType, ...BLOOD_TYPES] : BLOOD_TYPES;

    const textField = (name: "allergies" | "chronicConditions" | "medications", label: string, hint: string, placeholder: string) => (
        <Field label={label} htmlFor={id(name)} hint={hint} error={error(name)} optional>
            <Textarea {...control(name, { hint })} rows={3} defaultValue={(record?.[name] ?? []).join("\n")} placeholder={placeholder} />
        </Field>
    );

    const surgeryPayload = JSON.stringify(
        surgeries.map((row) => ({ year: row.year.trim() === "" ? null : Number(row.year), procedure: row.procedure })),
    );

    return (
        <>
            <input type="hidden" name="fighterId" value={fighterId} />
            <input type="hidden" name="surgicalHistory" value={surgeryPayload} />

            <section aria-labelledby={`${id("clinical")}-heading`} className="flex flex-col gap-4">
                <h3 id={`${id("clinical")}-heading`} className="text-sm font-semibold text-fg">
                    Clinical details
                </h3>
                <Field label="Blood type" htmlFor={id("bloodType")} error={error("bloodType")} required className="sm:max-w-56">
                    <Select {...control("bloodType", { required: true })} defaultValue={record?.bloodType ?? "Not recorded"}>
                        {bloodTypes.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </Select>
                </Field>
                {textField("allergies", "Allergies", "One per line, with the reaction if known. Leave empty when there are no known allergies.", "Penicillin — rash")}
                {textField("chronicConditions", "Chronic conditions", "One per line.", "Exercise-induced asthma — well controlled")}
                {textField("medications", "Current medications", "One per line, with dose and frequency.", "Salbutamol inhaler 100 mcg as required")}
            </section>

            <section aria-labelledby={`${id("surgery")}-heading`} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 id={`${id("surgery")}-heading`} className="text-sm font-semibold text-fg">
                        Surgical history <span className="text-xs font-normal text-fg-subtle">(optional)</span>
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSurgeries((rows) => [...rows, { key: nextKey, year: "", procedure: "" }]);
                            setNextKey((key) => key + 1);
                            markEdited("surgicalHistory");
                        }}
                    >
                        <Plus aria-hidden />
                        Add procedure
                    </Button>
                </div>
                {error("surgicalHistory") && <p className="text-[13px] font-medium text-danger-fg">{error("surgicalHistory")}</p>}
                {surgeries.length === 0 ? (
                    <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] text-fg-muted">No surgical history recorded.</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <div aria-hidden className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] gap-2 text-xs font-medium text-fg-muted">
                            <span>Year</span>
                            <span>Procedure</span>
                        </div>
                        <ul className="flex flex-col gap-2">
                            {surgeries.map((row, index) => {
                                const yearError = error(`surgicalHistory.${index}.year`);
                                const procedureError = error(`surgicalHistory.${index}.procedure`);
                                const rowErrorId = `${id("surgery")}-${row.key}-error`;
                                const update = (field: "year" | "procedure", value: string) => {
                                    setSurgeries((rows) => rows.map((candidate) => (candidate.key === row.key ? { ...candidate, [field]: value } : candidate)));
                                    markEdited(`surgicalHistory.${index}.${field}`);
                                };
                                return (
                                    <li key={row.key} className="flex flex-col gap-1">
                                        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                                            <Input
                                                inputMode="numeric"
                                                maxLength={4}
                                                value={row.year}
                                                onChange={(event) => update("year", event.target.value)}
                                                placeholder="2019"
                                                aria-label={`Year of procedure ${index + 1}`}
                                                aria-invalid={yearError ? true : undefined}
                                                aria-describedby={yearError ? rowErrorId : undefined}
                                            />
                                            <Input
                                                value={row.procedure}
                                                onChange={(event) => update("procedure", event.target.value)}
                                                placeholder="Right ACL reconstruction"
                                                aria-label={`Procedure ${index + 1}`}
                                                aria-invalid={procedureError ? true : undefined}
                                                aria-describedby={procedureError ? rowErrorId : undefined}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove procedure ${index + 1}`}
                                                onClick={() => {
                                                    setSurgeries((rows) => rows.filter((candidate) => candidate.key !== row.key));
                                                    markEdited("surgicalHistory");
                                                }}
                                            >
                                                <X />
                                            </Button>
                                        </div>
                                        {(yearError || procedureError) && (
                                            <p id={rowErrorId} className="text-[13px] font-medium text-danger-fg">
                                                {[yearError, procedureError].filter(Boolean).join(" ")}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </section>

            <section aria-labelledby={`${id("contact")}-heading`} className="flex flex-col gap-4">
                <h3 id={`${id("contact")}-heading`} className="text-sm font-semibold text-fg">
                    Emergency contact
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name" htmlFor={id("emergencyName")} error={error("emergencyName")} optional>
                        <Input {...control("emergencyName")} autoComplete="off" defaultValue={record?.emergencyContact.name ?? ""} />
                    </Field>
                    <Field label="Relationship" htmlFor={id("emergencyRelation")} error={error("emergencyRelation")} optional>
                        <Input {...control("emergencyRelation")} autoComplete="off" defaultValue={record?.emergencyContact.relation ?? ""} placeholder="e.g. Mother" />
                    </Field>
                    <Field label="Phone" htmlFor={id("emergencyPhone")} error={error("emergencyPhone")} optional className="sm:col-span-2 sm:max-w-72">
                        <Input {...control("emergencyPhone")} type="tel" autoComplete="off" defaultValue={record?.emergencyContact.phone ?? ""} placeholder="+84 903 000 000" />
                    </Field>
                </div>
            </section>

            <Field label="Clinical notes" htmlFor={id("notes")} hint={NOTES_HINT} error={error("notes")} optional>
                <Textarea {...control("notes", { hint: NOTES_HINT })} rows={4} defaultValue={record?.notes ?? ""} />
            </Field>
        </>
    );
}
