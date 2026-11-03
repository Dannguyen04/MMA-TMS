import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ExaminationType } from "@/lib/domain/types";
import type { AssessmentRowDraft } from "./examination-presets";

/**
 * "Insert findings summary": a factual first draft of the examination's reasoning, built only from what the doctor
 * entered on the form (the visit type, the readings typed, each area's result and note, whether the SCAT6 was
 * administered). It never interprets: no reference ranges, no scores (the medical service computes those), no
 * decision. The doctor edits it before sending. Pure, so it is tested on its own.
 */

export interface FindingsInput {
    type: ExaminationType | "";
    /** The readings as typed; blank ones are left out. */
    vitals: {
        weightKg: string;
        restingHeartRate: string;
        bloodPressureSystolic: string;
        bloodPressureDiastolic: string;
        temperatureC: string;
        spo2Pct: string;
        hydration: string;
    };
    assessments: readonly AssessmentRowDraft[];
    /** Only for a baseline; null when the examination carries no SCAT6. */
    scat6: { status: "ADMINISTERED" | "NOT_ADMINISTERED"; reason: string } | null;
}

const HYDRATION: Record<string, string> = { good: "tốt", fair: "trung bình", poor: "kém" };

function vitalsLine(vitals: FindingsInput["vitals"]): string | null {
    const value = (raw: string) => raw.trim();
    const readings = [
        value(vitals.weightKg) && `cân nặng ${value(vitals.weightKg)} kg`,
        value(vitals.restingHeartRate) && `mạch nghỉ ${value(vitals.restingHeartRate)} lần/phút`,
        value(vitals.bloodPressureSystolic) && value(vitals.bloodPressureDiastolic) && `huyết áp ${value(vitals.bloodPressureSystolic)}/${value(vitals.bloodPressureDiastolic)} mmHg`,
        value(vitals.temperatureC) && `nhiệt độ ${value(vitals.temperatureC)} °C`,
        value(vitals.spo2Pct) && `SpO2 ${value(vitals.spo2Pct)}%`,
        HYDRATION[vitals.hydration] && `mức nước ${HYDRATION[vitals.hydration]}`,
    ].filter(Boolean);
    return readings.length > 0 ? `Sinh hiệu: ${readings.join(", ")}.` : null;
}

function areasLine(label: string, rows: readonly AssessmentRowDraft[]): string | null {
    if (rows.length === 0) return null;
    const areas = rows.map((row) => (row.note.trim() ? `${row.area.trim()} (${row.note.trim().replace(/[.\s]+$/, "")})` : row.area.trim()));
    return `${label}: ${areas.join("; ")}.`;
}

/** The summary, one sentence per line; empty when nothing has been entered yet. */
export function findingsSummary(input: FindingsInput): string {
    const named = input.assessments.filter((row) => row.area.trim() !== "" && row.result !== "");
    const lines = [
        input.type ? `${EXAMINATION_TYPE_LABELS[input.type]}.` : null,
        vitalsLine(input.vitals),
        areasLine("Bình thường", named.filter((row) => row.result === "normal")),
        areasLine("Bất thường", named.filter((row) => row.result === "abnormal")),
        areasLine("Chưa kết luận", named.filter((row) => row.result === "inconclusive")),
        input.scat6
            ? input.scat6.status === "ADMINISTERED"
                ? "Đã thực hiện SCAT6; dịch vụ y tế tự tính điểm."
                : `Không thực hiện SCAT6${input.scat6.reason.trim() ? `: ${input.scat6.reason.trim().replace(/[.\s]+$/, "")}` : ""}.`
            : null,
    ].filter((line): line is string => Boolean(line));
    // A type alone says nothing about the findings.
    return lines.length > (input.type ? 1 : 0) ? lines.join("\n") : "";
}
