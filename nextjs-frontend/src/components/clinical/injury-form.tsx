"use client";

import { Activity, Info, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AINotice } from "@/components/domain/ai-notice";
import { RegionModel } from "@/components/doctor/region-model";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormFooter, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createInjuryAction } from "@/lib/actions/clinical";
import { BODY_REGION_LABELS, HEALTH_STATUS_LABELS, INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert, BodyRegion, InjuryMechanism, InjurySeverity, InjuryType } from "@/lib/domain/types";
import { addDaysToKey, daysBetweenKeys, formatShortDate, pluralizeVi } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BODY_REGION_GROUPS, INJURY_SEVERITY_DESCRIPTIONS, OPEN_INJURY_STATUS_DESCRIPTIONS } from "./clinical-copy";
import { ObservationSummary, type ObservationSource } from "./observation-summary";

export interface InjuryFighterOption extends FighterIdentityData {
    id: string;
}

export interface InjuryAlertOption {
    alert: AbnormalMovementAlert;
    source: ObservationSource | null;
}

export interface InjuryFormProps {
    fighters: InjuryFighterOption[];
    /** Observations of the doctor's fighters that aren't linked to another injury. */
    alerts: InjuryAlertOption[];
    defaultFighterId: string;
    defaultAlertId: string;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    /** YYYY-MM-DD in the academy timezone. */
    today: string;
    cancelHref: string;
}

const TYPES = Object.keys(INJURY_TYPE_LABELS) as InjuryType[];
const SEVERITY_OPTIONS: ChoiceOption<InjurySeverity>[] = (Object.keys(INJURY_SEVERITY_LABELS) as InjurySeverity[]).map((value) => ({
    value,
    label: INJURY_SEVERITY_LABELS[value],
    description: INJURY_SEVERITY_DESCRIPTIONS[value],
    icon: INJURY_SEVERITY_META[value].icon,
    tone: INJURY_SEVERITY_META[value].tone,
}));
const MECHANISMS = Object.keys(INJURY_MECHANISM_LABELS) as InjuryMechanism[];
const RETURN_PICKS = [
    { days: 7, label: "+1 tuần" },
    { days: 14, label: "+2 tuần" },
    { days: 28, label: "+4 tuần" },
    { days: 42, label: "+6 tuần" },
];

type OpenStatus = "active" | "recovering";

const STATUS_OPTIONS: ChoiceOption<OpenStatus>[] = [
    { value: "active", label: "Đang điều trị", description: OPEN_INJURY_STATUS_DESCRIPTIONS.active, icon: Activity, tone: "danger" },
    { value: "recovering", label: "Đang phục hồi", description: OPEN_INJURY_STATUS_DESCRIPTIONS.recovering, icon: RefreshCw, tone: "info" },
];

