"use client";

import { Activity, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AINotice } from "@/components/domain/ai-notice";
import { RegionModel } from "@/components/doctor/region-model";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { INJURY_SEVERITY_META } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createInjuryAction } from "@/lib/actions/clinical";
import { BODY_REGION_LABELS, INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert, BodyRegion, InjuryMechanism, InjurySeverity, InjuryType } from "@/lib/domain/types";
import { addDaysToKey, daysBetweenKeys, formatShortDate, pluralizeVi } from "@/lib/format";
import { BODY_REGION_GROUPS, INJURY_SEVERITY_DESCRIPTIONS, OPEN_INJURY_STATUS_DESCRIPTIONS } from "./clinical-copy";
import { ObservationSummary, type ObservationSource } from "./observation-summary";
import type { ProgressStep } from "@/components/medical/exam-progress";
import { ExamProgressRail } from "@/components/medical/exam-progress-rail";
import { DemoFillBar, DoctorsOnly, FormPart } from "@/components/medical/form-parts";

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
    /** Opened from the fighter's profile: the fighter is fixed and the profile header already introduces them. */
    fighterLocked?: boolean;
    /** Demo mode: offer a one-click fill with a plausible sample injury. */
    demoFill?: boolean;
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
export function InjuryForm({ fighters, alerts, defaultFighterId, defaultAlertId, nowInput, today, cancelHref, fighterLocked = false, demoFill = false }: InjuryFormProps) {
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

    const filled = (value: string) => value.trim() !== "";
    const injuryParts = [type !== "", bodyRegion !== "", severity !== ""].filter(Boolean).length;
    const timeParts = [filled(occurredAt), filled(diagnosedAt), mechanism !== ""].filter(Boolean).length;
    const state = (have: number, of: number) => (have === of ? "done" : have ? "part" : "todo") as ProgressStep["state"];
    const steps: ProgressStep[] = [
        {
            key: "injury",
            label: "Chấn thương",
            pct: injuryParts / 3,
            state: state(injuryParts, 3),
            text: severity ? INJURY_SEVERITY_LABELS[severity] : !type ? "Chọn loại" : !bodyRegion ? "Chọn vùng" : "Chọn mức độ",
        },
        {
            key: "time",
            label: "Thời gian",
            pct: timeParts / 3,
            state: state(timeParts, 3),
            text: timeParts < 3 ? "Chọn cơ chế" : expectedReturnAt ? `Dự kiến ${expectedReturnAt.slice(8, 10)}/${expectedReturnAt.slice(5, 7)}` : INJURY_MECHANISM_LABELS[mechanism as InjuryMechanism],
        },
        { key: "clinical", label: "Dấu hiệu lâm sàng", pct: filled(description) ? 1 : 0, state: filled(description) ? "done" : "todo", text: filled(description) ? "Đã mô tả" : "Chưa mô tả" },
    ];

    // One 3D model only (each is a WebGL context): in the side column on wide screens, in the form otherwise.
    const wide = useWideLayout();
    const model = <RegionModel targets={[{ region: bodyRegion }]} label={type ? INJURY_TYPE_LABELS[type] : "Vùng đã chọn"} height={300} legend={false} />;

    /** Demo only: a plausible sample injury the doctor can still edit; "Xóa hết" empties the form again. */
    const fillSample = () => {
        setType("strain");
        setBodyRegion("right_hamstring");
        setSeverity("moderate");
        setStatus("active");
        setMechanism("sparring");
        setOccurredAt(nowInput);
        setDiagnosedAt(today);
        setExpectedReturnAt(addDaysToKey(today, 14));
        setDescription("Đau khi gập gối có kháng lực, ấn đau 1/3 giữa đùi sau phải, chưa bầm. Đi lại bình thường, chạy nhẹ còn đau.");
        ["type", "bodyRegion", "severity", "mechanism", "description", "expectedReturnAt"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setType("");
        setBodyRegion("");
        setSeverity("");
        setStatus("active");
        setMechanism("");
        setExpectedReturnAt("");
        setDescription("");
    };

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
            {demoFill && (
                <DemoFillBar
                    className="xl:col-span-2"
                    description="Điền sẵn một chấn thương mẫu: căng cơ đùi sau phải, mức trung bình, xảy ra hôm nay, dự kiến tập lại sau 2 tuần."
                    onFill={fillSample}
                    onClear={clearAll}
                />
            )}

            <Card className="flex min-w-0 flex-col divide-y divide-border">
                <FormPart prefix="injury-" id="injury" title="Chấn thương" description="Chấn thương gì, ở đâu và nặng tới đâu. Chọn vùng là mô hình bên cạnh sáng lên.">
                    {!fighterLocked && (
                        <Field label="Võ sĩ" htmlFor={id("fighterId")} error={error("fighterId")} required className="sm:max-w-sm">
                            <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                <option value="">Chọn võ sĩ…</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}
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
                        <Field label="Vùng cơ thể" htmlFor={id("bodyRegion")} error={error("bodyRegion")} required hint="Trái/phải tính theo cơ thể võ sĩ.">
                            <Select {...control("bodyRegion", { hint: true, required: true })} value={bodyRegion} onChange={(event) => setBodyRegion(event.target.value as BodyRegion | "")}>
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
                    {/* Below the wide layout there is no side column, so the model sits next to the region it shows. */}
                    {!wide && <div className="rounded-lg bg-surface-muted/60 px-2 py-2">{model}</div>}

                    <ChoiceGroup
                        id={id("severity")}
                        name="severity"
                        legend="Mức độ"
                        required
                        columns={2}
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
                        <Select {...control("linkedAlertId", { hint: true })} value={linkedAlertId} onChange={(event) => changeAlert(event.target.value)} disabled={fighterAlerts.length === 0}>
                            <option value="">Không liên kết</option>
                            {fighterAlerts.map(({ alert }) => (
                                <option key={alert.id} value={alert.id}>
                                    {formatShortDate(alert.detectedAt)} · {BODY_REGION_LABELS[alert.bodyRegion]} — {alert.pattern}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    {selectedAlert && (
                        <div className="flex flex-col gap-3">
                            <AINotice audience="doctor" compact />
                            <ObservationSummary alert={selectedAlert.alert} source={selectedAlert.source} />
                        </div>
                    )}
                </FormPart>

                <FormPart prefix="injury-" id="time" title="Thời gian" description="Xảy ra khi nào, như thế nào, và dự kiến khi nào võ sĩ tập lại đầy đủ.">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <Field label="Xảy ra" htmlFor={id("occurredAt")} error={error("occurredAt")} required hint="Giờ học viện (TP. Hồ Chí Minh)">
                            <Input {...control("occurredAt", { hint: true, required: true })} type="datetime-local" value={occurredAt} max={nowInput} onChange={(event) => setOccurredAt(event.target.value)} />
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
                    </div>
                    <Field
                        label="Dự kiến tập lại đầy đủ"
                        htmlFor={id("expectedReturnAt")}
                        error={error("expectedReturnAt")}
                        optional
                        hint={
                            expectedReturnAt && diagnosedAt
                                ? `${pluralizeVi(daysBetweenKeys(diagnosedAt, expectedReturnAt), "day")} sau chẩn đoán. Kế hoạch phục hồi dùng mốc này làm điểm đích.`
                                : "Tính từ ngày chẩn đoán. Để trống nếu chưa ước tính được."
                        }
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                {...control("expectedReturnAt", { hint: true })}
                                type="date"
                                value={expectedReturnAt}
                                min={diagnosedAt || undefined}
                                onChange={(event) => setExpectedReturnAt(event.target.value)}
                                className="sm:w-48"
                            />
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Đặt ngày dự kiến trở lại tính từ ngày chẩn đoán">
                                {RETURN_PICKS.map((pick) => {
                                    const date = diagnosedAt ? addDaysToKey(diagnosedAt, pick.days) : "";
                                    const chosen = Boolean(date) && expectedReturnAt === date;
                                    return (
                                        <Button
                                            key={pick.days}
                                            variant={chosen ? "primary" : "secondary"}
                                            size="sm"
                                            aria-pressed={chosen}
                                            disabled={!diagnosedAt}
                                            onClick={() => {
                                                setExpectedReturnAt(date);
                                                form.markEdited("expectedReturnAt");
                                            }}
                                        >
                                            {pick.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </Field>
                </FormPart>

                <FormPart prefix="injury-" id="clinical" title="Dấu hiệu lâm sàng" description="Mô tả để lần tái khám có căn cứ." aside={<DoctorsOnly />}>
                    <Field label="Mô tả" htmlFor={id("description")} error={error("description")} required hint="HLV và võ sĩ không bao giờ thấy ghi chú lâm sàng.">
                        <Textarea
                            {...control("description", { hint: true, required: true })}
                            rows={4}
                            placeholder="VD: Đau khi gập gối có kháng lực, ấn đau 1/3 giữa đùi sau, chưa bầm. Đi lại bình thường."
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={3000}
                        />
                    </Field>
                </FormPart>
            </Card>

            <div className="xl:sticky xl:top-32">
                <ExamProgressRail
                    steps={steps}
                    title="Tiến độ"
                    label="Tiến độ ghi nhận chấn thương"
                    anchorPrefix="injury-"
                    top={wide ? <div className="px-4 py-4">{model}</div> : undefined}
                    actions={
                        <>
                            <FormMessage {...form.message} />
                            <Button type="submit" loading={form.pending} className="w-full">
                                {form.pending ? "Đang ghi nhận chấn thương…" : "Ghi nhận chấn thương"}
                            </Button>
                            <Link href={cancelHref} className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                                Hủy
                            </Link>
                        </>
                    }
                />
            </div>
        </form>
    );
}

/** Whether the two-column layout (form and side column, from 1280px) is showing. */
function useWideLayout() {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1280px)");
        const sync = () => setWide(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);
    return wide;
}
