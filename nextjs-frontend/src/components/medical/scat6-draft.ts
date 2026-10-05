import { SCAT6, type Scat6List } from "@/lib/domain/scat6";
import { academyWallClockToIso, isDateTimeInputValue } from "@/lib/format";

/**
 * The SCAT6 form's working state and how it becomes the record the medical service takes. Inputs keep what was typed
 * (numbers as text, times as academy wall-clock values) so nothing is guessed while the doctor fills the form; the
 * record leaves a blank number null and a blank time empty, and the schema then names the field to complete. Pure, so
 * it is tested on its own.
 */

/** One off-field section: performed with its answers, or not performed with the reason. */
export type SectionDraft<T> = { performed: boolean; reason: string } & T;

export interface StanceDraft {
    held: boolean;
    errors: string;
}

export interface StancesDraft {
    doubleLeg: StanceDraft;
    singleLeg: StanceDraft;
    tandem: StanceDraft;
}

export interface GcsDraft {
    assessedAt: string;
    eye: string;
    verbal: string;
    motor: string;
}

export interface DigitStringDraft {
    trial1: boolean | null;
    trial2: boolean | null;
}

export interface GaitTrialDraft {
    completed: boolean;
    timeSeconds: string;
}

export interface DualTrialDraft extends GaitTrialDraft {
    correct: boolean[];
    errors: string;
}

export interface Scat6Draft {
    status: "ADMINISTERED" | "NOT_ADMINISTERED";
    notAdministeredReason: string;
    administeredAt: string;
    examinerAttestation: boolean;
    athlete: {
        dominantHand: "" | "LEFT" | "RIGHT" | "AMBIDEXTROUS";
        sportTeamSchool: string;
        currentSchoolYear: string;
        yearsOfEducation: string;
        firstLanguage: string;
        preferredLanguage: string;
    };
    concussionHistory: { priorDiagnosedConcussions: string; mostRecentConcussion: string; primarySymptoms: string; mostRecentRecoveryDays: string };
    immediateAssessment: SectionDraft<{
        witnessed: boolean;
        observedOnVideo: boolean;
        signs: boolean[];
        gcs: GcsDraft[];
        neckPainAtRest: boolean;
        tendernessToPalpation: boolean;
        fullActiveRangeOfMotion: boolean;
        limbStrengthAndSensationNormal: boolean;
        fingerToNoseNormal: boolean;
        ocularMotorWithoutDoubleVision: boolean;
        extraocularMovementsNormal: boolean;
        extraocularDescription: string;
        maddocks: boolean[];
    }>;
    background: {
        hospitalisedForHeadInjury: boolean;
        headacheDisorderOrMigraine: boolean;
        learningDisabilityOrDyslexia: boolean;
        adhd: boolean;
        depressionAnxietyOrOtherPsychological: boolean;
        notes: string;
        currentMedications: string;
    };
    symptoms: SectionDraft<{ ratings: string[]; worseWithPhysicalActivity: boolean; worseWithMentalActivity: boolean; percentOfNormal: string; notNormalReason: string }>;
    orientation: SectionDraft<{ answers: boolean[] }>;
    immediateMemory: SectionDraft<{ wordList: Scat6List | ""; trials: boolean[][]; lastTrialCompletedAt: string }>;
    digitsBackward: SectionDraft<{ digitList: Scat6List | ""; strings: DigitStringDraft[] }>;
    monthsReverse: SectionDraft<{ correct: boolean[]; timeSeconds: string; errors: string }>;
    mbess: SectionDraft<{ footTested: "" | "LEFT" | "RIGHT"; testingSurface: string; footwear: string; firm: StancesDraft; foamPerformed: boolean; foam: StancesDraft }>;
    tandemGait: SectionDraft<{ trials: GaitTrialDraft[] }>;
    dualTaskGait: SectionDraft<{
        subtractionStep: string;
        practice: { correct: boolean[]; errors: string; timeSeconds: string };
        kind: "PRINTED" | "ALTERNATE";
        printed: DualTrialDraft[];
        alternate: { startingInteger: string; responses: string; completed: boolean; errors: string; timeSeconds: string };
    }>;
    gaitIncompleteReason: string;
    delayedRecall: SectionDraft<{ startedAt: string; words: boolean[] }>;
    differentFromUsualSelf: "" | "YES" | "NO" | "NOT_APPLICABLE";
    concussionDiagnosed: "" | "YES" | "NO" | "DEFERRED";
    clinicalNotes: string;
}

