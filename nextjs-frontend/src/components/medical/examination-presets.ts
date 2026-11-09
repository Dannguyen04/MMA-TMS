import type { AssessmentResult, ExaminationType, Vitals } from "@/lib/domain/types";
import { assessVital, vitalAssessmentMessage, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";
import { createTranslator } from "@/lib/i18n/translate";

/**
 * Assessment areas pre-filled for each examination type, with no result: the doctor marks each one. Doctors can rename,
 * remove or add rows. A baseline's SCAT6 has its own steps, so it isn't an area here.
 */
export const ASSESSMENT_PRESETS: Record<ExaminationType, string[]> = {
    baseline: ["Tim mạch", "Hô hấp", "Sàng lọc thần kinh", "Thị lực", "Sàng lọc cơ xương khớp"],
    routine: ["Tim mạch", "Hô hấp", "Biên độ vận động chủ động", "Sức mạnh", "Nghiệm pháp đặc hiệu", "Cân nặng & mức nước"],
    pre_fight: ["Tim mạch", "Sàng lọc thần kinh", "Sàng lọc mắt", "Sàng lọc cơ xương khớp", "Kiểm tra cân nặng", "Sàng lọc bệnh truyền nhiễm"],
    post_injury: ["Nhìn", "Sờ nắn", "Biên độ vận động chủ động", "Sức mạnh", "Nghiệm pháp đặc hiệu", "Thần kinh – mạch máu"],
    concussion_screen: ["Sàng lọc dấu hiệu nguy hiểm", "Đánh giá triệu chứng", "Sàng lọc nhận thức (SAC)", "Thăng bằng (mBESS)", "Cột sống cổ"],
    return_to_play: ["Rà soát triệu chứng", "Biên độ vận động chủ động", "Sức mạnh", "Kiểm tra chức năng", "Bài tập chuyên môn", "Khả năng chịu gắng sức"],
};

export const EXAMINATION_TYPE_HINTS: Record<ExaminationType, string> = {
    baseline: "Khám tổng quát đầu tiên, đặt giá trị tham chiếu cho các lần khám sau.",
    routine: "Khám định kỳ, hoặc đánh giá trọng tâm khi chưa ghi nhận chấn thương.",
    pre_fight: "Bắt buộc trước thi đấu, thường dùng để gia hạn giấy phép.",
    post_injury: "Đánh giá chấn thương mới hoặc nghi ngờ.",
    concussion_screen: "Sàng lọc theo SCAT6 sau va chạm đầu: triệu chứng, nhận thức và thăng bằng.",
    return_to_play: "Kiểm tra mức sẵn sàng tăng tập sau chấn thương hoặc bệnh.",
};

/** A row of the assessments list as the form keeps it: the result stays empty until the doctor marks it. */
export interface AssessmentRowDraft {
    area: string;
    result: AssessmentResult | "";
    note: string;
}

/** Named rows the doctor hasn't marked yet. Rows without an area name are left for the doctor to name first. */
export function unmarkedAreas<T extends AssessmentRowDraft>(rows: readonly T[]): T[] {
    return rows.filter((row) => row.result === "" && row.area.trim() !== "");
}

/**
 * "Mark the unmarked areas Normal": an explicit doctor action that sets only named rows with no result yet. A row
 * already marked (normal, abnormal or inconclusive) is never changed. Returns the rows and the areas it filled.
 */
export function markUnmarkedNormal<T extends AssessmentRowDraft>(rows: readonly T[]): { rows: T[]; filled: string[] } {
    const filled: string[] = [];
    const next = rows.map((row) => {
        if (row.result !== "" || row.area.trim() === "") return row;
        filled.push(row.area.trim());
        return { ...row, result: "normal" as const };
    });
    return { rows: next, filled };
}

/** What stops the doctor leaving the assessments, in one sentence, or null. Mirrors the action's rules for the rows. */
export function assessmentRowsProblem(rows: readonly AssessmentRowDraft[], { baseline }: { baseline: boolean }): string | null {
    if (baseline && rows.length === 0) return "Khám nền cần ít nhất một vùng được đánh giá. Hãy thêm một vùng.";
    const unnamed = rows.filter((row) => row.area.trim() === "").length;
    const unmarked = rows.filter((row) => row.area.trim() !== "" && row.result === "").length;
    const undescribed = rows.filter((row) => row.result === "abnormal" && row.note.trim() === "").length;
    const parts = [
        unmarked > 0 ? `ghi kết quả cho ${unmarked === 1 ? "1 vùng" : `${unmarked} vùng`}` : null,
        unnamed > 0 ? `đặt tên ${unnamed === 1 ? "1 dòng" : `${unnamed} dòng`} hoặc xóa đi` : null,
        undescribed > 0 ? `mô tả ${undescribed === 1 ? "dấu hiệu bất thường" : `${undescribed} dấu hiệu bất thường`}` : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    const sentence = parts.join(", ");
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export type VitalCheck = { status: "normal" | "check"; text: string } | null;

/** A typed number, or null while the field is empty or not a number yet. */
const parse = (value: string): number | null => {
    if (value.trim() === "") return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
};

const toCheck = (assessment: VitalAssessment | null): VitalCheck =>
    assessment && { status: assessment.status, text: vitalAssessmentMessage(createTranslator("vi"), assessment) };

const HYDRATION_LEVELS: Vitals["hydration"][] = ["good", "fair", "poor"];

/**
 * Live reference-range hints while vitals are typed. Judged by `lib/domain/vitals`, like the
 * VitalsGrid on examination pages, so the form and the saved record agree.
 */
export function checkVitals(
    values: Record<keyof Omit<Vitals, "hydration">, string> & { hydration: string },
    weightLimitKg: number | null,
): Record<VitalKey, VitalCheck> {
    const weight = parse(values.weightKg);
    const heartRate = parse(values.restingHeartRate);
    const systolic = parse(values.bloodPressureSystolic);
    const diastolic = parse(values.bloodPressureDiastolic);
    const temperature = parse(values.temperatureC);
    const spo2 = parse(values.spo2Pct);
    const hydration = HYDRATION_LEVELS.find((level) => level === values.hydration);

    return {
        weightKg: weight === null ? null : (toCheck(assessVital("weightKg", weight, { weightLimitKg })) ?? { status: "normal", text: "Không có tham chiếu hạng cân" }),
        restingHeartRate: heartRate === null ? null : toCheck(assessVital("restingHeartRate", heartRate)),
        bloodPressure: systolic === null || diastolic === null ? null : toCheck(assessVital("bloodPressure", { systolic, diastolic })),
        temperatureC: temperature === null ? null : toCheck(assessVital("temperatureC", temperature)),
        spo2Pct: spo2 === null ? null : toCheck(assessVital("spo2Pct", spo2)),
        hydration: hydration ? toCheck(assessVital("hydration", hydration)) : null,
    };
}

/**
 * When to see the fighter again, by examination type, as the form's starting follow-up date. The doctor can change or
 * clear it; a pre-fight check has none, since the bout is what comes next.
 */
export const FOLLOW_UP_DEFAULT_DAYS: Record<ExaminationType, number | null> = {
    baseline: 28,
    routine: 28,
    pre_fight: null,
    post_injury: 7,
    concussion_screen: 7,
    return_to_play: 14,
};

/** The type a new examination starts on when no link chose one: a baseline for a fighter never examined, otherwise a routine check. */
export function defaultExaminationType(hasPreviousExamination: boolean): ExaminationType {
    return hasPreviousExamination ? "routine" : "baseline";
}

/** The previous examination's vitals as form text, for the placeholders and the "use previous readings" fill. */
export function vitalsDraftFrom(vitals: Vitals | null | undefined): Record<keyof Vitals, string> | null {
    if (!vitals) return null;
    return {
        weightKg: String(vitals.weightKg),
        restingHeartRate: String(vitals.restingHeartRate),
        bloodPressureSystolic: String(vitals.bloodPressureSystolic),
        bloodPressureDiastolic: String(vitals.bloodPressureDiastolic),
        temperatureC: String(vitals.temperatureC),
        spo2Pct: String(vitals.spo2Pct),
        hydration: vitals.hydration,
    };
}

/** Fills only the blank readings from the previous examination; a reading already typed is never replaced. */
export function fillBlankVitals<T extends Record<string, string>>(current: T, previous: Partial<Record<keyof T, string>>): { next: T; filled: (keyof T)[] } {
    const filled: (keyof T)[] = [];
    const next = { ...current };
    for (const key of Object.keys(current) as (keyof T)[]) {
        const value = previous[key];
        if (current[key].trim() === "" && value) {
            next[key] = value as T[keyof T];
            filled.push(key);
        }
    }
    return { next, filled };
}
