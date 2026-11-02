"use client";

import { Info, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { grantClearanceAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, examinationTitle } from "@/lib/domain/labels";
import { clearanceState, type ClearanceState } from "@/lib/domain/rules";
import type { ClearanceLevel, ExaminationOutcome, ExaminationType, MedicalClearance } from "@/lib/domain/types";
import { addDaysToKey, daysBetween, formatDate, pluralizeVi } from "@/lib/format";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, ExaminationOutcomeBadge } from "./clinical-badges";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { RestrictionBuilder, type RestrictionDraft } from "./restriction-builder";
import { RestrictionSummary } from "./restriction-summary";

export interface ClearanceExaminationOption {
    id: string;
    date: string;
    type: ExaminationType | null;
    outcome: ExaminationOutcome;
    summary: string;
}

export interface ClearanceFighterContext extends FighterIdentityData {
    id: string;
    clearance: MedicalClearance | null;
    state: ClearanceState;
    issuedByName: string | null;
    /** Open injuries as short labels, e.g. "Concussion — head (active)". */
    openInjuries: string[];
    /** Recent examinations, newest first. */
    examinations: ClearanceExaminationOption[];
}

export interface GrantClearanceFormProps {
    fighters: ClearanceFighterContext[];
    defaultFighterId: string;
    defaultExaminationId: string;
    /** Today in the academy timezone, YYYY-MM-DD. */
    today: string;
    /** Server time (ISO). */
    now: string;
    doctorName: string;
    warningDays: number;
}

const VALIDITY_PICKS = [30, 60, 90, 180];

const LEVEL_OPTIONS: ChoiceOption<ClearanceLevel>[] = [
    {
        value: "full",
        label: CLEARANCE_LEVEL_LABELS.full,
        icon: ShieldCheck,
        tone: "success",
        description: "Được tham gia mọi buổi tập và thi đấu. HLV lên lịch bất kỳ buổi nào.",
    },
    {
        value: "restricted",
        label: CLEARANCE_LEVEL_LABELS.restricted,
        icon: ShieldAlert,
        tone: "warning",
        description: "Được tập trong giới hạn bạn đặt. Buổi vi phạm giới hạn sẽ bị chặn hoặc cảnh báo khi HLV lên lịch.",
    },
    {
        value: "not_cleared",
        label: CLEARANCE_LEVEL_LABELS.not_cleared,
        icon: ShieldX,
        tone: "danger",
        description: "Không được tập. Buổi đã lên lịch bị chặn cho đến khi bạn cấp giấy phép mới.",
    },
];

const draftsFrom = (clearance: MedicalClearance | null): RestrictionDraft[] =>
    clearance?.level === "restricted" && clearance.status === "active"
        ? clearance.restrictions.map((restriction, index) => ({
              key: index + 1,
              label: restriction.label,
              blockedTrainingTypes: restriction.blockedTrainingTypes,
              blockedTechniques: restriction.blockedTechniques,
              blockedRegions: restriction.blockedRegions,
              maxRpe: restriction.maxRpe,
          }))
        : [];

