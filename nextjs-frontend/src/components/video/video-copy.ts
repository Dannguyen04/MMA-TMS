import { TECHNIQUE_LABELS, TECHNIQUES, STRIKE_TYPES, FINDING_CATEGORY_LABELS, techniqueLabel } from "@/lib/domain/labels";
import type { ReviewCounts } from "@/lib/domain/ai-review";
import { MOVEMENT_REVIEW_LABELS, type MovementEvidence } from "@/lib/domain/movement-evidence";
import type {
    CameraAngle,
    Detection,
    FindingCategory,
    FindingImpact,
    Limb,
    MovementEventType,
    PipelineStage,
    ReviewDecision,
    StrikeType,
    Technique,
} from "@/lib/domain/types";
import { formatConfidence } from "@/lib/format";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";

/**
 * Viewer-language wording for the video and AI-analysis screens. English output is exactly what the
 * screens showed before the video sweep (the `labels.ts` constants and the worker's English sentences).
 */

const key = (k: string) => k as MessageKey;

/** "87%", or "Unavailable" in the viewer's language when there is no score. */
export function confidencePct(t: Translator, confidence: number | null): string {
    return confidence === null ? t(key("screens.video.unavailable")) : formatConfidence(confidence);
}

/** "87% confidence" / "confidence unavailable" for running text, as the timeline and dialogs word it. */
export function confidencePhrase(t: Translator, detection: { confidence: number | null; confidenceAvailable?: boolean }): string {
    return detection.confidenceAvailable === false
        ? t(key("screens.video.confidenceUnavailableLower"))
        : t(key("screens.shared.confidence"), { pct: confidencePct(t, detection.confidence) });
}

/** "Possible jab": an observation, never a verdict. */
export function possibleStrike(t: Translator, type: StrikeType): string {
    return t(key(`screens.video.possible.${type}`));
}

/** The bare strike word for running text ("Review jab at 0:12"). */
export function strikeWord(t: Translator, type: StrikeType): string {
    return t(key(`screens.video.strikeWord.${type}`));
}

export function limbLabel(t: Translator, limb: Limb): string {
    return t(key(`screens.video.limb.${limb}`));
}

export function cameraAngleLabel(t: Translator, angle: CameraAngle): string {
    return t(key(`screens.video.cameraAngle.${angle}`));
}

export function movementEventLabel(t: Translator, type: MovementEventType): string {
    return t(key(`screens.video.movementEvent.${type}`));
}

export function pipelineStageLabel(t: Translator, stage: PipelineStage): string {
    return t(key(`screens.video.stage.${stage}`));
}

export function findingImpactLabel(t: Translator, impact: FindingImpact): string {
    return t(key(`screens.shared.finding.impact.${impact}`));
}

export function reviewDecisionLabel(t: Translator, decision: ReviewDecision): string {
    return t(key(`screens.shared.finding.decision.${decision}`));
}

export function findingCategoryLabel(t: Translator, category: FindingCategory): string {
    return category === "movement_quality" ? t(key("screens.video.findingCategory.movement_quality")) : techniqueLabel(t, category);
}

export function movementReviewLabel(t: Translator, status: MovementEvidence["status"]): string {
    return t(key(`screens.video.movementReview.status.${status}`));
}

/** `formatReviewCounts` in the viewer's language: non-zero counts as unit-named parts, never summed. */
export function reviewCountParts(t: Translator, counts: Partial<ReviewCounts>): string[] {
    const parts: [number | undefined, string][] = [
        [counts.unreviewedFindings, "screens.video.reviewCount.unreviewedFindings"],
        [counts.lowConfidenceFindings, "screens.video.reviewCount.lowConfidenceFindings"],
        [counts.lowConfidenceDetections, "screens.video.reviewCount.lowConfidenceDetections"],
    ];
    return parts.flatMap(([count, k]) => (count ? [plural(t, key(k), count)] : []));
}

/** English technique labels a reviewer can pick, mapped to their technique (correction labels are stored in English). */
const LABEL_TECHNIQUE = new Map<string, Technique | StrikeType>([...TECHNIQUES, ...STRIKE_TYPES].map((technique) => [TECHNIQUE_LABELS[technique], technique]));

/** A stored label: translated when it is one of the app's own technique / category labels, otherwise as typed. */
export function storedLabel(t: Translator, label: string): string {
    if (label === FINDING_CATEGORY_LABELS.movement_quality) return t(key("screens.video.findingCategory.movement_quality"));
    const technique = LABEL_TECHNIQUE.get(label);
    return technique ? techniqueLabel(t, technique) : label;
}

