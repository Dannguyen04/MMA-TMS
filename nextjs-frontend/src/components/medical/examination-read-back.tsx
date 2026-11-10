import { ChevronDown, CircleCheck, ClipboardCheck, ShieldAlert, TriangleAlert } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { vitalReadings } from "@/components/domain/vitals-grid";
import { EXAMINATION_DECISION_LABELS, EXAMINATION_SCOPE_LABELS } from "@/lib/domain/medical-contract";
import { ASSESSMENT_RESULT_LABELS, assessmentAreaLabel, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { assessVitals, vitalAssessmentMessage } from "@/lib/domain/vitals";
import { formatDate, formatDateTime } from "@/lib/format";
import { createTranslator } from "@/lib/i18n/translate";
import type { CurrentExamination } from "@/lib/services/medical";
import { cn } from "@/lib/utils";
import { Scat6Summary } from "./scat6-summary";

/** One finding of the examination: a vital sign or an assessed area, flagged when it needs the doctor's attention. */
interface Finding {
    key: string;
    label: string;
    value: string;
    unit: string;
    flagged: boolean;
    /** The word for the flag ("Cần kiểm tra", "Bất thường"…), or "Bình thường". */
    verdict: string;
    /** Reference range for a vital, the doctor's note for an area. */
    detail: string;
    kind: "vital" | "area";
}

function findingsOf(exam: CurrentExamination, weightLimitKg: number | null): Finding[] {
    const t = createTranslator("vi");
    const details = exam.details;
    if (!details) return [];
    const vitals: Finding[] = [];
    if (details.vitals) {
        const checks = assessVitals(details.vitals, weightLimitKg ?? undefined);
        for (const reading of vitalReadings(details.vitals, t)) {
            const check = checks[reading.key];
            const flagged = check != null && check.status !== "normal";
            vitals.push({
                key: reading.key,
                label: reading.label,
                value: reading.value,
                unit: reading.unit,
                flagged,
                verdict: flagged ? t("vitals.check") : t("vitals.normal"),
                detail: check ? vitalAssessmentMessage(t, check) : t("vitals.noWeightClassReference"),
                kind: "vital",
            });
        }
    }
    const areas: Finding[] = details.assessments.map((assessment, index) => ({
        key: `area-${index}`,
        label: assessmentAreaLabel(assessment.area),
        value: ASSESSMENT_RESULT_LABELS[assessment.result],
        unit: "",
        flagged: assessment.result !== "normal",
        verdict: ASSESSMENT_RESULT_LABELS[assessment.result],
        detail: assessment.note?.trim() || "Vùng đánh giá",
        kind: "area",
    }));
    return [...vitals, ...areas];
}

function counted(findings: Finding[]): string {
    const vitals = findings.filter((finding) => finding.kind === "vital").length;
    const areas = findings.length - vitals;
    return [vitals > 0 && `${vitals} chỉ số`, areas > 0 && `${areas} vùng đánh giá`].filter(Boolean).join(" · ");
}

/**
 * The examination a clearance is about to be issued from, as the medical service returned it. What needs the doctor's
 * attention comes first; the normal findings fold into one line. Read-only, so the doctor checks it before issuing. A
 * record kept without details says so instead of looking complete.
 */
export function ExaminationReadBack({ exam, weightLimitKg }: { exam: CurrentExamination; weightLimitKg: number | null }) {
    const { details } = exam;
    const restricted = exam.decision === "ELIGIBLE_WITH_RESTRICTIONS";
    const findings = findingsOf(exam, weightLimitKg);
    const attention = findings.filter((finding) => finding.flagged);
    const normal = findings.filter((finding) => !finding.flagged);
    const DecisionIcon = restricted ? ShieldAlert : CircleCheck;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                    <p className="text-[15.5px] font-bold text-fg">
                        Phiếu khám {EXAMINATION_SCOPE_LABELS[exam.scope].toLowerCase()} · {details?.type ? EXAMINATION_TYPE_LABELS[details.type] : "chưa ghi loại"}
                    </p>
                    <p className="text-[13.5px] text-fg-muted">{formatDateTime(exam.examinedAt)}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 text-[13.5px] font-semibold", restricted ? "text-warning-fg" : "text-success-fg")}>
                    <DecisionIcon aria-hidden className="size-4" />
                    {EXAMINATION_DECISION_LABELS[exam.decision]}
                </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg bg-surface-muted px-3.5 py-3">
                <h4 className="text-[12.5px] font-semibold text-fg-muted">Kết quả và lập luận</h4>
                <p className="text-sm text-pretty whitespace-pre-line text-fg">{exam.reason}</p>
                <p className="text-[13px] text-fg-muted">{exam.validUntil ? `Quyết định hiệu lực đến ${formatDate(exam.validUntil)}.` : "Quyết định không có thời hạn."}</p>
            </div>

            {!details ? (
                <InlineNote icon={ClipboardCheck}>Phiếu khám ghi không kèm chi tiết: không có sinh hiệu, vùng đánh giá hay SCAT6.</InlineNote>
            ) : (
                <>
                    {!details.vitals && <p className="text-[13px] text-fg-muted">Không ghi sinh hiệu.</p>}
                    {attention.length > 0 ? (
                        <section aria-labelledby="readback-attention" className="flex flex-col gap-2">
                            <h4 id="readback-attention" className="flex items-center gap-2 text-[13.5px] font-semibold text-warning-fg">
                                <TriangleAlert aria-hidden className="size-4" />
                                Cần chú ý · {counted(attention)}
                            </h4>
                            <FindingTable findings={attention} head />
                        </section>
                    ) : (
                        findings.length > 0 && (
                            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3.5 py-2.5 text-sm font-semibold text-success-fg">
                                <CircleCheck aria-hidden className="size-4" />
                                Tất cả chỉ số và vùng đánh giá đều bình thường.
                            </p>
                        )
                    )}
                    {normal.length > 0 && (
                        <details className="group rounded-lg border border-border">
                            <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13.5px] group-open:rounded-b-none group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
                                <span className="inline-flex items-center gap-1.5 font-semibold text-success-fg">
                                    <CircleCheck aria-hidden className="size-4" />
                                    Bình thường
                                </span>
                                <span className="truncate text-fg-muted">{counted(normal)}</span>
                                <ChevronDown aria-hidden className="size-4 text-fg-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                            </summary>
                            <div className="px-3.5 pb-1.5">
                                <FindingTable findings={normal} />
                            </div>
                        </details>
                    )}
                    {details.assessments.length === 0 && <p className="text-[13px] text-fg-muted">Không đánh giá vùng nào.</p>}
                </>
            )}
            {details?.scat6 && <Scat6Summary record={details.scat6} />}
        </div>
    );
}