/** Issues a Medical Clearance: decision, validity, restrictions and clinical reason, with a live coach preview. */
export function GrantClearanceForm({ fighters, defaultFighterId, defaultExaminationId, today, now, doctorName, warningDays }: GrantClearanceFormProps) {
    const form = useActionForm(grantClearanceAction, { id: "clearance" });
    const { control, error } = form;

    const initialFighter = fighters.find((fighter) => fighter.id === defaultFighterId) ?? null;
    const initialExam = initialFighter?.examinations.find((exam) => exam.id === defaultExaminationId) ?? null;

    const [fighterId, setFighterId] = useState(initialFighter?.id ?? "");
    const [level, setLevel] = useState<ClearanceLevel | "">(initialExam ? CLEARANCE_LEVEL_FOR_OUTCOME[initialExam.outcome] : "");
    const [validUntil, setValidUntil] = useState("");
    const [reason, setReason] = useState("");
    const [examinationId, setExaminationId] = useState(initialExam?.id ?? initialFighter?.examinations[0]?.id ?? "");
    const [drafts, setDrafts] = useState<RestrictionDraft[]>(() => draftsFrom(initialFighter?.clearance ?? null));
    const [copiedRestrictions, setCopiedRestrictions] = useState(() => draftsFrom(initialFighter?.clearance ?? null).length > 0);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const linkedExam = fighter?.examinations.find((exam) => exam.id === examinationId) ?? null;
    const examMismatch = linkedExam && level ? CLEARANCE_LEVEL_FOR_OUTCOME[linkedExam.outcome] !== level : false;
    const validDays = validUntil ? daysBetween(`${today}T12:00:00Z`, `${validUntil}T12:00:00Z`) : null;

    const changeFighter = (nextId: string) => {
        const next = fighters.find((candidate) => candidate.id === nextId) ?? null;
        const copied = draftsFrom(next?.clearance ?? null);
        setFighterId(nextId);
        setExaminationId(next?.examinations[0]?.id ?? "");
        setDrafts(copied);
        setCopiedRestrictions(copied.length > 0);
        form.markEdited("restrictions");
    };

    const preview: MedicalClearance | null =
        fighter && level
            ? {
                  id: "preview",
                  fighterId: fighter.id,
                  doctorId: "",
                  level,
                  status: "active",
                  issuedAt: now,
                  validUntil: level !== "not_cleared" && validUntil ? `${validUntil}T12:00:00.000Z` : null,
                  reason,
                  restrictions:
                      level === "restricted" ? drafts.map(({ key, ...restriction }) => ({ ...restriction, id: `preview-${key}`, label: restriction.label || "Hạn chế chưa đặt tên" })) : [],
                  examinationId: examinationId || null,
                  revokedAt: null,
                  revokedReason: null,
              }
            : null;

    const submitLabel = level === "restricted" ? "Cấp giấy phép có hạn chế" : level === "not_cleared" ? "Đặt là chưa được tập…" : "Cấp giấy phép";

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <form
                {...form.formProps}
                onSubmit={(event) => {
                    if (level !== "not_cleared") return form.formProps.onSubmit(event);
                    event.preventDefault();
                    setConfirmOpen(true);
                }}
                className="min-w-0"
            >
                <input
                    type="hidden"
                    name="restrictions"
                    value={JSON.stringify(
                        level === "restricted"
                            ? drafts.map(({ label, blockedTrainingTypes, blockedTechniques, blockedRegions, maxRpe }) => ({
                                  label,
                                  blockedTrainingTypes,
                                  blockedTechniques,
                                  blockedRegions,
                                  maxRpe,
                              }))
                            : [],
                    )}
                />
                <Card className="flex flex-col divide-y divide-border">
                    <Section title="Võ sĩ" description="Giấy phép áp dụng cho một võ sĩ và thay thế giấy phép hiện tại.">
                        <Field label="Võ sĩ" htmlFor={control("fighterId").id} error={error("fighterId")} required className="sm:max-w-sm">
                            <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                <option value="">Chọn võ sĩ…</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </Section>

                    <Section title="Quyết định" description="Võ sĩ được làm gì từ bây giờ. Hệ quả hiển thị dưới từng lựa chọn.">
                        <div>
                            <ChoiceGroup
                                id={control("level").id}
                                name="level"
                                legend="Mức giấy phép"
                                legendVisuallyHidden
                                required
                                options={LEVEL_OPTIONS}
                                value={level}
                                onChange={setLevel}
                                error={error("level")}
                            />
                            <div aria-live="polite">
                                {linkedExam && level && (
                                    <InlineNote icon={Info} tone={examMismatch ? "warning" : "neutral"} className="mt-2">
                                        {examMismatch
                                            ? `Phiếu ${examinationTitle(linkedExam).toLowerCase()} liên kết kết luận “${EXAMINATION_OUTCOME_LABELS[linkedExam.outcome]}”. Hãy giải thích khác biệt trong lý do lâm sàng.`
                                            : `Khớp với kết luận của phiếu ${examinationTitle(linkedExam).toLowerCase()} liên kết.`}
                                    </InlineNote>
                                )}
                            </div>
                        </div>
                    </Section>

                    {level !== "not_cleared" ? (
                        <Section title="Hiệu lực" description="Giấy phép hết hạn vào ngày này và việc tập bị chặn cho đến khi gia hạn.">
                            <Field
                                label="Hiệu lực đến"
                                htmlFor={control("validUntil").id}
                                error={error("validUntil")}
                                required
                                hint={
                                    validDays !== null && validDays >= 0
                                        ? `Hiệu lực ${pluralizeVi(validDays, "day")}. HLV thấy cảnh báo ${warningDays} ngày trước khi hết hạn.`
                                        : "Tối đa 12 tháng. Nên khớp với lần khám dự kiến tiếp theo."
                                }
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="w-44">
                                        <Input
                                            {...control("validUntil", { hint: true, required: true })}
                                            type="date"
                                            value={validUntil}
                                            min={today}
                                            max={addDaysToKey(today, 365)}
                                            onChange={(event) => setValidUntil(event.target.value)}
                                        />
                                    </div>
                                    <span className="text-[13px] text-fg-muted" aria-hidden>
                                        hoặc
                                    </span>
                                    {VALIDITY_PICKS.map((days) => {
                                        const date = addDaysToKey(today, days);
                                        return (
                                            <Button
                                                key={days}
                                                variant={validUntil === date ? "primary" : "secondary"}
                                                size="sm"
                                                aria-pressed={validUntil === date}
                                                onClick={() => {
                                                    setValidUntil(date);
                                                    form.markEdited("validUntil");
                                                }}
                                            >
                                                {days} ngày
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Field>
                        </Section>
                    ) : (
                        <Section title="Hiệu lực" description="Quyết định chưa được tập không có thời hạn.">
                            <InlineNote icon={Info}>Có hiệu lực cho đến khi bạn khám lại và cấp giấy phép mới.</InlineNote>
                        </Section>
                    )}

                    {level === "restricted" && (
                        <Section
                            title="Hạn chế"
                            description="Viết mỗi hạn chế theo cách HLV dễ hiểu. Giới hạn bên dưới được áp dụng khi lên lịch buổi tập."
                        >
                            {copiedRestrictions && drafts.length > 0 && (
                                <InlineNote icon={Info} tone="info">
                                    Sao chép từ giấy phép hiện tại — hãy xem lại từng mục trước khi cấp.
                                </InlineNote>
                            )}
                            <RestrictionBuilder drafts={drafts} onChange={setDrafts} error={error} markEdited={form.markEdited} />
                        </Section>
                    )}

                    <Section title="Lý do lâm sàng & căn cứ" description="Lý do quyết định và phiếu khám làm căn cứ.">
                        <Field
                            label="Lý do lâm sàng"
                            htmlFor={control("reason").id}
                            error={error("reason")}
                            required
                            hint="Chỉ bác sĩ xem. HLV và võ sĩ thấy mức, hạn chế và hiệu lực — không bao giờ thấy lý do này."
                        >
                            <Textarea
                                {...control("reason", { hint: true, required: true })}
                                rows={4}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="VD: Đủ biên độ không đau, sức mạnh đối xứng 90% khi đo lực. Được tập kỹ thuật; không va chạm cho đến khi hoàn tất tiếp xúc theo bậc."
                            />
                        </Field>
                        <Field
                            label="Phiếu khám liên kết"
                            htmlFor={control("examinationId").id}
                            error={error("examinationId")}
                            optional
                            hint={fighter && fighter.examinations.length === 0 ? "Võ sĩ này chưa có phiếu khám." : "Phiếu khám làm căn cứ cho quyết định."}
                            className="sm:max-w-lg"
                        >
                            <Select {...control("examinationId", { hint: true })} value={examinationId} onChange={(event) => setExaminationId(event.target.value)} disabled={!fighter}>
                                <option value="">Không liên kết phiếu khám</option>
                                {fighter?.examinations.map((exam) => (
                                    <option key={exam.id} value={exam.id}>
                                        {examinationTitle(exam)} · {formatDate(exam.date)} · {EXAMINATION_OUTCOME_LABELS[exam.outcome]}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </Section>

                    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                        <FormMessage {...form.message} />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link href={fighter ? routes.doctor.fighter(fighter.id) : routes.doctor.clearance} className={buttonClasses({ variant: "secondary" })}>
                                Hủy
                            </Link>
                            <Button type="submit" variant={level === "not_cleared" ? "danger" : "primary"} loading={form.pending}>
                                {form.pending ? "Đang cấp giấy phép…" : submitLabel}
                            </Button>
                        </div>
                    </div>
                </Card>
            </form>

            <aside aria-label="Bối cảnh và xem trước" className="flex min-w-0 flex-col gap-6">
                <Card>
                    <CardHeader title="Tình trạng hiện tại" />
                    <CardContent>
                        <CurrentStatus fighter={fighter} now={now} warningDays={warningDays} />
                    </CardContent>
                </Card>

                <section aria-labelledby="clearance-preview-heading" className="flex flex-col gap-2">
                    <div>
                        <h2 id="clearance-preview-heading" className="text-[15px] font-semibold text-fg">
                            HLV và võ sĩ sẽ thấy thế nào
                        </h2>
                        <p className="text-[13px] text-fg-muted">Xem trước trực tiếp. Lý do lâm sàng chỉ bác sĩ xem.</p>
                    </div>
                    {preview ? (
                        <ClearanceCard clearance={preview} state={clearanceState(preview, now)} doctorName={doctorName} now={now} variant="summary" warningDays={warningDays} />
                    ) : (
                        <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
                            {fighter ? "Chọn mức giấy phép để xem trước." : "Chọn võ sĩ và mức giấy phép để xem trước."}
                        </p>
                    )}
                </section>
            </aside>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    form.submit({ confirmNotCleared: "yes" });
                }}
                title={`Đặt ${fighter?.name ?? "võ sĩ này"} là chưa được tập?`}
                description="HLV và võ sĩ được thông báo ngay; mọi buổi đã lên lịch bị chặn cho đến khi bạn cấp giấy phép mới."
                confirmLabel="Đặt là chưa được tập"
            />
        </div>
    );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
            <div>
                <h2 id={headingId} className="text-[15px] font-semibold text-fg">
                    {title}
                </h2>
                <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>
            </div>
            {children}
        </section>
    );
}

function CurrentStatus({ fighter, now, warningDays }: { fighter: ClearanceFighterContext | null; now: string; warningDays: number }) {
    if (!fighter) return <p className="text-sm text-fg-muted">Chọn võ sĩ để xem giấy phép hiện tại và lần khám gần nhất.</p>;
    const latest = fighter.examinations[0];
    return (
        <div className="flex flex-col gap-4">
            <FighterIdentity fighter={fighter} size="sm" href={routes.doctor.fighter(fighter.id)} />
            <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-fg-muted">Giấy phép hiện tại</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    <ClearanceBadge state={fighter.state} size="sm" />
                    <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                </div>
                <ClearanceValidity clearance={fighter.clearance} state={fighter.state} now={now} warningDays={warningDays} />
                {fighter.clearance && fighter.issuedByName && (
                    <p className="text-xs text-fg-muted">
                        Người cấp {fighter.issuedByName} ngày {formatDate(fighter.clearance.issuedAt)}
                    </p>
                )}
                {fighter.state === "restricted" && fighter.clearance && <RestrictionSummary restrictions={fighter.clearance.restrictions} />}
            </div>
            {fighter.openInjuries.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-fg-muted">Chấn thương đang mở</p>
                    <ul className="text-[13px] text-fg">
                        {fighter.openInjuries.map((injury) => (
                            <li key={injury}>{injury}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <p className="text-xs font-medium text-fg-muted">Lần khám gần nhất</p>
                {latest ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                            <Link href={routes.doctor.examination(latest.id)} className="font-medium text-fg hover:underline">
                                {examinationTitle(latest)}
                            </Link>
                            <span className="text-fg-muted">{formatDate(latest.date)}</span>
                        </p>
                        <ExaminationOutcomeBadge outcome={latest.outcome} size="sm" className="self-start" />
                        <p className="line-clamp-4 text-[13px] text-pretty text-fg-muted">{latest.summary}</p>
                    </>
                ) : (
                    <p className="text-[13px] text-fg-muted">
                        Chưa có phiếu khám.{" "}
                        <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}&type=baseline`} className="font-medium text-primary-soft-fg hover:underline">
                            Ghi phiếu khám nền
                        </Link>{" "}
                        trước khi cấp giấy phép.
                    </p>
                )}
            </div>
        </div>
    );
}
