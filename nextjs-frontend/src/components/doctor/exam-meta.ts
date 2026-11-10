import type { ExaminationDecision } from "@/lib/domain/medical-contract";
import type { ExaminationOutcome, MedicalExamination } from "@/lib/domain/types";
import type { Translator } from "@/lib/i18n/translate";

import { EXAM_TYPE, SCOPE, fmtDate } from "./labels";

export const DECISION_OF: Record<ExaminationOutcome, ExaminationDecision> = { fit: "ELIGIBLE", fit_with_restrictions: "ELIGIBLE_WITH_RESTRICTIONS", unfit: "NOT_ELIGIBLE" };

export const examKind = (t: Translator, e: Pick<MedicalExamination, "type" | "scope">) =>
    e.type ? t(EXAM_TYPE[e.type]) : e.scope ? t("doctorUi.exam.kindScoped", { scope: t(SCOPE[e.scope]).toLowerCase() }) : t("doctorUi.exam.kind");
export const examLabel = (t: Translator, e: Pick<MedicalExamination, "type" | "scope" | "date">) => `${examKind(t, e)} · ${fmtDate(e.date, t.locale ?? "vi")}`;