/** Records an injury: who and what, where on the body, severity and timeline, clinical findings and an optional AI observation link. */
export function InjuryForm({ fighters, alerts, defaultFighterId, defaultAlertId, nowInput, today, cancelHref }: InjuryFormProps) {
    const form = useActionForm(createInjuryAction, { id: "injury" });
    const id = (name: string) => `injury-${name}`;
    const { error } = form;

    const initialAlert = alerts.find((option) => option.alert.id === defaultAlertId)?.alert;
    const [fighterId, setFighterId] = useState(initialAlert?.fighterId ?? defaultFighterId);
    const [linkedAlertId, setLinkedAlertId] = useState(initialAlert?.id ?? "");
    const [type, setType] = useState<InjuryType | "">("");
    const [bodyRegion, setBodyRegion] = useState<BodyRegion | "">(initialAlert?.bodyRegion ?? "");
    const [severity, setSeverity] = useState<InjurySeverity | "">("");
    const [status, setStatus] = useState<OpenStatus>("active");
    const [mechanism, setMechanism] = useState<InjuryMechanism | "">("");
    const [occurredAt, setOccurredAt] = useState(nowInput);
    const [diagnosedAt, setDiagnosedAt] = useState(today);
    const [expectedReturnAt, setExpectedReturnAt] = useState("");
    const [description, setDescription] = useState("");

    const fighter = fighters.find((option) => option.id === fighterId) ?? null;
    const fighterAlerts = alerts.filter((option) => option.alert.fighterId === fighterId);
    const selectedAlert = fighterAlerts.find((option) => option.alert.id === linkedAlertId) ?? null;

    const changeFighter = (next: string) => {
        setFighterId(next);
        if (!alerts.some((option) => option.alert.id === linkedAlertId && option.alert.fighterId === next)) setLinkedAlertId("");
    };

    const changeAlert = (next: string) => {
        setLinkedAlertId(next);
        const alert = alerts.find((option) => option.alert.id === next)?.alert;
        if (alert && !bodyRegion) setBodyRegion(alert.bodyRegion);
    };

    const control = (name: string, options?: { hint?: boolean; required?: boolean }) => form.control(name, options);

    return (
        <form
            {...form.formProps}
            className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]"
        >
            {selectedAlert && (
                <section aria-labelledby="injury-context-heading" className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1">
                    <h2 id="injury-context-heading" className="text-sm font-semibold text-fg">
                        Quan sát liên kết
                    </h2>
                    <AINotice audience="doctor" compact />
                    <ObservationSummary alert={selectedAlert.alert} source={selectedAlert.source} />
                </section>
            )}

            <Card className="min-w-0 px-5 py-6 sm:px-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                <FormSection title="Võ sĩ" description="Võ sĩ bị chấn thương. Liên kết quan sát AI nếu quan sát đó dẫn tới lần đánh giá này.">
                    <Field label="Võ sĩ" htmlFor={id("fighterId")} error={error("fighterId")} required>
                        <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)} className="sm:max-w-sm">
                            <option value="">Chọn võ sĩ…</option>
                            {fighters.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field
                        label="Liên kết quan sát AI"
                        htmlFor={id("linkedAlertId")}
                        optional
                        error={error("linkedAlertId")}
                        hint={
                            !fighterId
                                ? "Hãy chọn võ sĩ trước."
                                : fighterAlerts.length === 0
                                  ? "Võ sĩ này không có quan sát AI nào chưa liên kết."
                                  : "Chỉ là thông tin hỗ trợ. Liên kết giúp đối chiếu mô hình AI với chấn thương đã xác định."
                        }
                    >
                        <Select
                            {...control("linkedAlertId", { hint: true })}
                            value={linkedAlertId}
                            onChange={(event) => changeAlert(event.target.value)}
                            disabled={fighterAlerts.length === 0}
                        >
                            <option value="">Không liên kết</option>
                            {fighterAlerts.map(({ alert }) => (
                                <option key={alert.id} value={alert.id}>
                                    {formatShortDate(alert.detectedAt)} · {BODY_REGION_LABELS[alert.bodyRegion]} — {alert.pattern}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection title="Chấn thương" description="Chấn thương gì, ở đâu và mức độ ra sao.">
                    <div className="grid grid-cols-1 gap-5">
                        <div className="grid min-w-0 grid-cols-1 items-start gap-5 sm:grid-cols-2">
                            <Field label="Loại chấn thương" htmlFor={id("type")} error={error("type")} required>
                                <Select {...control("type", { required: true })} value={type} onChange={(event) => setType(event.target.value as InjuryType | "")}>
                                    <option value="">Chọn loại…</option>
                                    {TYPES.map((value) => (
                                        <option key={value} value={value}>
                                            {INJURY_TYPE_LABELS[value]}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field
                                label="Vùng cơ thể"
                                htmlFor={id("bodyRegion")}
                                error={error("bodyRegion")}
                                required
                                hint="Trái/phải tính theo cơ thể võ sĩ."
                            >
                                <Select
                                    {...control("bodyRegion", { hint: true, required: true })}
                                    value={bodyRegion}
                                    onChange={(event) => setBodyRegion(event.target.value as BodyRegion | "")}
                                >
                                    <option value="">Chọn vùng…</option>
                                    {BODY_REGION_GROUPS.map((group) => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.regions.map((region) => (
                                                <option key={region} value={region}>
                                                    {BODY_REGION_LABELS[region]}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Select>
                            </Field>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 px-2 py-2">
                            <RegionModel targets={[{ region: bodyRegion }]} label={type ? INJURY_TYPE_LABELS[type] : "Vùng đã chọn"} height={360} legend={false} />
                        </div>
                    </div>

                    <ChoiceGroup
                        id={id("severity")}
                        name="severity"
                        legend="Mức độ"
                        required
                        options={SEVERITY_OPTIONS}
                        value={severity}
                        onChange={setSeverity}
                        error={error("severity")}
                    />

                    <ChoiceGroup
                        id={id("status")}
                        name="status"
                        legend="Tình trạng hiện tại"
                        required
                        columns={2}
                        options={STATUS_OPTIONS}
                        value={status}
                        onChange={setStatus}
                        error={error("status")}
                    />
                </FormSection>

                <FormSection title="Thời gian" description="Xảy ra khi nào, như thế nào và dự kiến khi nào võ sĩ tập lại đầy đủ.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field label="Xảy ra" htmlFor={id("occurredAt")} error={error("occurredAt")} required hint="Giờ học viện (TP. Hồ Chí Minh)">
                            <Input
                                {...control("occurredAt", { hint: true, required: true })}
                                type="datetime-local"
                                value={occurredAt}
                                max={nowInput}
                                onChange={(event) => setOccurredAt(event.target.value)}
                            />
                        </Field>
                        <Field label="Chẩn đoán" htmlFor={id("diagnosedAt")} error={error("diagnosedAt")} required>
                            <Input
                                {...control("diagnosedAt", { required: true })}
                                type="date"
                                value={diagnosedAt}
                                min={occurredAt.slice(0, 10) || undefined}
                                max={today}
                                onChange={(event) => setDiagnosedAt(event.target.value)}
                            />
                        </Field>
                        <Field label="Cơ chế" htmlFor={id("mechanism")} error={error("mechanism")} required>
                            <Select {...control("mechanism", { required: true })} value={mechanism} onChange={(event) => setMechanism(event.target.value as InjuryMechanism | "")}>
                                <option value="">Xảy ra như thế nào?</option>
                                {MECHANISMS.map((value) => (
                                    <option key={value} value={value}>
                                        {INJURY_MECHANISM_LABELS[value]}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field
                            label="Dự kiến tập lại đầy đủ"
                            htmlFor={id("expectedReturnAt")}
                            error={error("expectedReturnAt")}
                            className="sm:col-span-2"
                            optional
                            hint={
                                expectedReturnAt && diagnosedAt
                                    ? `${pluralizeVi(daysBetweenKeys(diagnosedAt, expectedReturnAt), "day")} sau chẩn đoán`
                                    : "Để trống nếu chưa ước tính được."
                            }
                        >
                            <div className="flex flex-col gap-2">
                                <Input
                                    {...control("expectedReturnAt", { hint: true })}
                                    type="date"
                                    value={expectedReturnAt}
                                    min={diagnosedAt || undefined}
                                    onChange={(event) => setExpectedReturnAt(event.target.value)}
                                    className="sm:w-56"
                                />
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Đặt ngày dự kiến trở lại tính từ ngày chẩn đoán">
                                    {RETURN_PICKS.map((pick) => (
                                        <Button
                                            key={pick.days}
                                            variant="secondary"
                                            size="sm"
                                            disabled={!diagnosedAt}
                                            onClick={() => {
                                                setExpectedReturnAt(addDaysToKey(diagnosedAt, pick.days));
                                                form.markEdited("expectedReturnAt");
                                            }}
                                        >
                                            {pick.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </Field>
                    </div>
                </FormSection>

                <FormSection title="Dấu hiệu lâm sàng" description="Chỉ bạn và các bác sĩ phụ trách khác xem được. HLV không bao giờ thấy ghi chú lâm sàng.">
                    <Field
                        label="Mô tả"
                        htmlFor={id("description")}
                        error={error("description")}
                        required
                        hint="Cơ chế, triệu chứng, kết quả khám và chẩn đoán hình ảnh (nếu có)."
                    >
                        <Textarea
                            {...control("description", { hint: true, required: true })}
                            rows={5}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={3000}
                        />
                    </Field>
                </FormSection>

                <FormFooter message={form.message} cancelHref={cancelHref} pending={form.pending} submitLabel="Ghi nhận chấn thương" pendingLabel="Đang ghi nhận chấn thương…" />
            </Card>

            <aside aria-label="Điều gì xảy ra tiếp theo" className={cn("min-w-0 lg:col-start-2", selectedAlert ? "lg:row-start-2" : "lg:row-start-1")}>
                <Card>
                    <CardHeader title="Khi bạn ghi nhận chấn thương này" icon={<Info />} />
                    <CardContent>
                        <ul className="flex flex-col gap-2.5 text-[13px] text-fg-muted">
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>
                                    {fighter
                                        ? fighter.healthStatus === "not_cleared"
                                            ? `${fighter.name} vẫn ở trạng thái ${HEALTH_STATUS_LABELS.not_cleared}.`
                                            : `Tình trạng sức khỏe của ${fighter.name} chuyển thành ${status === "recovering" ? HEALTH_STATUS_LABELS.recovery : HEALTH_STATUS_LABELS.injured}.`
                                        : "Tình trạng sức khỏe của võ sĩ chuyển thành Chấn thương, hoặc Phục hồi nếu ghi là đang phục hồi."}
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>HLV được nhắc kiểm tra giấy phép. HLV không thấy chẩn đoán hay ghi chú lâm sàng.</span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span>Võ sĩ thấy chấn thương, điều trị và các bước phục hồi trên trang Sức khỏe.</span>
                            </li>
                            <li className="flex gap-2">
                                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg-subtle" />
                                <span className="font-medium text-fg">Giấy phép không tự thay đổi — hãy xem lại ở bước tiếp theo.</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </aside>
        </form>
    );
}