const flags = (length: number) => Array.from({ length }, () => false);
const stance = (): StanceDraft => ({ held: true, errors: "" });
const stances = (): StancesDraft => ({ doubleLeg: stance(), singleLeg: stance(), tandem: stance() });
const gaitTrial = (): GaitTrialDraft => ({ completed: true, timeSeconds: "" });

/** A blank form administered now: every section performed, nothing answered yet. */
export function emptyScat6Draft(now: string): Scat6Draft {
    const performed = { performed: true, reason: "" };
    return {
        status: "ADMINISTERED",
        notAdministeredReason: "",
        administeredAt: now,
        examinerAttestation: false,
        athlete: { dominantHand: "", sportTeamSchool: "", currentSchoolYear: "", yearsOfEducation: "", firstLanguage: "", preferredLanguage: "" },
        concussionHistory: { priorDiagnosedConcussions: "0", mostRecentConcussion: "", primarySymptoms: "", mostRecentRecoveryDays: "" },
        // Baseline doesn't call for the on-field screen, so it starts as not performed.
        immediateAssessment: {
            performed: false,
            reason: "Baseline assessment, no injury.",
            witnessed: false,
            observedOnVideo: false,
            signs: flags(SCAT6.OBSERVABLE_SIGNS),
            gcs: [{ assessedAt: now, eye: "", verbal: "", motor: "" }],
            neckPainAtRest: false,
            tendernessToPalpation: false,
            fullActiveRangeOfMotion: true,
            limbStrengthAndSensationNormal: true,
            fingerToNoseNormal: true,
            ocularMotorWithoutDoubleVision: true,
            extraocularMovementsNormal: true,
            extraocularDescription: "",
            maddocks: flags(SCAT6.MADDOCKS_QUESTIONS),
        },
        background: {
            hospitalisedForHeadInjury: false,
            headacheDisorderOrMigraine: false,
            learningDisabilityOrDyslexia: false,
            adhd: false,
            depressionAnxietyOrOtherPsychological: false,
            notes: "",
            currentMedications: "",
        },
        symptoms: { ...performed, ratings: Array.from({ length: SCAT6.SYMPTOMS }, () => "0"), worseWithPhysicalActivity: false, worseWithMentalActivity: false, percentOfNormal: "100", notNormalReason: "" },
        orientation: { ...performed, answers: flags(SCAT6.ORIENTATION_QUESTIONS) },
        immediateMemory: { ...performed, wordList: "", trials: Array.from({ length: SCAT6.MEMORY_TRIALS }, () => flags(SCAT6.WORDS_PER_LIST)), lastTrialCompletedAt: now },
        digitsBackward: { ...performed, digitList: "", strings: [{ trial1: null, trial2: null }] },
        monthsReverse: { ...performed, correct: flags(SCAT6.MONTHS), timeSeconds: "", errors: "" },
        mbess: { ...performed, footTested: "", testingSurface: "", footwear: "", firm: stances(), foamPerformed: false, foam: stances() },
        tandemGait: { ...performed, trials: Array.from({ length: SCAT6.GAIT_TRIALS }, gaitTrial) },
        dualTaskGait: {
            performed: false,
            reason: "Not done at this baseline.",
            subtractionStep: String(SCAT6.DUAL_TASK_STEP),
            practice: { correct: flags(SCAT6.DUAL_TASK_PRACTICE_RESPONSES), errors: "", timeSeconds: "" },
            kind: "PRINTED",
            printed: Array.from({ length: SCAT6.GAIT_TRIALS }, () => ({ ...gaitTrial(), correct: flags(SCAT6.DUAL_TASK_TRIAL_RESPONSES), errors: "" })),
            alternate: { startingInteger: "", responses: "", completed: true, errors: "", timeSeconds: "" },
        },
        gaitIncompleteReason: "",
        delayedRecall: { ...performed, startedAt: now, words: flags(SCAT6.WORDS_PER_LIST) },
        differentFromUsualSelf: "",
        concussionDiagnosed: "",
        clinicalNotes: "",
    };
}

/* ─── Draft → record ──────────────────────────────────────────────────────── */

/** A typed number, or null when blank (the schema asks for it); anything unreadable stays NaN and is refused the same way. */
const num = (value: string): number | null => (value.trim() === "" ? null : Number(value));
const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());
/** An academy wall-clock time as an instant, or "" when it isn't complete yet. */
const instant = (value: string): string => (isDateTimeInputValue(value) ? academyWallClockToIso(...(value.split("T") as [string, string])) : "");

