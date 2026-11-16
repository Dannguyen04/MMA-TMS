import type { MedicalExamination } from "@/api/types";
import { decisionLabel, jointLabel, scopeLabel } from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { doctorClinical as t } from "@/i18n/doctor-clinical";
import { doctorRo } from "@/i18n/doctor-ro";
import { vnDate } from "@/screens/coach/readonly/ro-format";

import { vnDayMonth } from "./detail-format";

/** One exam page (redesign step 20); `xem` and `[examId]` redirect here. */
export const DOCTOR_EXAM_PAGE = "/(doctor)/examinations/chi-tiet";
export const DOCTOR_FIGHTER_PAGE = "/(doctor)/vo-si/chi-tiet";
export type DoctorFighterTab = "overview" | "exams" | "history" | "ai";

export const examHref = (id: string, fighterId: string) => ({ pathname: DOCTOR_EXAM_PAGE, params: { id, fighterId } });
export const doctorFighterHref = (id: string, tab?: DoctorFighterTab) =>
  ({ pathname: DOCTOR_FIGHTER_PAGE, params: tab && tab !== "overview" ? { id, tab } : { id } });

/** The decision as a word: Đạt (green), Đạt có hạn chế / Không đạt (red). */
export function decisionWord(d: MedicalExamination["decision"]): { word: string; tone: "ok" | "warn"; mark: string } {
  if (d === "ELIGIBLE") return { word: decisionLabel(d), tone: "ok", mark: "✓" };
  return { word: d === "NOT_ELIGIBLE" ? doctorRo.detail2.verdictFail : decisionLabel(d), tone: "warn", mark: "!" };
}

export function examTypeText(e: MedicalExamination): string {
  const k = e.details?.examinationType;
  return k ? (doctor.exam.types as Record<string, string>)[k] ?? "" : "";
}

/** A Khám row: mark, "Tập luyện #3", the decision word, then date · type · follow-up or valid-until · joints to avoid. */
export function examView(e: MedicalExamination) {
  const w = decisionWord(e.decision);
  const det = e.details;
  const joints = e.restrictions?.excludedJoints ?? [];
  const line = [
    vnDayMonth(e.examinedAt),
    examTypeText(e),
    det?.followUpDate ? t.followUp(vnDayMonth(det.followUpDate)) : e.validUntil ? t.until(vnDayMonth(e.validUntil)) : "",
    joints.length ? t.avoid(joints.map(jointLabel).join(", ").toLocaleLowerCase("vi")) : "",
  ].filter(Boolean).join(" · ");
  return { title: t.examTitle(scopeLabel(e.scope), e.sequenceNo), word: w.word, tone: w.tone, mark: w.mark, line };
}

/** The exam page title line: fighter · scope #n · date time. */
export function examSubline(e: MedicalExamination, fighter: string): string {
  const d = new Date(e.examinedAt);
  const time = Number.isNaN(d.getTime()) ? "" : new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
  return [fighter, t.examTitle(scopeLabel(e.scope), e.sequenceNo), [vnDate(e.examinedAt), time].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}
