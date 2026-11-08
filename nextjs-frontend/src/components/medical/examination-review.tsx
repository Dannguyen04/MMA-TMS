"use client";

import { PenLine } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useFormSteps } from "@/components/ui/form-steps";
import { BODY_JOINT_LABELS, EXAMINATION_DECISION_LABELS, EXAMINATION_SCOPE_LABELS, SESSION_TYPE_LABELS, TECHNIQUE_TYPE_LABELS, type BodyJoint, type ExaminationDecision, type ExaminationScope, type SessionType, type TechniqueType } from "@/lib/domain/medical-contract";
import { ASSESSMENT_RESULT_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ExaminationType } from "@/lib/domain/types";
import { academyWallClockToIso, formatDate, formatDateTime, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssessmentRow, VitalsDraft } from "./examination-details-fields";
import { scat6ReviewLines, type Scat6Draft, type Scat6Step } from "./scat6-draft";

/** The restriction lists as the form holds them when the review opens. Null lists mean "no limit". */
export interface ReviewRestrictions {
    sessions: string[] | null;
    techniques: string[] | null;
    joints: string[];
    notes: string;
}

export interface ExaminationReviewProps {
    scope: ExaminationScope;
    type: ExaminationType | "";
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    examinedAt: string;
    correcting: boolean;
    vitals: VitalsDraft;
    rows: AssessmentRow[];
    /** Null when the examination carries no SCAT6. */
    scat6: Scat6Draft | null;
    decision: ExaminationDecision | "";
    reason: string;
    validUntil: string;
    recommendations: string;
    followUpDate: string;
    restrictions: ReviewRestrictions | null;
    reviewRequests: { answered: number; open: number };
}

const SCAT6_STEP: Record<Scat6Step, string> = { history: "scat6-history", memory: "scat6-memory", balance: "scat6-balance" };

const notEntered = <span className="font-normal text-fg-subtle">Chưa nhập</span>;

const when = (value: string) => (isDateTimeInputValue(value) ? formatDateTime(academyWallClockToIso(...(value.split("T") as [string, string])), "vi") : null);
const day = (value: string) => (isDateKey(value) ? formatDate(academyWallClockToIso(value, "12:00"), "vi") : null);
const hydrationLabels: Readonly<Record<string, string>> = { good: "Tốt", fair: "Trung bình", poor: "Kém" };

/**
 * The last step: what will be sent, as entered, with a way back to each step. The SCAT6 shows raw answers only; the
 * medical service computes its scores after the examination is recorded.
 */
