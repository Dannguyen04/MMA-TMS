import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ExaminationType } from "@/lib/domain/types";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { localLabel, type AssessmentRowDraft } from "./examination-presets";

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

const HYDRATION: Record<string, MessageKey> = { good: "doctorMedical.findings.hydrationGood", fair: "doctorMedical.findings.hydrationFair", poor: "doctorMedical.findings.hydrationPoor" };

function vitalsLine(t: Translator, vitals: FindingsInput["vitals"]): string | null {
    const value = (raw: string) => raw.trim();
    const readings = [
        value(vitals.weightKg) && t("doctorMedical.findings.weight", { value: value(vitals.weightKg) }),
        value(vitals.restingHeartRate) && t("doctorMedical.findings.heartRate", { value: value(vitals.restingHeartRate) }),
        value(vitals.bloodPressureSystolic) &&
            value(vitals.bloodPressureDiastolic) &&
            t("doctorMedical.findings.bloodPressure", { systolic: value(vitals.bloodPressureSystolic), diastolic: value(vitals.bloodPressureDiastolic) }),
        value(vitals.temperatureC) && t("doctorMedical.findings.temperature", { value: value(vitals.temperatureC) }),
        value(vitals.spo2Pct) && `SpO2 ${value(vitals.spo2Pct)}%`,
        HYDRATION[vitals.hydration] && t("doctorMedical.findings.hydration", { value: t(HYDRATION[vitals.hydration]) }),
    ].filter(Boolean);
    return readings.length > 0 ? t("doctorMedical.findings.vitals", { readings: readings.join(", ") }) : null;
}

function areasLine(label: string, rows: readonly AssessmentRowDraft[]): string | null {
    if (rows.length === 0) return null;
    const areas = rows.map((row) => (row.note.trim() ? `${row.area.trim()} (${row.note.trim().replace(/[.\s]+$/, "")})` : row.area.trim()));
    return `${label}: ${areas.join("; ")}.`;
}

/** The summary, one sentence per line; empty when nothing has been entered yet. */
export function findingsSummary(t: Translator, input: FindingsInput): string {
    const named = input.assessments.filter((row) => row.area.trim() !== "" && row.result !== "");
    const lines = [
        input.type ? `${localLabel(t, `examinationType.${input.type}`, EXAMINATION_TYPE_LABELS[input.type])}.` : null,
        vitalsLine(t, input.vitals),
        areasLine(t("doctorMedical.result.normal"), named.filter((row) => row.result === "normal")),
        areasLine(t("doctorMedical.result.abnormal"), named.filter((row) => row.result === "abnormal")),
        areasLine(t("doctorMedical.result.inconclusive"), named.filter((row) => row.result === "inconclusive")),
        input.scat6
            ? input.scat6.status === "ADMINISTERED"
                ? t("doctorMedical.findings.scat6Done")
                : input.scat6.reason.trim()
                  ? t("doctorMedical.findings.scat6NotDoneReason", { reason: input.scat6.reason.trim().replace(/[.\s]+$/, "") })
                  : t("doctorMedical.findings.scat6NotDone")
            : null,
    ].filter((line): line is string => Boolean(line));
    // A type alone says nothing about the findings.
    return lines.length > (input.type ? 1 : 0) ? lines.join("\n") : "";
}