/** A combination label as the pipeline writes it ("Jab – Cross – Hook"), each strike in the viewer's language. */
export function combinationLabel(t: Translator, label: string): string {
    return label
        .split(" – ")
        .map((part) => storedLabel(t, part))
        .join(" – ");
}

/** The label a human settled on, or the AI's label when unreviewed. */
export function reviewedStrike(t: Translator, detection: Pick<Detection, "type" | "review">): string {
    if (detection.review?.decision === "corrected" && detection.review.correctedLabel) return storedLabel(t, detection.review.correctedLabel);
    return techniqueLabel(t, detection.type);
}

/* ─── Sentences the worker-result mapping composes in English (API mode) ──────── */

const GUARD_DROP = /^(Right|Left) hand dropped below the chin after the (.+)$/;
const STRIKE_BY_LOWER = new Map<string, StrikeType>(STRIKE_TYPES.map((type) => [TECHNIQUE_LABELS[type].toLowerCase(), type]));

/** A movement event's detail. The pipeline writes a few fixed English sentences; demo data is already in Vietnamese. */
export function eventDetail(t: Translator, detail: string): string {
    if (detail === "Fighter not detected in frame") return t(key("screens.video.generated.fighterNotDetected"));
    const match = GUARD_DROP.exec(detail);
    const strike = match ? STRIKE_BY_LOWER.get(match[2]) : undefined;
    if (!match || !strike) return detail;
    return t(key(match[1] === "Right" ? "screens.video.generated.guardDropRight" : "screens.video.generated.guardDropLeft"), { strike: t(key(`screens.video.strikeInText.${strike}`)) });
}

const SUMMARY_STRIKES = /^The model detected (\d+) strike candidates \(([\d.]+) per minute\), including (\d+) combinations\. (.+)$/;
const SUMMARY_LOW = /^(\d+) detections fell below 60% confidence and are marked for coach review\.$/;
const SUMMARY_NOT_ELIGIBLE = "Evidence quality or calibrated detection confidence is insufficient; a coach must verify the events before using technique findings.";
const SUMMARY_NO_LOW = "Detections with confidence below 60% are marked for coach review.";
const SUMMARY_MOVEMENT = /^(.+)\. (\d+) footage windows; these are not repetitions or verified strikes\. A professional must interpret the video\. No technique score or clinical conclusion is generated\.$/;
const MOVEMENT_STATUS_BY_LABEL = new Map<string, MovementEvidence["status"]>(
    (Object.keys(MOVEMENT_REVIEW_LABELS) as MovementEvidence["status"][]).map((status) => [MOVEMENT_REVIEW_LABELS[status], status]),
);

/**
 * The analysis summary in the viewer's language. The pipeline composes it in English from counts
 * (`mapWorkerResult`); those sentences are recognised and rebuilt from the dictionary. Anything else
 * (demo data, a future worker wording) is shown as written.
 */
export function analysisSummary(t: Translator, summary: string): string {
    const movement = SUMMARY_MOVEMENT.exec(summary);
    const status = movement ? MOVEMENT_STATUS_BY_LABEL.get(movement[1]) : undefined;
    if (movement && status) return t(key("screens.video.generated.summaryMovement"), { status: movementReviewLabel(t, status), n: movement[2] });

    const strikes = SUMMARY_STRIKES.exec(summary);
    if (!strikes) return summary;
    const [, n, perMin, combinations, rest] = strikes;
    const low = SUMMARY_LOW.exec(rest);
    const tail =
        rest === SUMMARY_NOT_ELIGIBLE
            ? t(key("screens.video.generated.summaryNotEligible"))
            : rest === SUMMARY_NO_LOW
              ? t(key("screens.video.generated.summaryNoLow"))
              : low
                ? t(key("screens.video.generated.summaryLow"), { n: low[1] })
                : null;
    return tail === null ? summary : t(key("screens.video.generated.summaryStrikes"), { n, perMin, combinations, tail });
}

/** Splits a message around one `{name}` placeholder, so an element (a link, emphasis) can sit inside a translated sentence. */
export function splitPlaceholder(template: string, name: string): [string, string] {
    const placeholder = `{${name}}`;
    const at = template.indexOf(placeholder);
    return at < 0 ? [template, ""] : [template.slice(0, at), template.slice(at + placeholder.length)];
}
