"use client";

import { CircleCheck, CircleSlash, FileText, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Term, TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Checkbox, Field, focusFirstInvalid, FormMessage, FormSection, Input, Textarea } from "@/components/ui/form";
import { FormStep, FormSteps, type FormStepDefinition } from "@/components/ui/form-steps";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordExaminationDecisionAction } from "@/lib/actions/medical-contract";
import { addMonthsToKey, RECONCILE_FIELD } from "@/lib/domain/medical-flow";
import {
    EXAMINATION_DECISIONS,
    EXAMINATION_DECISION_DESCRIPTIONS,
    EXAMINATION_DECISION_LABELS,
    EXAMINATION_SCOPES,
    EXAMINATION_SCOPE_DESCRIPTIONS,
    EXAMINATION_SCOPE_LABELS,
    MEDICAL_TEXT_LIMITS,
    type ExaminationDecision,
    type ExaminationScope,
    type MedicalReviewRequest,
} from "@/lib/domain/medical-contract";
import type { ExaminationType } from "@/lib/domain/types";
import { addDaysToKey, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { CurrentExamination } from "@/lib/services/medical";
import { AssessmentsField, EMPTY_VITALS, ExaminationTypeField, FollowUpField, useAssessmentRows, VitalsFields } from "./examination-details-fields";
import { assessmentRowsProblem } from "./examination-presets";
import { ExaminationReview, type ReviewRestrictions } from "./examination-review";
import { findingsSummary } from "./findings-summary";
import { QuickFill } from "./quick-fill";
import { RestrictionFields } from "./restriction-fields";
import { Scat6BalanceFields, Scat6HistoryFields, Scat6MemoryFields, Scat6RecordInput, useScat6Draft } from "./scat6-fields";
import type { Scat6Step } from "./scat6-draft";

export interface ExaminationDecisionFormProps {
    fighter: { id: string; name: string; dateOfBirth: string };
    currentExaminations: Record<ExaminationScope, CurrentExamination | null>;
    openReviewRequests: MedicalReviewRequest[];
    defaultScope: ExaminationScope;
    defaultType: ExaminationType | "";
    /** The fighter's class limit, for the weight check. */
    weightLimitKg: number | null;
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    nowInput: string;
    now: string;
    cancelHref: string;
}

const SCOPE_OPTIONS: ChoiceOption<ExaminationScope>[] = EXAMINATION_SCOPES.map((value) => ({
    value,
    label: EXAMINATION_SCOPE_LABELS[value],
    description: EXAMINATION_SCOPE_DESCRIPTIONS[value],
}));

const DECISION_META: Record<ExaminationDecision, Pick<ChoiceOption<ExaminationDecision>, "icon" | "tone">> = {
    ELIGIBLE: { icon: CircleCheck, tone: "success" },
    ELIGIBLE_WITH_RESTRICTIONS: { icon: ShieldAlert, tone: "warning" },
    NOT_ELIGIBLE: { icon: CircleSlash, tone: "danger" },
};

const DECISION_OPTIONS: ChoiceOption<ExaminationDecision>[] = EXAMINATION_DECISIONS.map((value) => ({
    value,
    label: EXAMINATION_DECISION_LABELS[value],
    description: EXAMINATION_DECISION_DESCRIPTIONS[value],
    ...DECISION_META[value],
}));

const SCAT6_STEPS: Record<string, Scat6Step> = { "scat6-history": "history", "scat6-memory": "memory", "scat6-balance": "balance" };

const VALIDITY_PICKS = [3, 6, 12];

/**
 * Records an examination as the medical service keeps it, in steps inside one form (one request when it's recorded):
 * the visit and vitals, the physical exam, for a baseline the SCAT6 in three steps, the decision, then a review of what
 * was entered. Only safe things are filled in for the doctor (scope, type, times, the fighter, the starting areas);
 * every finding is the doctor's, entered by hand or with a quick fill they click, which fills only what is still blank
 * and says what it filled. The answers live in this form only and are kept after any error.
 */
export function ExaminationDecisionForm({
    fighter,
    currentExaminations,
    openReviewRequests,
    defaultScope,
    defaultType,
    weightLimitKg,
    nowInput,
    now,
    cancelHref,
}: ExaminationDecisionFormProps) {
    const [type, setType] = useState<ExaminationType | "">(defaultType);
    const baseline = type === "baseline";
    const form = useActionForm(recordExaminationDecisionAction, {
        id: "exam-decision",
        hiddenFields: ["supersedesId", "scat6"],
        // A last check before sending: a SCAT6 answer left on a step the doctor jumped past is marked there instead.
        prepare: () => {
            const problems = baseline ? scat6.validateAll() : null;
            if (problems) return { status: "error", message: "Một số câu trả lời SCAT6 cần xem lại. Đã đánh dấu ở từng bước.", fieldErrors: problems };
        },
    });
    const { control, error } = form;
    const scat6 = useScat6Draft({ form, nowInput, dateOfBirth: fighter.dateOfBirth });
    const [scope, setScope] = useState<ExaminationScope>(defaultScope);
    const [vitals, setVitals] = useState(EMPTY_VITALS);
    const rows = useAssessmentRows(form, defaultType);
    const [checkRows, setCheckRows] = useState(false);
    const [examinedAt, setExaminedAt] = useState(nowInput);
    const [correcting, setCorrecting] = useState(false);
    const [decision, setDecision] = useState<ExaminationDecision | "">("");
    const [reason, setReason] = useState("");
    const [reasonNote, setReasonNote] = useState<string>();
    const [validUntil, setValidUntil] = useState("");
    const [recommendations, setRecommendations] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [answered, setAnswered] = useState<string[]>(openReviewRequests.map((request) => request.id));
    const [restrictions, setRestrictions] = useState<ReviewRestrictions | null>(null);

    const current = currentExaminations[scope];
    const answersRequests = scope === "TRAINING" && openReviewRequests.length > 0;
    const administered = scat6.draft.status === "ADMINISTERED";
    const examDay = examinedAt.slice(0, 10);
    const unconfirmed = form.state.status === "error" && form.state.data?.unconfirmed === true;

    const steps = useMemo<FormStepDefinition[]>(
        () => [
            { id: "visit", label: "Sinh hiệu", description: "Lần khám và chỉ số" },
            { id: "physical", label: "Khám thực thể", description: "Vùng được đánh giá" },
            ...(baseline
                ? administered
                    ? [
                          { id: "scat6-history", label: "SCAT6: tiền sử", description: "Tiền sử và triệu chứng" },
                          { id: "scat6-memory", label: "SCAT6: trí nhớ", description: "Trí nhớ và tập trung" },
                          { id: "scat6-balance", label: "SCAT6: thăng bằng", description: "Thăng bằng và nhớ lại" },
                      ]
                    : [{ id: "scat6-history", label: "SCAT6", description: "Không thực hiện" }]
                : []),
            { id: "decision", label: "Quyết định", description: "Quyết định và theo dõi" },
            { id: "review", label: "Đánh giá lại", description: "Kiểm tra và ghi" },
        ],
        [baseline, administered],
    );

    /** The restriction lists as the form holds them now, read from the form itself (the pickers keep their own state). */
    const readRestrictions = (): ReviewRestrictions | null => {
        const element = form.formProps.ref.current;
        if (!element || decision !== "ELIGIBLE_WITH_RESTRICTIONS") return null;
        const data = new FormData(element);
        const list = (name: string) => data.getAll(name).map(String);
        return {
            sessions: data.get("limitSessions") ? list("allowedSessionTypes") : null,
            techniques: data.get("limitTechniques") ? list("allowedTechniqueTypes") : null,
            joints: list("excludedJoints"),
            notes: String(data.get("restrictionNotes") ?? ""),
        };
    };

    const validateStep = (stepId: string, panel: HTMLElement): string | null => {
        const message = stepProblem(stepId);
        // The markers for the problem render with this update; focus the first one once they're there.
        if (message) window.requestAnimationFrame(() => focusFirstInvalid(panel));
        return message;
    };

    const stepProblem = (stepId: string): string | null => {
        if (stepId === "visit") {
            const entered = Object.values(vitals).filter((value) => value.trim() !== "").length;
            return !baseline && entered > 0 && entered < Object.keys(vitals).length ? "Nhập đủ mọi chỉ số sinh hiệu, hoặc xóa hết." : null;
        }
        if (stepId === "physical") {
            setCheckRows(true);
            return assessmentRowsProblem(rows.rows, { baseline });
        }
        if (stepId in SCAT6_STEPS) return scat6.validate(SCAT6_STEPS[stepId]);
        if (stepId === "decision") {
            if (reason.trim().length < 10) return "Giải thích quyết định trong một hai câu.";
            const lists = readRestrictions();
            if (lists) {
                if (lists.sessions?.length === 0) return "Chọn ít nhất một loại buổi tập võ sĩ được làm, hoặc tắt giới hạn này.";
                if (lists.techniques?.length === 0) return "Chọn ít nhất một kỹ thuật võ sĩ được dùng, hoặc tắt giới hạn này.";
                if (lists.sessions === null && lists.techniques === null && lists.joints.length === 0 && !lists.notes.trim()) return "Đặt ít nhất một giới hạn hoặc ghi hạn chế trong ghi chú.";
            }
        }
        return null;
    };

    const insertSummary = () => {
        const summary = findingsSummary({
            type,
            vitals,
            assessments: rows.rows,
            scat6: baseline ? { status: scat6.draft.status, reason: scat6.draft.notAdministeredReason } : null,
        });
        if (!summary) {
            setReasonNote("Chưa có gì để tóm tắt: hãy nhập sinh hiệu và vùng khám trước.");
            return;
        }
        if (reason.includes(summary)) return;
        setReason(reason.trim() ? `${reason.trimEnd()}\n\n${summary}` : summary);
        setReasonNote("Đã chèn từ dữ liệu bạn nhập. Bổ sung lập luận và chỉnh sửa trước khi ghi.");
        form.markEdited("reason");
    };

    return (
        <form {...form.formProps}>
            <Card className="min-w-0 px-5 py-6 sm:px-6">
                <input type="hidden" name="fighterId" value={fighter.id} />
                <input type="hidden" name="knownCurrentId" value={current?.id ?? ""} />
                {unconfirmed && <input type="hidden" name={RECONCILE_FIELD} value="1" />}
                {baseline && <Scat6RecordInput scat6={scat6} />}

                <FormSteps
                    steps={steps}
                    state={form.state}
                    validateStep={validateStep}
                    onStepChange={(stepId) => {
                        if (stepId === "review") setRestrictions(readRestrictions());
                    }}
                    cancel={
                        <ButtonLink href={cancelHref} variant="ghost" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            Hủy
                        </ButtonLink>
                    }
                    message={<FormMessage {...form.message} />}
                    submit={
                        <SubmitButton pending={form.pending} pendingLabel={unconfirmed ? "Đang kiểm tra hồ sơ…" : "Đang ghi…"} size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                            {unconfirmed ? "Thử lại" : "Ghi phiếu khám"}
                        </SubmitButton>
                    }
                >
                    <FormStep id="visit" title="Lần khám và sinh hiệu" description={`Phiếu khám này quyết định gì cho ${fighter.name}, kèm các chỉ số.`}>
                        <FormSection title="Phạm vi và lần khám" info={<TermHint term="examinationScope" />} description="Phiếu khám quyết định điều gì, loại lần khám và thời điểm.">
                            <ChoiceGroup
                                id="exam-decision-scope"
                                name="scope"
                                legend="Phạm vi"
                                legendVisuallyHidden
                                required
                                columns={2}
                                variant="compact"
                                options={SCOPE_OPTIONS}
                                value={scope}
                                onChange={(next) => {
                                    setScope(next);
                                    setCorrecting(false);
                                }}
                                error={error("scope")}
                            />
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <ExaminationTypeField
                                    form={form}
                                    value={type}
                                    onChange={(next) => {
                                        setType(next);
                                        rows.typeChanged(next);
                                    }}
                                />
                                <Field label="Thời điểm khám" htmlFor={control("examinedAt").id} error={error("examinedAt")} required hint="Giờ học viện (TP. Hồ Chí Minh)">
                                    <Input
                                        {...control("examinedAt", { hint: true, required: true })}
                                        type="datetime-local"
                                        value={examinedAt}
                                        max={nowInput}
                                        onChange={(event) => setExaminedAt(event.target.value)}
                                        className="sm:w-64"
                                    />
                                </Field>
                            </div>
                            {baseline && scope === "COMPETITION" && (
                                <Callout tone="warning" icon={TriangleAlert} title="Khám nền cho thi đấu không tính cho tập luyện">
                                    Hãy ghi khám nền ở phạm vi Tập luyện để {fighter.name} có thể bắt đầu tập.
                                </Callout>
                            )}
                            {current && (
                                <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px]">
                                    <p className="text-fg-muted">
                                        Phiếu khám {EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} hiện hành:{" "}
                                        <span className="font-medium text-fg">{EXAMINATION_DECISION_LABELS[current.decision]}</span> ngày{" "}
                                        <time dateTime={current.examinedAt}>{formatDateTime(current.examinedAt, "vi")}</time>
                                        {current.validUntil && <>, hiệu lực đến {formatDate(current.validUntil, "vi")}</>}
                                    </p>
                                    <input type="hidden" name="supersedesId" value={current.id} />
                                    <Checkbox
                                        id="exam-decision-correction"
                                        name="correction"
                                        checked={correcting}
                                        onChange={(event) => setCorrecting(event.target.checked)}
                                        label="Phiếu này đính chính phiếu khám đó"
                                        description="Chỉ dùng khi hồ sơ ghi sai. Lần khám mới là phiếu khám mới."
                                        info={<TermHint term="examinationCorrection" />}
                                    />
                                    {error("supersedesId") && <p className="font-medium text-danger-fg">{error("supersedesId")}</p>}
                                </div>
                            )}
                        </FormSection>
                        <FormSection title="Sinh hiệu" description={baseline ? "Bắt buộc với khám nền. Chỉ số ngoài ngưỡng vận động viên được đánh dấu, không bị chặn." : "Không bắt buộc. Nhập đủ mọi chỉ số, hoặc bỏ trống hết."}>
                            <VitalsFields form={form} value={vitals} onChange={setVitals} weightLimitKg={weightLimitKg} required={baseline} />
                        </FormSection>
                    </FormStep>

                    <FormStep id="physical" title="Khám thực thể" description={baseline ? "Mỗi dòng một vùng khám; khám nền cần ít nhất một. Ghi kết quả từng dòng." : "Mỗi dòng một vùng khám (nếu có)."}>
                        <FormSection title="Đánh giá" info={<TermHint term="assessedArea" />}>
                            <AssessmentsField form={form} type={type} rows={rows} checkMissing={checkRows} />
                        </FormSection>
                    </FormStep>

                    {baseline && (
                        <FormStep id="scat6-history" title={administered ? "SCAT6 — tiền sử và triệu chứng" : "SCAT6"}>
                            <Scat6HistoryFields scat6={scat6} />
                        </FormStep>
                    )}
                    {baseline && administered && (
                        <FormStep id="scat6-memory" title="SCAT6 — trí nhớ và tập trung" description={<Term term="cognitiveScreening">Sàng lọc nhận thức</Term>}>
                            <Scat6MemoryFields scat6={scat6} />
                        </FormStep>
                    )}
                    {baseline && administered && (
                        <FormStep id="scat6-balance" title="SCAT6 — thăng bằng và nhớ lại" description={<Term term="coordinationBalance">Phối hợp và thăng bằng</Term>}>
                            <Scat6BalanceFields scat6={scat6} />
                        </FormStep>
                    )}

                    <FormStep id="decision" title="Quyết định" description="Quyết định lâm sàng, lập luận và bước tiếp theo.">
                        <FormSection title="Quyết định" info={<TermHint term="eligibleWithRestrictions" />}>
                            <ChoiceGroup
                                id="exam-decision-decision"
                                name="decision"
                                legend="Quyết định"
                                required
                                options={DECISION_OPTIONS}
                                value={decision}
                                onChange={setDecision}
                                error={error("decision")}
                                hint="Quyết định đủ điều kiện vẫn cần giấy phép, cấp ở bước tiếp theo."
                            />
                            {decision === "NOT_ELIGIBLE" && (
                                <Callout tone="danger" icon={TriangleAlert} title={`Giấy phép ${EXAMINATION_SCOPE_LABELS[scope].toLowerCase()} đang hiệu lực bị thu hồi`}>
                                    {fighter.name} stops {scope === "TRAINING" ? "training" : "competing"} ngay khi bạn ghi phiếu này. Cần phiếu khám sau để thay đổi.
                                </Callout>
                            )}
                            <div className="flex flex-col gap-2">
                                <Field
                                    label="Kết quả và lập luận"
                                    htmlFor={control("reason").id}
                                    error={error("reason")}
                                    required
                                    info={<TermHint term="findingsAndReasoning" />}
                                    hint="Võ sĩ đọc được trên trang Sức khỏe. HLV không xem được."
                                >
                                    <Textarea
                                        {...control("reason", { hint: true, required: true })}
                                        rows={5}
                                        maxLength={MEDICAL_TEXT_LIMITS.examinationReason}
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                    />
                                </Field>
                                <QuickFill label="Chèn tóm tắt kết quả" icon={FileText} available note={reasonNote} onClick={insertSummary} />
                            </div>
                            {decision !== "NOT_ELIGIBLE" && (
                                <div className="flex flex-col gap-2">
                                    <Field
                                        label="Quyết định hiệu lực đến"
                                        htmlFor={control("validUntil").id}
                                        error={error("validUntil")}
                                        optional
                                        info={<TermHint term="validUntil" />}
                                        hint="Để trống nếu không thời hạn. Giấy phép từ phiếu này không thể dài hơn."
                                    >
                                        <Input
                                            {...control("validUntil", { hint: true })}
                                            type="date"
                                            value={validUntil}
                                            min={examDay ? addDaysToKey(examDay, 1) : undefined}
                                            onChange={(event) => setValidUntil(event.target.value)}
                                            className="sm:w-56"
                                        />
                                    </Field>
                                    {examDay && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <SuggestionChips
                                                label="Hiệu lực trong"
                                                suggestions={VALIDITY_PICKS.map((months) => ({ label: `${months} tháng`, value: addMonthsToKey(examDay, months) }))}
                                                onPick={(value) => {
                                                    setValidUntil(value);
                                                    form.markEdited("validUntil");
                                                }}
                                            />
                                            {validUntil && (
                                                <Button variant="ghost" size="sm" onClick={() => setValidUntil("")}>
                                                    Không thời hạn
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </FormSection>

                        {decision === "ELIGIBLE_WITH_RESTRICTIONS" && (
                            <FormSection title="Hạn chế" info={<TermHint term="restrictions" />} description="Những gì võ sĩ được làm. Giấy phép cấp từ phiếu này chỉ có thể hẹp hơn.">
                                <RestrictionFields form={form} idPrefix="exam-decision" />
                                <Field label="Ghi chú hạn chế" htmlFor={control("restrictionNotes").id} error={error("restrictionNotes")} optional hint="Những gì danh sách chưa thể hiện, VD cường độ hoặc thời lượng.">
                                    <Textarea {...control("restrictionNotes", { hint: true })} rows={3} maxLength={MEDICAL_TEXT_LIMITS.restrictionNotes} />
                                </Field>
                                {error("restrictions") && (
                                    <p data-invalid="true" className="text-[13px] font-medium text-danger-fg">
                                        {error("restrictions")}
                                    </p>
                                )}
                            </FormSection>
                        )}

                        <FormSection title="Khuyến nghị và theo dõi" description="Bước tiếp theo cho võ sĩ và ban huấn luyện, và khi nào khám lại.">
                            <Field label="Khuyến nghị" htmlFor={control("recommendations").id} error={error("recommendations")} optional hint="Võ sĩ xem được cùng phiếu khám.">
                                <Textarea
                                    {...control("recommendations", { hint: true })}
                                    rows={3}
                                    maxLength={MEDICAL_TEXT_LIMITS.clinicalText}
                                    value={recommendations}
                                    onChange={(event) => setRecommendations(event.target.value)}
                                />
                            </Field>
                            <FollowUpField form={form} examDay={examDay} value={followUpDate} onChange={setFollowUpDate} hint="Hiện trên trang Hôm nay khi gần đến ngày." />
                        </FormSection>

                        {answersRequests && (
                            <FormSection
                                title="Yêu cầu xem xét"
                                info={<TermHint term="reviewRequest" />}
                                description="Yêu cầu được đánh dấu sẽ được phiếu khám này trả lời và không còn tạm dừng tập. Bỏ đánh dấu yêu cầu mà lần khám này chưa trả lời."
                            >
                                <fieldset aria-invalid={error("reviewRequestIds") ? true : undefined} data-invalid={error("reviewRequestIds") ? "true" : undefined} className="flex flex-col gap-2.5">
                                    <legend className="sr-only">Yêu cầu xem xét được trả lời</legend>
                                    {openReviewRequests.map((request) => (
                                        <Checkbox
                                            key={request.id}
                                            id={`exam-decision-request-${request.id}`}
                                            name="reviewRequestIds"
                                            value={request.id}
                                            checked={answered.includes(request.id)}
                                            onChange={(event) => {
                                                setAnswered(event.target.checked ? [...answered, request.id] : answered.filter((id) => id !== request.id));
                                                form.markEdited("reviewRequestIds");
                                            }}
                                            label={`“${request.reason}”`}
                                            description={`Gửi ${formatRelative(request.requestedAt, now, "vi").toLowerCase()}`}
                                        />
                                    ))}
                                    {error("reviewRequestIds") && <p className="text-[13px] font-medium text-danger-fg">{error("reviewRequestIds")}</p>}
                                </fieldset>
                            </FormSection>
                        )}
                    </FormStep>

                    <FormStep id="review" title="Đánh giá lại" description="Kiểm tra dữ liệu đã nhập. Dịch vụ y tế tính điểm SCAT6 sau khi ghi.">
                        <div className="flex flex-col gap-5">
                            <ExaminationReview
                                scope={scope}
                                type={type}
                                examinedAt={examinedAt}
                                correcting={correcting}
                                vitals={vitals}
                                rows={rows.rows}
                                scat6={baseline ? scat6.draft : null}
                                decision={decision}
                                reason={reason}
                                validUntil={validUntil}
                                recommendations={recommendations}
                                followUpDate={followUpDate}
                                restrictions={decision === "ELIGIBLE_WITH_RESTRICTIONS" ? restrictions : null}
                                reviewRequests={{ answered: answersRequests ? answered.length : 0, open: answersRequests ? openReviewRequests.length : 0 }}
                            />
                            <InlineNote icon={Info}>
                                Phiếu khám không thể sửa hay xóa; sai sót được khắc phục bằng phiếu đính chính.{" "}
                                {decision === "NOT_ELIGIBLE"
                                    ? `${fighter.name} sẽ dừng ${scope === "TRAINING" ? "tập luyện" : "thi đấu"} ngay khi bạn ghi.`
                                    : `Tiếp theo, bước 2/2: cấp giấy phép để ${fighter.name} được ${scope === "TRAINING" ? "tập luyện" : "thi đấu"}.`}
                            </InlineNote>
                        </div>
                    </FormStep>
                </FormSteps>
            </Card>
        </form>
    );
}
