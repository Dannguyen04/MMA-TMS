"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { RegionModel } from "@/components/doctor/region-model";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormFooter, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm, type ActionForm } from "@/components/ui/use-action-form";
import { recordInjuryAction } from "@/lib/actions/medical-contract";
import { API_INJURY_SEVERITIES, BODY_JOINT_LABELS, MEDICAL_TEXT_LIMITS, type ApiInjurySeverity, type BodyJoint } from "@/lib/domain/medical-contract";
import { INJURY_SEVERITY_LABELS } from "@/lib/domain/labels";
import type { InjurySeverity } from "@/lib/domain/types";
import { addDaysToKey, toDateTimeInputValue } from "@/lib/format";
import { INJURY_SEVERITY_DESCRIPTIONS } from "./clinical-copy";

export interface InjuryRecordFormProps {
    fighters: { id: string; name: string }[];
    defaultFighterId: string;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    cancelHref: string;
}

const JOINT_GROUPS: { label: string; joints: BodyJoint[] }[] = [
    { label: "Thân trên", joints: ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST", "RIGHT_WRIST"] },
    { label: "Thân", joints: ["SPINE_CORE"] },
    { label: "Thân dưới", joints: ["LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE"] },
];

const severityKey = (value: ApiInjurySeverity) => value.toLowerCase() as InjurySeverity;

const SEVERITY_OPTIONS: ChoiceOption<ApiInjurySeverity>[] = API_INJURY_SEVERITIES.map((value) => ({
    value,
    label: INJURY_SEVERITY_LABELS[severityKey(value)],
    description: INJURY_SEVERITY_DESCRIPTIONS[severityKey(value)],
    icon: INJURY_SEVERITY_META[severityKey(value)].icon,
    tone: INJURY_SEVERITY_META[severityKey(value)].tone,
}));

/**
 * When the injury happened, as a day and a time that start at the moment the form opened. "Now", "Today" and
 * "Yesterday" change them in one tap ("Today" and "Yesterday" change only the day); the action reads the combined value.
 */
function OccurredAtField({ form, maxDay, nowInput }: { form: Pick<ActionForm<unknown>, "control" | "error" | "markEdited">; maxDay: string; nowInput: string }) {
    const [day, setDay] = useState(nowInput.slice(0, 10));
    const [time, setTime] = useState(nowInput.slice(11, 16));
    const control = form.control("occurredAt", { hint: true, required: true });
    const message = form.error("occurredAt");
    const pick = (value: string) => {
        const now = toDateTimeInputValue(new Date());
        if (value === "now") {
            setDay(now.slice(0, 10));
            setTime(now.slice(11));
        } else {
            setDay(value === "today" ? now.slice(0, 10) : addDaysToKey(now.slice(0, 10), -1));
        }
        form.markEdited("occurredAt");
    };
    return (
        <Field label="Xảy ra" htmlFor={control.id} error={message} required hint="Giờ học viện (TP. Hồ Chí Minh)">
            <div className="flex flex-col gap-2">
                <input type="hidden" name="occurredAt" value={day && time ? `${day}T${time}` : ""} />
                <div className="flex flex-wrap items-center gap-2">
                    <Input {...control} name={undefined} type="date" value={day} max={maxDay} onChange={(event) => setDay(event.target.value)} className="w-44" />
                    <Input
                        id={`${control.id}-time`}
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        aria-label="Thời điểm xảy ra"
                        aria-invalid={message ? true : undefined}
                        aria-required
                        className="w-32"
                    />
                </div>
                <SuggestionChips
                    label="Chọn nhanh"
                    suggestions={[
                        { label: "Bây giờ", value: "now" },
                        { label: "Hôm nay", value: "today" },
                        { label: "Hôm qua", value: "yesterday" },
                    ]}
                    onPick={pick}
                />
            </div>
        </Field>
    );
}

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
                <FormSection title="Võ sĩ" description="Võ sĩ bị chấn thương.">
                    <Field label="Võ sĩ" htmlFor={control("fighterId").id} error={error("fighterId")} required>
                        <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => setFighterId(event.target.value)} className="sm:max-w-sm">
                            <option value="">Chọn võ sĩ…</option>
                            {fighters.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection title="Chấn thương" description="Ở đâu, chấn thương gì và mức độ ra sao.">
                    <div className="grid grid-cols-1 gap-5">
                        <div className="grid min-w-0 grid-cols-1 items-start gap-5 sm:grid-cols-2">
                            <Field label="Khớp bị ảnh hưởng" htmlFor={control("affectedJoint").id} error={error("affectedJoint")} required hint="Trái/phải tính theo cơ thể võ sĩ.">
                                <Select {...control("affectedJoint", { hint: true, required: true })} value={joint} onChange={(event) => setJoint(event.target.value as BodyJoint | "")}>
                                    <option value="">Chọn khớp…</option>
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
                            <Field label="Chẩn đoán" htmlFor={control("injuryType").id} error={error("injuryType")} required hint="Theo cách bạn mô tả, VD: “Bong gân cổ chân ngoài độ II”.">
                                <Input
                                    {...control("injuryType", { hint: true, required: true })}
                                    value={injuryType}
                                    onChange={(event) => setInjuryType(event.target.value)}
                                    maxLength={MEDICAL_TEXT_LIMITS.injuryType}
                                />
                            </Field>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 px-2 py-2">
                            <RegionModel targets={[{ joint }]} label={injuryType || undefined} height={320} emptyText="Chưa chọn khớp" legend={false} />
                        </div>
                    </div>
                    <ChoiceGroup id="injury-record-severity" name="severity" legend="Mức độ" required columns={2} options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} error={error("severity")} />
                </FormSection>

                <FormSection title="Thời điểm và chẩn đoán" description="Xảy ra khi nào và bạn phát hiện gì.">
                    <OccurredAtField form={form} maxDay={nowInput.slice(0, 10)} nowInput={nowInput} />
                    <Field label="Dấu hiệu lâm sàng" htmlFor={control("description").id} error={error("description")} optional hint="Cơ chế, triệu chứng, khám và chẩn đoán hình ảnh. HLV không bao giờ thấy phần này.">
                        <Textarea {...control("description", { hint: true })} rows={5} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
                    </Field>
                </FormSection>

                <FormFooter message={form.message} cancelHref={cancelHref} pending={form.pending} submitLabel="Ghi nhận chấn thương" pendingLabel="Đang ghi nhận chấn thương…" />
            </Card>

            <aside aria-label="Điều gì xảy ra tiếp theo" className="min-w-0">
                <Card>
                    <CardHeader title="Khi bạn ghi nhận" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li>Chấn thương bắt đầu ở trạng thái đang điều trị. Chuyển sang đang phục hồi hoặc đã khỏi từ trang chấn thương.</li>
                            <li>Đánh dấu đã khỏi là cuối cùng: nếu tái phát, hãy ghi chấn thương mới.</li>
                            <li className="font-medium text-fg">Giấy phép không tự thay đổi — hãy khám võ sĩ và xem lại ở bước tiếp theo.</li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