function section<T extends object>(draft: { performed: boolean; reason: string }, answers: () => T) {
    return draft.performed ? { performed: true as const, ...answers() } : { performed: false as const, reason: draft.reason.trim() };
}

const stanceRecord = (draft: StanceDraft) => (draft.held ? { unableToHoldFiveSeconds: false as const, errors: num(draft.errors) } : { unableToHoldFiveSeconds: true as const });
const stancesRecord = (draft: StancesDraft) => ({ doubleLeg: stanceRecord(draft.doubleLeg), singleLeg: stanceRecord(draft.singleLeg), tandem: stanceRecord(draft.tandem) });
const gaitRecord = (draft: GaitTrialDraft) => (draft.completed ? { completed: true as const, timeSeconds: num(draft.timeSeconds) } : { completed: false as const });

/**
 * The record as the service takes it. Answers the form keeps but the chosen path doesn't use (a GCS row in an
 * unperformed screen, trial 2 after a correct trial 1, digit lengths after the test ended) are left out.
 */
export function scat6FromDraft(draft: Scat6Draft): unknown {
    if (draft.status === "NOT_ADMINISTERED") return { status: "NOT_ADMINISTERED", formVersion: SCAT6.FORM_VERSION, reason: draft.notAdministeredReason.trim() };
    const ia = draft.immediateAssessment;
    const dual = draft.dualTaskGait;
    const noNeckFindings = !ia.neckPainAtRest && !ia.tendernessToPalpation;
    return {
        status: "ADMINISTERED",
        formVersion: SCAT6.FORM_VERSION,
        administeredAt: instant(draft.administeredAt),
        examinerAttestation: draft.examinerAttestation,
        athlete: {
            dominantHand: draft.athlete.dominantHand || null,
            sportTeamSchool: textOrNull(draft.athlete.sportTeamSchool),
            currentSchoolYear: textOrNull(draft.athlete.currentSchoolYear),
            yearsOfEducation: num(draft.athlete.yearsOfEducation),
            firstLanguage: textOrNull(draft.athlete.firstLanguage),
            preferredLanguage: textOrNull(draft.athlete.preferredLanguage),
        },
        concussionHistory: {
            priorDiagnosedConcussions: num(draft.concussionHistory.priorDiagnosedConcussions),
            mostRecentConcussion: textOrNull(draft.concussionHistory.mostRecentConcussion),
            primarySymptoms: textOrNull(draft.concussionHistory.primarySymptoms),
            mostRecentRecoveryDays: num(draft.concussionHistory.mostRecentRecoveryDays),
        },
        immediateAssessment: section(ia, () => ({
            observableSigns: { witnessed: ia.witnessed, observedOnVideo: ia.observedOnVideo, signs: ia.signs },
            glasgowComaScale: ia.gcs.map((row) => ({ assessedAt: instant(row.assessedAt), eye: num(row.eye), verbal: num(row.verbal), motor: num(row.motor) })),
            cervicalSpine: {
                neckPainAtRest: ia.neckPainAtRest,
                tendernessToPalpation: ia.tendernessToPalpation,
                fullActiveRangeOfMotion: noNeckFindings ? ia.fullActiveRangeOfMotion : null,
                limbStrengthAndSensationNormal: ia.limbStrengthAndSensationNormal,
            },
            coordinationOcularMotor: {
                fingerToNoseNormal: ia.fingerToNoseNormal,
                ocularMotorWithoutDoubleVision: ia.ocularMotorWithoutDoubleVision,
                extraocularMovementsNormal: ia.extraocularMovementsNormal,
                extraocularDescription: ia.extraocularMovementsNormal ? null : textOrNull(ia.extraocularDescription),
            },
            maddocks: ia.maddocks,
        })),
        background: { ...draft.background, notes: textOrNull(draft.background.notes), currentMedications: textOrNull(draft.background.currentMedications) },
        symptoms: section(draft.symptoms, () => ({
            ratings: draft.symptoms.ratings.map(num),
            worseWithPhysicalActivity: draft.symptoms.worseWithPhysicalActivity,
            worseWithMentalActivity: draft.symptoms.worseWithMentalActivity,
            percentOfNormal: num(draft.symptoms.percentOfNormal),
            notNormalReason: textOrNull(draft.symptoms.notNormalReason),
        })),
        orientation: section(draft.orientation, () => ({ answers: draft.orientation.answers })),
        immediateMemory: section(draft.immediateMemory, () => ({
            wordList: draft.immediateMemory.wordList || null,
            trials: draft.immediateMemory.trials,
            lastTrialCompletedAt: instant(draft.immediateMemory.lastTrialCompletedAt),
        })),
        digitsBackward: section(draft.digitsBackward, () => ({
            digitList: draft.digitsBackward.digitList || null,
            strings: digitStrings(draft.digitsBackward.strings),
        })),
        monthsReverse: section(draft.monthsReverse, () => ({
            correctResponses: draft.monthsReverse.correct,
            timeSeconds: num(draft.monthsReverse.timeSeconds),
            errors: num(draft.monthsReverse.errors),
        })),
        mbess: section(draft.mbess, () => ({
            footTested: draft.mbess.footTested || null,
            testingSurface: draft.mbess.testingSurface.trim(),
            footwear: draft.mbess.footwear.trim(),
            firm: stancesRecord(draft.mbess.firm),
            foam: draft.mbess.foamPerformed ? { performed: true, stances: stancesRecord(draft.mbess.foam) } : { performed: false },
        })),
        tandemGait: section(draft.tandemGait, () => ({ trials: draft.tandemGait.trials.map(gaitRecord) })),
        dualTaskGait: section(dual, () => ({
            subtractionStep: num(dual.subtractionStep),
            practice: { correctResponses: dual.practice.correct, errors: num(dual.practice.errors), timeSeconds: num(dual.practice.timeSeconds) },
            sequence:
                dual.kind === "PRINTED"
                    ? {
                          kind: "PRINTED",
                          trials: dual.printed.map((trial) =>
                              trial.completed
                                  ? { completed: true, correctResponses: trial.correct, errors: num(trial.errors), timeSeconds: num(trial.timeSeconds) }
                                  : { completed: false, correctResponses: trial.correct.some(Boolean) ? trial.correct : null },
                          ),
                      }
                    : {
                          kind: "ALTERNATE",
                          startingInteger: num(dual.alternate.startingInteger),
                          responses: alternateResponses(dual.alternate.responses),
                          trial: dual.alternate.completed ? { completed: true, errors: num(dual.alternate.errors), timeSeconds: num(dual.alternate.timeSeconds) } : { completed: false },
                      },
        })),
        gaitIncompleteReason: anyGaitTrialIncomplete(draft) ? textOrNull(draft.gaitIncompleteReason) : null,
        delayedRecall: section(draft.delayedRecall, () => ({ startedAt: instant(draft.delayedRecall.startedAt), words: draft.delayedRecall.words })),
        differentFromUsualSelf: draft.differentFromUsualSelf || null,
        concussionDiagnosed: draft.concussionDiagnosed || null,
        clinicalNotes: textOrNull(draft.clinicalNotes),
    };
}

