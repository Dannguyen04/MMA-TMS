import { EXAMINATION_OUTCOME_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { AssessmentResult, ExaminationOutcome, ExaminationType } from "@/lib/domain/types";

/** How far one part of the examination form is: nothing yet, under way, something to fix, or complete. */
export type StepState = "todo" | "part" | "need" | "done";

/** One part of a form as the progress column shows it. */
export interface ProgressStep {
    key: string;
    label: string;
    /** 0 to 1. */
    pct: number;
    state: StepState;
    /** What the doctor still has to do, or what was recorded. */
    text: string;
}

export interface ExamStep extends ProgressStep {
    key: "visit" | "vitals" | "assess" | "decide";
    label: string;
    /** 0 to 1. */
    pct: number;
    state: StepState;
    /** What the doctor still has to do, or what was recorded. */
    text: string;
}

export interface ExamProgressInput {
    /** YYYY-MM-DDTHH:mm. */
    date: string;
    type: ExaminationType | "";
    vitals: Record<string, string>;
    rows: readonly { area: string; result: AssessmentResult | ""; note: string }[];
    outcome: ExaminationOutcome | "";
    summary: string;
    recommendations: string;
}

const filled = (value: string) => value.trim() !== "";

/** Where each part of the form stands, recomputed from the form's own values on every change. */
export function examProgress(input: ExamProgressInput): ExamStep[] {
    const visitParts = [filled(input.date), input.type !== ""].filter(Boolean).length;
    const day = input.date.length >= 10 ? `${input.date.slice(8, 10)}/${input.date.slice(5, 7)}` : "";
    const visit: ExamStep = {
        key: "visit",
        label: "Lần khám",
        pct: visitParts / 2,
        state: visitParts === 2 ? "done" : visitParts ? "part" : "todo",
        text: visitParts === 2 && input.type ? `${EXAMINATION_TYPE_LABELS[input.type]} · ${day}` : input.type ? "Thiếu ngày giờ" : "Chọn loại phiếu",
    };

    const vitalValues = Object.values(input.vitals);
    const vitalsDone = vitalValues.filter(filled).length;
    const vitals: ExamStep = {
        key: "vitals",
        label: "Sinh hiệu",
        pct: vitalValues.length ? vitalsDone / vitalValues.length : 0,
        state: vitalsDone === vitalValues.length ? "done" : vitalsDone ? "part" : "todo",
        text: `${vitalsDone}/${vitalValues.length}`,
    };

    const rows = input.rows.filter((row) => filled(row.area));
    const marked = rows.filter((row) => row.result !== "").length;
    const undescribed = rows.filter((row) => row.result === "abnormal" && !filled(row.note)).length;
    const assess: ExamStep = {
        key: "assess",
        label: "Đánh giá",
        // A finding still waiting for its description counts half.
        pct: rows.length ? (marked - undescribed / 2) / rows.length : 0,
        state: undescribed ? "need" : rows.length > 0 && marked === rows.length ? "done" : marked ? "part" : "todo",
        text: undescribed ? `${undescribed} cần mô tả` : rows.length ? `${marked}/${rows.length}` : "Chưa có vùng",
    };

    const decideParts = [input.outcome !== "", filled(input.summary), filled(input.recommendations)];
    const decided = decideParts.filter(Boolean).length;
    const decide: ExamStep = {
        key: "decide",
        label: "Kết luận",
        pct: decided / 3,
        state: decided === 3 ? "done" : decided ? "part" : "todo",
        text: !input.outcome ? "Chưa chọn" : !decideParts[1] ? "Thiếu tóm tắt" : !decideParts[2] ? "Thiếu khuyến nghị" : EXAMINATION_OUTCOME_LABELS[input.outcome],
    };

    return [visit, vitals, assess, decide];
}

/**
 * The filled part of a progress circle: a sector from twelve o'clock, sweeping counter-clockwise (towards the left
 * first), in a 20×20 box. Drawn as a path, so every browser renders the same direction.
 */
export function sectorPath(pct: number, radius = 9.25): string {
    const c = 10;
    if (pct <= 0) return "";
    if (pct >= 1) return `M${c} ${c - radius}A${radius} ${radius} 0 1 0 ${c} ${c + radius}A${radius} ${radius} 0 1 0 ${c} ${c - radius}Z`;
    const angle = pct * 2 * Math.PI;
    const x = c - radius * Math.sin(angle);
    const y = c - radius * Math.cos(angle);
    // Sweep flag 0 is counter-clockwise in SVG's y-down coordinates.
    return `M${c} ${c}L${c} ${c - radius}A${radius} ${radius} 0 ${pct > 0.5 ? 1 : 0} 0 ${x.toFixed(3)} ${y.toFixed(3)}Z`;
}