export function ExaminationReview(props: ExaminationReviewProps) {
    const { vitals } = props;
    const vitalsEntered = Object.values(vitals).some((value) => value.trim() !== "");
    const lines = props.scat6 ? scat6ReviewLines(props.scat6) : [];
    return (
        <div className="flex flex-col divide-y divide-border">
            <Group title="Lần khám và sinh hiệu" step="visit">
                <Facts
                    items={[
                        ["Phạm vi", EXAMINATION_SCOPE_LABELS[props.scope]],
                        ["Loại", props.type ? EXAMINATION_TYPE_LABELS[props.type] : null],
                        ["Thời điểm khám", when(props.examinedAt)],
                        ...(props.correcting ? ([["Đính chính", "Đính chính phiếu khám hiện hành của phạm vi này"]] as const) : []),
                        [
                            "Sinh hiệu",
                            vitalsEntered
                                ? [
                                      vitals.weightKg && `${vitals.weightKg} kg`,
                                      vitals.restingHeartRate && `Mạch nghỉ ${vitals.restingHeartRate} nhịp/phút`,
                                      (vitals.bloodPressureSystolic || vitals.bloodPressureDiastolic) && `Huyết áp ${vitals.bloodPressureSystolic || "–"}/${vitals.bloodPressureDiastolic || "–"} mmHg`,
                                      vitals.temperatureC && `${vitals.temperatureC} °C`,
                                      vitals.spo2Pct && `SpO₂ ${vitals.spo2Pct}%`,
                                      hydrationLabels[vitals.hydration] && `Mức nước: ${hydrationLabels[vitals.hydration]}`,
                                  ]
                                      .filter(Boolean)
                                      .join(" · ")
                                : null,
                        ],
                    ]}
                />
            </Group>

            <Group title="Khám thực thể" step="physical">
                {props.rows.length === 0 ? (
                    <p className="text-sm text-fg-subtle">Không đánh giá vùng nào.</p>
                ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                        {props.rows.map((row) => (
                            <li key={row.key} className="flex min-w-0 flex-wrap gap-x-2">
                                <span className="font-medium text-fg">{row.area.trim() || "Vùng chưa đặt tên"}</span>
                                <span className={cn(row.result ? "text-fg-muted" : "text-danger-fg")}>{row.result ? ASSESSMENT_RESULT_LABELS[row.result] : "Chưa có kết quả"}</span>
                                {row.note.trim() && <span className="min-w-0 text-fg-muted">— {row.note.trim()}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </Group>

            {props.scat6 &&
                (["history", "memory", "balance"] as const)
                    .filter((step) => lines.some((line) => line.step === step))
                    .map((step) => (
                        <Group key={step} title={scat6Title(step, props.scat6?.status === "ADMINISTERED")} step={SCAT6_STEP[step]}>
                            <Facts items={lines.filter((line) => line.step === step).map((line) => [line.label, line.value])} />
                        </Group>
                    ))}

            <Group title="Quyết định" step="decision">
                <Facts
                    items={[
                        ["Quyết định", props.decision ? EXAMINATION_DECISION_LABELS[props.decision] : null],
                        ...(props.decision !== "NOT_ELIGIBLE" ? ([["Hiệu lực đến", day(props.validUntil) ?? "Không thời hạn"]] as const) : []),
                        ["Theo dõi", day(props.followUpDate) ?? "Không"],
                        ...(props.restrictions ? ([["Hạn chế", restrictionsText(props.restrictions)]] as const) : []),
                        ...(props.reviewRequests.open > 0 ? ([["Yêu cầu xem xét được trả lời", `${props.reviewRequests.answered}/${props.reviewRequests.open}`]] as const) : []),
                    ]}
                />
                <Prose label="Kết quả và lập luận" text={props.reason} />
                <Prose label="Khuyến nghị" text={props.recommendations} />
            </Group>
        </div>
    );
}

function scat6Title(step: Scat6Step, administered: boolean): string {
    if (!administered) return "SCAT6";
    return step === "history" ? "SCAT6: tiền sử và triệu chứng" : step === "memory" ? "SCAT6: trí nhớ và tập trung" : "SCAT6: thăng bằng và nhớ lại";
}

function restrictionsText(restrictions: ReviewRestrictions): string {
    const parts = [
        restrictions.sessions === null ? null : `buổi tập: ${restrictions.sessions.map((value) => SESSION_TYPE_LABELS[value as SessionType] ?? value).join(", ") || "chưa chọn"}`,
        restrictions.techniques === null ? null : `kỹ thuật: ${restrictions.techniques.map((value) => TECHNIQUE_TYPE_LABELS[value as TechniqueType] ?? value).join(", ") || "chưa chọn"}`,
        restrictions.joints.length > 0 ? `tránh: ${restrictions.joints.map((value) => BODY_JOINT_LABELS[value as BodyJoint] ?? value).join(", ")}` : null,
        restrictions.notes.trim() ? `ghi chú: ${restrictions.notes.trim()}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "Chưa đặt";
}

function Group({ title, step, children }: { title: string; step: string; children: ReactNode }) {
    const { goTo } = useFormSteps();
    return (
        <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                <Button variant="ghost" size="sm" onClick={() => goTo(step)} aria-label={`Sửa ${title.toLowerCase()}`}>
                    <PenLine aria-hidden />
                    Sửa
                </Button>
            </div>
            {children}
        </section>
    );
}

function Facts({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {items.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className="text-[13px] text-fg-muted">{label}</dt>
                    <dd className="text-sm font-medium break-words text-fg">{value ?? notEntered}</dd>
                </div>
            ))}
        </dl>
    );
}

function Prose({ label, text }: { label: string; text: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[13px] text-fg-muted">{label}</p>
            <p className="mt-0.5 text-sm text-pretty whitespace-pre-line text-fg">{text.trim() || notEntered}</p>
        </div>
    );
}