/** Lengths up to the one where both trials were wrong; trial 2 only after a wrong trial 1. An unanswered trial stays null for the schema to flag. */
function digitStrings(strings: DigitStringDraft[]) {
    const given: { trial1Correct: boolean | null; trial2Correct: boolean | null }[] = [];
    for (const entry of strings) {
        given.push({ trial1Correct: entry.trial1, trial2Correct: entry.trial1 === false ? entry.trial2 : null });
        if (entry.trial1 === false && entry.trial2 === false) break;
    }
    return given;
}

/** The numbers said on the alternate row, typed as a list ("93, 86, 79"). */
function alternateResponses(value: string): number[] {
    return value
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number);
}

/** Whether the digit test still needs another length: the last one has an answer and didn't end the test. */
export function digitTestContinues(strings: DigitStringDraft[]): boolean {
    const last = strings.at(-1);
    if (!last || strings.length >= SCAT6.DIGIT_STRING_LENGTHS) return false;
    if (last.trial1 === true) return true;
    return last.trial1 === false && last.trial2 === true;
}

/** Whether any gait trial the record would include stopped early, so the reason field applies. */
export function anyGaitTrialIncomplete(draft: Scat6Draft): boolean {
    const tandem = draft.tandemGait.performed ? draft.tandemGait.trials : [];
    const dual = draft.dualTaskGait.performed ? (draft.dualTaskGait.kind === "PRINTED" ? draft.dualTaskGait.printed : [draft.dualTaskGait.alternate]) : [];
    return [...tandem, ...dual].some((trial) => !trial.completed);
}