/** Findings as a table: what, the value, the verdict in words (attention only) and the reference or note. */
function FindingTable({ findings, head = false }: { findings: Finding[]; head?: boolean }) {
    return (
        <table className="w-full border-collapse text-sm">
            {head && (
                <thead>
                    <tr className="text-left text-[12.5px] text-fg-subtle">
                        <th className="pr-3 pb-1.5 font-semibold">Mục</th>
                        <th className="pr-3 pb-1.5 font-semibold">Giá trị</th>
                        <th className="pr-3 pb-1.5 font-semibold">Đánh giá</th>
                        <th className="hidden pb-1.5 font-semibold sm:table-cell">Tham chiếu / ghi chú</th>
                    </tr>
                </thead>
            )}
            <tbody>
                {findings.map((finding) => (
                    <tr key={finding.key} className={cn("align-top", head ? "border-t border-border" : "border-b border-border last:border-b-0")}>
                        <td className={cn("py-2 pr-3", head ? "font-semibold text-fg" : "text-fg")}>{finding.label}</td>
                        <td className="py-2 pr-3 font-bold whitespace-nowrap text-fg">
                            {/* An area's value is its verdict, already in the Đánh giá column when flagged. */}
                            {finding.kind === "area" && head ? <span className="font-normal text-fg-subtle">—</span> : finding.value}
                            {finding.unit && <span className="ml-0.5 text-[12.5px] font-medium text-fg-muted">{finding.unit}</span>}
                        </td>
                        {head && (
                            <td className="py-2 pr-3">
                                <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold whitespace-nowrap text-warning-fg">
                                    <TriangleAlert aria-hidden className="size-4" />
                                    {finding.verdict}
                                </span>
                            </td>
                        )}
                        <td className={cn("py-2 text-[13px] text-fg-muted", head && "hidden sm:table-cell")}>{finding.detail}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
