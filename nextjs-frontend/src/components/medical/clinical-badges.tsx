import { Ban, CalendarX2, Check, CircleCheck, CircleDashed, CircleDot, CircleMinus, CircleQuestionMark, CircleX, TriangleAlert } from "lucide-react";

import { StatusBadge, type BadgeSize, type StatusMeta } from "@/components/domain/status-badges";
import { ASSESSMENT_RESULT_LABELS, CLEARANCE_STATUS_LABELS, EXAMINATION_OUTCOME_LABELS } from "@/lib/domain/labels";
import type { AssessmentResult, ClearanceLevel, ClearanceStatus, ExaminationOutcome } from "@/lib/domain/types";

/**
 * Presentation for clinical statuses that have no badge in the shared domain set:
 * examination outcomes, assessment results and the lifecycle status of a clearance record.
 * Label + icon + tone, never colour alone.
 */

export const EXAMINATION_OUTCOME_META: Record<ExaminationOutcome, StatusMeta> = {
    fit: { label: EXAMINATION_OUTCOME_LABELS.fit, tone: "success", icon: CircleCheck },
    fit_with_restrictions: { label: EXAMINATION_OUTCOME_LABELS.fit_with_restrictions, tone: "warning", icon: CircleMinus },
    unfit: { label: EXAMINATION_OUTCOME_LABELS.unfit, tone: "danger", icon: CircleX },
};

/** Plain-language meaning of each outcome, shown in the form and on the examination. */
export const EXAMINATION_OUTCOME_DESCRIPTIONS: Record<ExaminationOutcome, string> = {
    fit: "No findings that limit training. The fighter can train normally.",
    fit_with_restrictions: "The fighter can train, but findings call for limits — set them in a restricted Medical Clearance.",
    unfit: "Findings mean the fighter should not train until they are reassessed.",
};

/** The clearance level an examination outcome points to. */
export const CLEARANCE_LEVEL_FOR_OUTCOME: Record<ExaminationOutcome, ClearanceLevel> = {
    fit: "full",
    fit_with_restrictions: "restricted",
    unfit: "not_cleared",
};

export function ExaminationOutcomeBadge({ outcome, size, className }: { outcome: ExaminationOutcome; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={EXAMINATION_OUTCOME_META[outcome]} size={size} className={className} />;
}

export const ASSESSMENT_RESULT_META: Record<AssessmentResult, StatusMeta> = {
    normal: { label: ASSESSMENT_RESULT_LABELS.normal, tone: "success", icon: Check },
    abnormal: { label: ASSESSMENT_RESULT_LABELS.abnormal, tone: "warning", icon: TriangleAlert },
    inconclusive: { label: ASSESSMENT_RESULT_LABELS.inconclusive, tone: "neutral", icon: CircleQuestionMark },
};

export function AssessmentResultBadge({ result, size, className }: { result: AssessmentResult; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={ASSESSMENT_RESULT_META[result]} size={size} className={className} />;
}

const CLEARANCE_RECORD_META: Record<ClearanceStatus, StatusMeta> = {
    active: { label: CLEARANCE_STATUS_LABELS.active, tone: "primary", icon: CircleDot },
    expired: { label: CLEARANCE_STATUS_LABELS.expired, tone: "warning", icon: CalendarX2 },
    revoked: { label: CLEARANCE_STATUS_LABELS.revoked, tone: "danger", icon: Ban },
    superseded: { label: CLEARANCE_STATUS_LABELS.superseded, tone: "neutral", icon: CircleDashed },
};

/** Lifecycle of a clearance record (active, superseded, revoked, expired) — not the training state. */
export function ClearanceRecordStatusBadge({ status, size, className }: { status: ClearanceStatus; size?: BadgeSize; className?: string }) {
    return <StatusBadge meta={CLEARANCE_RECORD_META[status]} variant="outline" size={size} className={className} />;
}
