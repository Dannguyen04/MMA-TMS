"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { BodyMap } from "@/components/domain/body-map";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordInjuryAction } from "@/lib/actions/medical-contract";
import { API_INJURY_SEVERITIES, BODY_JOINT_LABELS, MEDICAL_TEXT_LIMITS, type ApiInjurySeverity, type BodyJoint } from "@/lib/domain/medical-contract";
import { JOINT_REGIONS } from "@/lib/domain/medical-mappings";
import { INJURY_SEVERITY_LABELS } from "@/lib/domain/labels";
import type { InjurySeverity } from "@/lib/domain/types";
import { INJURY_SEVERITY_DESCRIPTIONS } from "./clinical-copy";

export interface InjuryRecordFormProps {
    fighters: { id: string; name: string }[];
    defaultFighterId: string;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    cancelHref: string;
}

const JOINT_GROUPS: { label: string; joints: BodyJoint[] }[] = [
    { label: "Upper body", joints: ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST", "RIGHT_WRIST"] },
    { label: "Trunk", joints: ["SPINE_CORE"] },
    { label: "Lower body", joints: ["LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE"] },
];

const severityKey = (value: ApiInjurySeverity) => value.toLowerCase() as InjurySeverity;

const SEVERITY_OPTIONS: ChoiceOption<ApiInjurySeverity>[] = API_INJURY_SEVERITIES.map((value) => ({
    value,
    label: INJURY_SEVERITY_LABELS[severityKey(value)],
    description: INJURY_SEVERITY_DESCRIPTIONS[severityKey(value)],
    icon: INJURY_SEVERITY_META[severityKey(value)].icon,
    tone: INJURY_SEVERITY_META[severityKey(value)].tone,
}));

/** Records an injury as the medical service keeps it: the affected joint, the diagnosis in words, severity and when it happened. */
export function InjuryRecordForm({ fighters, defaultFighterId, nowInput, cancelHref }: InjuryRecordFormProps) {
    const form = useActionForm(recordInjuryAction, { id: "injury-record" });
    const { control, error } = form;
    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [joint, setJoint] = useState<BodyJoint | "">("");
    const [severity, setSeverity] = useState<ApiInjurySeverity | "">("");
    const [injuryType, setInjuryType] = useState("");

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <FormSection title="Fighter" description="Who was injured.">
                    <Field label="Fighter" htmlFor={control("fighterId").id} error={error("fighterId")} required>
                        <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)} className="sm:max-w-sm">
                            <option value="">Choose a fighter…</option>
                            {fighters.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection title="Injury" description="Where it is, what it is and how serious it is.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 flex-col gap-5">
                            <Field label="Affected joint" htmlFor={control("affectedJoint").id} error={error("affectedJoint")} required hint="Left and right are the athlete's own sides.">
                                <Select {...control("affectedJoint", { hint: true, required: true })} value={joint} onChange={(event) => setJoint(event.target.value as BodyJoint | "")}>
                                    <option value="">Choose a joint…</option>
                                    {JOINT_GROUPS.map((group) => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.joints.map((value) => (
                                                <option key={value} value={value}>
                                                    {BODY_JOINT_LABELS[value]}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Diagnosis" htmlFor={control("injuryType").id} error={error("injuryType")} required hint="In your words, e.g. “Grade II lateral ankle sprain”.">
                                <Input
                                    {...control("injuryType", { hint: true, required: true })}
                                    value={injuryType}
                                    onChange={(event) => setInjuryType(event.target.value)}
                                    maxLength={MEDICAL_TEXT_LIMITS.injuryType}
                                />
                            </Field>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-muted/60 px-4 py-3" aria-live="polite">
                            <BodyMap
                                size="sm"
                                showLegend={false}
                                highlights={joint ? [{ region: JOINT_REGIONS[joint], tone: severity === "MINOR" ? "warning" : "danger", label: injuryType || BODY_JOINT_LABELS[joint] }] : []}
                            />
                            <p className="text-center text-xs font-medium text-fg-muted">{joint ? BODY_JOINT_LABELS[joint] : "No joint selected"}</p>
                        </div>
                    </div>
                    <ChoiceGroup id="injury-record-severity" name="severity" legend="Severity" required columns={2} options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} error={error("severity")} />
                </FormSection>

                <FormSection title="When and what" description="When it happened and what you found.">
                    <Field label="Occurred" htmlFor={control("occurredAt").id} error={error("occurredAt")} required hint="Academy time (Ho Chi Minh City)">
                        <Input {...control("occurredAt", { hint: true, required: true })} type="datetime-local" defaultValue={nowInput} max={nowInput} className="sm:w-64" />
                    </Field>
                    <Field label="Clinical findings" htmlFor={control("description").id} error={error("description")} optional hint="Mechanism, symptoms, examination and imaging. Coaches never see this.">
                        <Textarea {...control("description", { hint: true })} rows={5} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
                    </Field>
                </FormSection>

                <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <FormMessage {...form.message} />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <ButtonLink href={cancelHref} variant="secondary" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Cancel
                        </ButtonLink>
                        <Button type="submit" size="lg" loading={form.pending} className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {form.pending ? "Recording injury…" : "Record injury"}
                        </Button>
                    </div>
                </div>
            </Card>

            <aside aria-label="What happens next" className="min-w-0">
                <Card>
                    <CardHeader title="When you record it" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li>The injury starts as active. Mark it recovering or resolved from the injury page.</li>
                            <li>Resolving is final: if it flares up again, record a new injury.</li>
                            <li className="font-medium text-fg">Medical Clearance doesn&apos;t change on its own — examine the fighter and review it next.</li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
