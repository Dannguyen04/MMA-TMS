import type { ExaminationDecision } from "@/lib/domain/medical-contract";
import type { ExaminationOutcome, MedicalExamination } from "@/lib/domain/types";
import { EXAM_TYPE, SCOPE, fmtDate } from "./labels";

export const DECISION_OF: Record<ExaminationOutcome, ExaminationDecision> = { fit: "ELIGIBLE", fit_with_restrictions: "ELIGIBLE_WITH_RESTRICTIONS", unfit: "NOT_ELIGIBLE" };

export const examKind = (e: Pick<MedicalExamination, "type" | "scope">) => (e.type ? EXAM_TYPE[e.type] : e.scope ? `Phiếu khám ${SCOPE[e.scope].toLowerCase()}` : "Phiếu khám");
export const examLabel = (e: Pick<MedicalExamination, "type" | "scope" | "date">) => `${examKind(e)} · ${fmtDate(e.date)}`;
