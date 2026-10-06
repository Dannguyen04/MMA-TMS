import type { CreateClearanceBody, CreateExaminationBody, HydrationLevel } from "@/api/types";

export const SCAT6_FORM_VERSION = "SCAT6-2023-EN" as const;

export const BASELINE_AREAS = [
  { key: "cardio", area: "Cardiovascular" },
  { key: "neuro", area: "Neurological" },
  { key: "msk", area: "Musculoskeletal" },
] as const;

export type BaselineAreaKey = (typeof BASELINE_AREAS)[number]["key"];

export type BaselineDraft = {
  decision: CreateExaminationBody["decision"] | "";
  reason: string;
  restrictionNotes: string;
  weightKg: string;
  restingHeartRate: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  temperatureC: string;
  spo2Pct: string;
  hydration: HydrationLevel | "";
  results: Record<BaselineAreaKey, CreateExaminationBody["assessments"][number]["result"] | "">;
  notes: Record<BaselineAreaKey, string>;
  scat6Reason: string;
  recommendations: string;
};

export function emptyBaselineDraft(): BaselineDraft {
  return {
    decision: "",
    reason: "",
    restrictionNotes: "",
    weightKg: "",
    restingHeartRate: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    temperatureC: "",
    spo2Pct: "",
    hydration: "",
    results: { cardio: "", neuro: "", msk: "" },
    notes: { cardio: "", neuro: "", msk: "" },
    scat6Reason: "",
    recommendations: "",
  };
}

function positive(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function positiveInt(value: string, max: number): number | null {
  const parsed = positive(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed > max) return null;
  return parsed;
}

export function buildBaselineExamination(
  draft: BaselineDraft,
  examinedAt: string,
): { ok: true; body: CreateExaminationBody } | { ok: false; fields: string[] } {
  const fields: string[] = [];
  if (draft.decision !== "ELIGIBLE" && draft.decision !== "ELIGIBLE_WITH_RESTRICTIONS" && draft.decision !== "NOT_ELIGIBLE") {
    fields.push("decision");
  }
  if (draft.reason.trim().length < 1) fields.push("reason");
  const weightKg = positive(draft.weightKg);
  const restingHeartRate = positiveInt(draft.restingHeartRate, 400);
  const bloodPressureSystolic = positiveInt(draft.bloodPressureSystolic, 400);
  const bloodPressureDiastolic = positiveInt(draft.bloodPressureDiastolic, 400);
  const temperatureC = positive(draft.temperatureC);
  const spo2 = positiveInt(draft.spo2Pct, 100);
  if (weightKg === null || weightKg > 999) fields.push("weightKg");
  if (restingHeartRate === null) fields.push("restingHeartRate");
  if (bloodPressureSystolic === null) fields.push("bloodPressureSystolic");
  if (bloodPressureDiastolic === null) fields.push("bloodPressureDiastolic");
  if (temperatureC === null || temperatureC > 99) fields.push("temperatureC");
  if (spo2 === null) fields.push("spo2Pct");
  if (draft.hydration !== "GOOD" && draft.hydration !== "FAIR" && draft.hydration !== "POOR") {
    fields.push("hydration");
  }
  for (const area of BASELINE_AREAS) {
    if (!draft.results[area.key]) fields.push(area.key);
  }
  if (draft.scat6Reason.trim().length < 1) fields.push("scat6Reason");
  const restricted = draft.decision === "ELIGIBLE_WITH_RESTRICTIONS";
  if (restricted && draft.restrictionNotes.trim().length < 1) fields.push("restrictionNotes");
  if (!restricted && draft.restrictionNotes.trim().length > 0) fields.push("restrictionNotes");
  if (fields.length > 0 || weightKg === null || restingHeartRate === null || bloodPressureSystolic === null || bloodPressureDiastolic === null || temperatureC === null || spo2 === null || !draft.hydration || !draft.decision) {
    return { ok: false, fields };
  }

  const body: CreateExaminationBody = {
    scope: "TRAINING",
    decision: draft.decision,
    examinedAt,
    reason: draft.reason.trim(),
    examinationType: "BASELINE",
    vitals: {
      weightKg: Number(weightKg.toFixed(2)),
      restingHeartRate,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      temperatureC: Number(temperatureC.toFixed(1)),
      spo2Pct: spo2,
      hydration: draft.hydration,
    },
    assessments: BASELINE_AREAS.map((area) => ({
      area: area.area,
      result: draft.results[area.key] as CreateExaminationBody["assessments"][number]["result"],
      note: draft.notes[area.key].trim() ? draft.notes[area.key].trim() : null,
    })),
    scat6: {
      status: "NOT_ADMINISTERED",
      formVersion: SCAT6_FORM_VERSION,
      reason: draft.scat6Reason.trim(),
    },
  };
  if (draft.recommendations.trim()) body.recommendations = draft.recommendations.trim();
  if (restricted) body.restrictions = { notes: draft.restrictionNotes.trim() };
  return { ok: true, body };
}

export function buildClearanceRetry(examinationId: string, clearanceType: CreateClearanceBody["clearanceType"]): CreateClearanceBody | null {
  if (!examinationId) return null;
  return { examinationId, clearanceType };
}
