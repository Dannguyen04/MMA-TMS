import { friendlyScat6Issues } from "@/lib/domain/medical-scat6";
import { SCAT6, scat6InputSchema, type Scat6List } from "@/lib/domain/scat6";
import { academyWallClockToIso, isDateTimeInputValue, toDateTimeInputValue } from "@/lib/format";

/**
 * The SCAT6 form's working state and how it becomes the record the medical service takes. Inputs keep what was typed
 * (numbers as text, times as academy wall-clock values, yes/no as null until answered) so nothing is guessed while the
 * doctor fills the form: no rating starts at 0, no finding starts as normal, no time starts as "now" and no part
 * starts as skipped. The record leaves an unanswered item null or blank and the schema then names it. The quick fills
 * are explicit doctor actions: each fills only what is still blank and says what it filled. Pure, so it is tested on
 * its own.
 */

/** An answer to a yes/no item; null until the doctor answers it. */
export type YesNo = boolean | null;

/** One off-field part: performed with its answers, or not performed with the reason. */
export type SectionDraft<T> = { performed: boolean; reason: string } & T;

/** A part a baseline may skip: null until the doctor says whether it was performed. */
export type OptionalSectionDraft<T> = { performed: boolean | null; reason: string } & T;

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
    trial1: YesNo;
    trial2: YesNo;
}

export interface GaitTrialDraft {
    completed: boolean;
    timeSeconds: string;
}

export interface DualTrialDraft extends GaitTrialDraft {
    correct: boolean[];
    errors: string;
}

export const BACKGROUND_CONDITIONS = [
    ["hospitalisedForHeadInjury", "Hospitalised for a head injury"],
    ["headacheDisorderOrMigraine", "Headache disorder or migraine"],
    ["learningDisabilityOrDyslexia", "Learning disability or dyslexia"],
    ["adhd", "ADHD"],
    ["depressionAnxietyOrOtherPsychological", "Depression, anxiety or other psychological disorder"],
] as const;

export type BackgroundCondition = (typeof BACKGROUND_CONDITIONS)[number][0];

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
    immediateAssessment: OptionalSectionDraft<{
        witnessed: YesNo;
        observedOnVideo: YesNo;
        signs: boolean[];
        gcs: GcsDraft[];
        neckPainAtRest: YesNo;
        tendernessToPalpation: YesNo;
        fullActiveRangeOfMotion: YesNo;
        limbStrengthAndSensationNormal: YesNo;
        fingerToNoseNormal: YesNo;
        ocularMotorWithoutDoubleVision: YesNo;
        extraocularMovementsNormal: YesNo;
        extraocularDescription: string;
        maddocks: boolean[];
    }>;
    background: Record<BackgroundCondition, YesNo> & { notes: string; currentMedications: string };
    symptoms: SectionDraft<{ ratings: string[]; worseWithPhysicalActivity: YesNo; worseWithMentalActivity: YesNo; percentOfNormal: string; notNormalReason: string }>;
    orientation: SectionDraft<{ answers: boolean[] }>;
    immediateMemory: SectionDraft<{ wordList: Scat6List | ""; trials: boolean[][]; lastTrialCompletedAt: string }>;
    digitsBackward: SectionDraft<{ digitList: Scat6List | ""; strings: DigitStringDraft[] }>;
    monthsReverse: SectionDraft<{ correct: boolean[]; timeSeconds: string; errors: string }>;
    mbess: SectionDraft<{ footTested: "" | "LEFT" | "RIGHT"; testingSurface: string; footwear: string; firm: StancesDraft; foamPerformed: boolean; foam: StancesDraft }>;
    tandemGait: SectionDraft<{ trials: GaitTrialDraft[] }>;
    dualTaskGait: OptionalSectionDraft<{
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
    /**
     * Rows of tick boxes (signs, answers, words) the doctor has marked, by record path. A row nobody touched isn't read
     * as "none ticked": the doctor ticks items, or chooses all or none.
     */
    marked: Record<string, true>;
}

const flags = (length: number) => Array.from({ length }, () => false);
const stance = (): StanceDraft => ({ held: true, errors: "" });
const stances = (): StancesDraft => ({ doubleLeg: stance(), singleLeg: stance(), tandem: stance() });
const gaitTrial = (): GaitTrialDraft => ({ completed: true, timeSeconds: "" });

/** The reasons the quick fills write for the parts a healthy baseline usually skips. */
export const BASELINE_SKIP_REASONS = {
    immediateAssessment: "Baseline assessment, no injury.",
    dualTaskGait: "Not done at this baseline.",
} as const;

/**
 * A blank form administered at `now` (the only time filled in: when the SCAT6 starts). Every off-field part is
 * performed with nothing answered; the immediate assessment and dual-task gait wait for the doctor to say whether they
 * were performed.
 */
export function emptyScat6Draft(now: string): Scat6Draft {
    const performed = { performed: true, reason: "" };
    const unanswered = { performed: null, reason: "" };
    return {
        status: "ADMINISTERED",
        notAdministeredReason: "",
        administeredAt: now,
        examinerAttestation: false,
        athlete: { dominantHand: "", sportTeamSchool: "", currentSchoolYear: "", yearsOfEducation: "", firstLanguage: "", preferredLanguage: "" },
        concussionHistory: { priorDiagnosedConcussions: "", mostRecentConcussion: "", primarySymptoms: "", mostRecentRecoveryDays: "" },
        immediateAssessment: {
            ...unanswered,
            witnessed: null,
            observedOnVideo: null,
            signs: flags(SCAT6.OBSERVABLE_SIGNS),
            gcs: [{ assessedAt: "", eye: "", verbal: "", motor: "" }],
            neckPainAtRest: null,
            tendernessToPalpation: null,
            fullActiveRangeOfMotion: null,
            limbStrengthAndSensationNormal: null,
            fingerToNoseNormal: null,
            ocularMotorWithoutDoubleVision: null,
            extraocularMovementsNormal: null,
            extraocularDescription: "",
            maddocks: flags(SCAT6.MADDOCKS_QUESTIONS),
        },
        background: {
            hospitalisedForHeadInjury: null,
            headacheDisorderOrMigraine: null,
            learningDisabilityOrDyslexia: null,
            adhd: null,
            depressionAnxietyOrOtherPsychological: null,
            notes: "",
            currentMedications: "",
        },
        symptoms: { ...performed, ratings: Array.from({ length: SCAT6.SYMPTOMS }, () => ""), worseWithPhysicalActivity: null, worseWithMentalActivity: null, percentOfNormal: "", notNormalReason: "" },
        orientation: { ...performed, answers: flags(SCAT6.ORIENTATION_QUESTIONS) },
        immediateMemory: { ...performed, wordList: "", trials: Array.from({ length: SCAT6.MEMORY_TRIALS }, () => flags(SCAT6.WORDS_PER_LIST)), lastTrialCompletedAt: "" },
        digitsBackward: { ...performed, digitList: "", strings: [{ trial1: null, trial2: null }] },
        monthsReverse: { ...performed, correct: flags(SCAT6.MONTHS), timeSeconds: "", errors: "" },
        mbess: { ...performed, footTested: "", testingSurface: "", footwear: "", firm: stances(), foamPerformed: false, foam: stances() },
        tandemGait: { ...performed, trials: Array.from({ length: SCAT6.GAIT_TRIALS }, gaitTrial) },
        dualTaskGait: {
            ...unanswered,
            subtractionStep: String(SCAT6.DUAL_TASK_STEP),
            practice: { correct: flags(SCAT6.DUAL_TASK_PRACTICE_RESPONSES), errors: "", timeSeconds: "" },
            kind: "PRINTED",
            printed: Array.from({ length: SCAT6.GAIT_TRIALS }, () => ({ ...gaitTrial(), correct: flags(SCAT6.DUAL_TASK_TRIAL_RESPONSES), errors: "" })),
            alternate: { startingInteger: "", responses: "", completed: true, errors: "", timeSeconds: "" },
        },
        gaitIncompleteReason: "",
        delayedRecall: { ...performed, startedAt: "", words: flags(SCAT6.WORDS_PER_LIST) },
        differentFromUsualSelf: "",
        concussionDiagnosed: "",
        clinicalNotes: "",
        marked: {},
    };
}

/* ─── Draft → record ──────────────────────────────────────────────────────── */

/** A typed number, or null when blank (the schema asks for it); anything unreadable stays NaN and is refused the same way. */
const num = (value: string): number | null => (value.trim() === "" ? null : Number(value));
const textOrNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());
/** An academy wall-clock time as an instant, or "" when it isn't complete yet. */
const instant = (value: string): string => (isDateTimeInputValue(value) ? academyWallClockToIso(...(value.split("T") as [string, string])) : "");

/** Performed with its answers, not performed with the reason, or (still unanswered) `performed: null` for the schema to name. */
function section<T extends object>(draft: { performed: boolean | null; reason: string }, answers: () => T) {
    if (draft.performed === null) return { performed: null };
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
    const noNeckFindings = ia.neckPainAtRest === false && ia.tendernessToPalpation === false;
    const { notes, currentMedications, ...conditions } = draft.background;
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
                extraocularDescription: ia.extraocularMovementsNormal === false ? textOrNull(ia.extraocularDescription) : null,
            },
            maddocks: ia.maddocks,
        })),
        background: { ...conditions, notes: textOrNull(notes), currentMedications: textOrNull(currentMedications) },
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
    const dual = draft.dualTaskGait.performed === true ? (draft.dualTaskGait.kind === "PRINTED" ? draft.dualTaskGait.printed : [draft.dualTaskGait.alternate]) : [];
    return [...tandem, ...dual].some((trial) => !trial.completed);
}

/* ─── Rows of tick boxes ──────────────────────────────────────────────────── */

export interface ToggleRow {
    /** The record path, e.g. "orientation.answers". */
    path: string;
    /** What a tick means, for messages: "the answers given correctly". */
    what: string;
    /** The label of the "none" choice, e.g. "None correct". */
    none: string;
    /** The label of the "all" quick fill, e.g. "All correct". */
    all: string;
}

const row = (path: string, what: string, none: string, all: string): ToggleRow => ({ path, what, none, all });

/** The tick rows the record will include, so each must be marked. Rows of a part that isn't performed don't count. */
export function toggleRows(draft: Scat6Draft): ToggleRow[] {
    if (draft.status !== "ADMINISTERED") return [];
    const rows: ToggleRow[] = [];
    if (draft.immediateAssessment.performed === true) {
        rows.push(row("immediateAssessment.observableSigns.signs", "the observable signs present", "None present", "All present"));
        rows.push(row("immediateAssessment.maddocks", "the Maddocks questions answered correctly", "None correct", "All correct"));
    }
    if (draft.orientation.performed) rows.push(row("orientation.answers", "the orientation answers given correctly", "None correct", "All correct"));
    if (draft.immediateMemory.performed) {
        draft.immediateMemory.trials.forEach((_, index) => rows.push(row(`immediateMemory.trials.${index}`, `the words recalled in trial ${index + 1}`, "None recalled", "All words recalled")));
    }
    if (draft.monthsReverse.performed) rows.push(row("monthsReverse.correctResponses", "the months given correctly", "None correct", "All correct"));
    const dual = draft.dualTaskGait;
    if (dual.performed === true) {
        rows.push(row("dualTaskGait.practice.correctResponses", "the practice answers given correctly", "None correct", "All correct"));
        if (dual.kind === "PRINTED") {
            dual.printed.forEach((trial, index) => {
                if (trial.completed) rows.push(row(`dualTaskGait.sequence.trials.${index}.correctResponses`, `the correct answers in trial ${index + 1}`, "None correct", "All correct"));
            });
        }
    }
    if (draft.delayedRecall.performed) rows.push(row("delayedRecall.words", "the words recalled after the delay", "None recalled", "All words recalled"));
    return rows;
}

/** The boolean array behind a tick row, in the draft (the record names some rows differently). */
export function toggleValues(draft: Scat6Draft, path: string): boolean[] | null {
    const ia = draft.immediateAssessment;
    const dual = draft.dualTaskGait;
    const trial = /^immediateMemory\.trials\.(\d)$/.exec(path);
    if (trial) return draft.immediateMemory.trials[Number(trial[1])] ?? null;
    const printed = /^dualTaskGait\.sequence\.trials\.(\d)\.correctResponses$/.exec(path);
    if (printed) return dual.printed[Number(printed[1])]?.correct ?? null;
    const rows: Record<string, boolean[]> = {
        "immediateAssessment.observableSigns.signs": ia.signs,
        "immediateAssessment.maddocks": ia.maddocks,
        "orientation.answers": draft.orientation.answers,
        "monthsReverse.correctResponses": draft.monthsReverse.correct,
        "dualTaskGait.practice.correctResponses": dual.practice.correct,
        "delayedRecall.words": draft.delayedRecall.words,
    };
    return rows[path] ?? null;
}

/* ─── Quick fills (explicit doctor actions) ───────────────────────────────── */

/** What a quick fill changed, in words for the doctor; null when there was nothing left to fill. */
export interface QuickFillResult {
    draft: Scat6Draft;
    filled: string;
}

const copy = (draft: Scat6Draft): Scat6Draft => structuredClone(draft);
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Whether "No symptoms" applies: no rating above 0 yet, and something is still blank. */
export function canFillNoSymptoms(draft: Scat6Draft): boolean {
    const { ratings, worseWithPhysicalActivity, worseWithMentalActivity } = draft.symptoms;
    const anyRated = ratings.some((rating) => rating.trim() !== "" && Number(rating) > 0);
    const anyBlank = ratings.some((rating) => rating.trim() === "") || worseWithPhysicalActivity === null || worseWithMentalActivity === null;
    return draft.symptoms.performed && !anyRated && anyBlank;
}

/** "No symptoms": every blank rating becomes 0 and both "worse with activity" questions No. Percent of normal is still asked. */
export function fillNoSymptoms(draft: Scat6Draft): QuickFillResult | null {
    if (!canFillNoSymptoms(draft)) return null;
    const next = copy(draft);
    const blank = next.symptoms.ratings.filter((rating) => rating.trim() === "").length;
    next.symptoms.ratings = next.symptoms.ratings.map((rating) => (rating.trim() === "" ? "0" : rating));
    const worse = [next.symptoms.worseWithPhysicalActivity, next.symptoms.worseWithMentalActivity].filter((answer) => answer === null).length;
    next.symptoms.worseWithPhysicalActivity ??= false;
    next.symptoms.worseWithMentalActivity ??= false;
    const parts = [blank > 0 ? `${plural(blank, "rating")} set to 0` : null, worse > 0 ? `“worse with activity” set to No` : null].filter(Boolean);
    return { draft: next, filled: `${parts.join(", ")}. Percent of normal is still yours to ask.` };
}

/** Whether "None apply" applies: no condition answered Yes, and some still blank. */
export function canFillNoBackground(draft: Scat6Draft): boolean {
    const answers = BACKGROUND_CONDITIONS.map(([key]) => draft.background[key]);
    return !answers.includes(true) && answers.includes(null);
}

/** "None apply": every unanswered background condition becomes No. */
export function fillNoBackground(draft: Scat6Draft): QuickFillResult | null {
    if (!canFillNoBackground(draft)) return null;
    const next = copy(draft);
    const filled = BACKGROUND_CONDITIONS.filter(([key]) => next.background[key] === null);
    for (const [key] of filled) next.background[key] = false;
    return { draft: next, filled: `${plural(filled.length, "condition")} set to No: ${filled.map(([, label]) => label.toLowerCase()).join(", ")}.` };
}

/** Ticks every item of an unmarked row (or none of them) and marks the row. A marked row is never changed. */
export function fillToggleRow(draft: Scat6Draft, path: string, value: boolean): QuickFillResult | null {
    if (draft.marked[path]) return null;
    const next = copy(draft);
    const values = toggleValues(next, path);
    if (!values) return null;
    values.fill(value);
    next.marked[path] = true;
    const rule = toggleRows(draft).find((candidate) => candidate.path === path);
    return { draft: next, filled: value ? `${values.length} of ${values.length} ticked.` : `${rule?.none ?? "None"}: 0 of ${values.length} ticked.` };
}

/** Ticks or unticks one item, which marks its row. */
export function toggleItem(draft: Scat6Draft, path: string, index: number, value: boolean): Scat6Draft {
    const next = copy(draft);
    const values = toggleValues(next, path);
    if (values && index >= 0 && index < values.length) values[index] = value;
    next.marked[path] = true;
    return next;
}

type StampField = "immediateMemory.lastTrialCompletedAt" | "delayedRecall.startedAt" | "administeredAt";

/** "Stamp now": the current academy time in a time that is still blank. A time already entered is never replaced. */
export function stampNow(draft: Scat6Draft, field: StampField, now: Date | string): QuickFillResult | null {
    const value = toDateTimeInputValue(now);
    const next = copy(draft);
    if (field === "immediateMemory.lastTrialCompletedAt") {
        if (next.immediateMemory.lastTrialCompletedAt) return null;
        next.immediateMemory.lastTrialCompletedAt = value;
    } else if (field === "delayedRecall.startedAt") {
        if (next.delayedRecall.startedAt) return null;
        next.delayedRecall.startedAt = value;
    } else {
        if (next.administeredAt) return null;
        next.administeredAt = value;
    }
    return { draft: next, filled: `Stamped ${value.slice(11)}.` };
}

/** Records a part a baseline usually skips as not performed, with the usual reason when none was written. */
export function skipPart(draft: Scat6Draft, part: keyof typeof BASELINE_SKIP_REASONS): QuickFillResult | null {
    if (draft[part].performed !== null) return null;
    const next = copy(draft);
    next[part].performed = false;
    if (!next[part].reason.trim()) next[part].reason = BASELINE_SKIP_REASONS[part];
    return { draft: next, filled: `Recorded as not performed: “${next[part].reason}”` };
}

/* ─── Timing ──────────────────────────────────────────────────────────────── */

/** The earliest academy time delayed recall may start (5 minutes after the last memory trial), or null until that time is known. */
export function delayedRecallEarliest(draft: Scat6Draft): string | null {
    const last = instant(draft.immediateMemory.lastTrialCompletedAt);
    if (!last) return null;
    return toDateTimeInputValue(new Date(Date.parse(last) + SCAT6.DELAYED_RECALL_MIN_DELAY_MS));
}

/* ─── Problems before sending ─────────────────────────────────────────────── */

/** The three SCAT6 steps of the examination form, in order. */
export type Scat6Step = "history" | "memory" | "balance";

const STEP_OF_PART: Record<string, Scat6Step> = {
    status: "history",
    reason: "history",
    formVersion: "history",
    administeredAt: "history",
    examinerAttestation: "history",
    athlete: "history",
    concussionHistory: "history",
    immediateAssessment: "history",
    background: "history",
    symptoms: "history",
    orientation: "memory",
    immediateMemory: "memory",
    digitsBackward: "memory",
    monthsReverse: "memory",
    mbess: "balance",
    tandemGait: "balance",
    dualTaskGait: "balance",
    gaitIncompleteReason: "balance",
    delayedRecall: "balance",
    differentFromUsualSelf: "balance",
    concussionDiagnosed: "balance",
    clinicalNotes: "balance",
};

const PART_LABELS: Record<string, string> = {
    reason: "SCAT6",
    administeredAt: "SCAT6",
    examinerAttestation: "SCAT6",
    athlete: "Athlete background",
    concussionHistory: "Athlete background",
    immediateAssessment: "Immediate assessment",
    background: "Medical background",
    symptoms: "Symptom evaluation",
    orientation: "Orientation",
    immediateMemory: "Immediate memory",
    digitsBackward: "Digits backward",
    monthsReverse: "Months in reverse",
    mbess: "mBESS",
    tandemGait: "Tandem gait",
    dualTaskGait: "Dual-task gait",
    gaitIncompleteReason: "Gait",
    delayedRecall: "Delayed recall",
    differentFromUsualSelf: "SCAT6 decision",
};

/** A problem with the part it's in, for a sentence that stands on its own: "Medical background: answer yes or no." */
export function problemSentence(problem: Scat6Problem): string {
    const part = PART_LABELS[problem.path.split(".")[0]];
    return part ? `${part}: ${problem.message.charAt(0).toLowerCase()}${problem.message.slice(1)}` : problem.message;
}

/** The step a record path belongs to; anything unknown stays with the first SCAT6 step. */
export function scat6StepOf(path: string): Scat6Step {
    return STEP_OF_PART[path.split(".")[0]] ?? "history";
}

export interface Scat6Problem {
    /** The record path, e.g. "symptoms.ratings.3" or "orientation.answers". */
    path: string;
    message: string;
    step: Scat6Step;
}

/**
 * What still needs the doctor before the SCAT6 can be sent: the schema's issues (the same rules the service applies,
 * including the 5-minute delay and times in the future) in plain words, and tick rows nobody marked yet.
 */
export function scat6Problems(draft: Scat6Draft): Scat6Problem[] {
    const parsed = scat6InputSchema.safeParse(scat6FromDraft(draft));
    const issues = parsed.success ? [] : friendlyScat6Issues(parsed.error.issues);
    const problems = issues.map((issue): Scat6Problem => {
        const path = issue.path.join(".");
        return { path, message: issue.message, step: scat6StepOf(path) };
    });
    const seen = new Set(problems.map((problem) => problem.path));
    for (const unmarked of toggleRows(draft).filter((candidate) => !draft.marked[candidate.path])) {
        if (seen.has(unmarked.path)) continue;
        problems.push({ path: unmarked.path, message: `Tick ${unmarked.what}, or choose “${unmarked.none}”.`, step: scat6StepOf(unmarked.path) });
    }
    return problems;
}

/* ─── Review ──────────────────────────────────────────────────────────────── */

export interface Scat6ReviewLine {
    label: string;
    value: string;
    step: Scat6Step;
}

const HANDS: Record<string, string> = { LEFT: "Left", RIGHT: "Right", AMBIDEXTROUS: "Ambidextrous" };
const ANSWERS: Record<string, string> = { YES: "Yes", NO: "No", NOT_APPLICABLE: "Not applicable", DEFERRED: "Deferred" };
const blankAs = (value: string, fallback = "Not entered") => (value.trim() ? value.trim() : fallback);
const clock = (value: string) => (isDateTimeInputValue(value) ? value.slice(11) : "not entered");
const ticks = (draft: Scat6Draft, path: string) => {
    const values = toggleValues(draft, path) ?? [];
    return draft.marked[path] ? `${values.filter(Boolean).length} of ${values.length} ticked` : "not marked";
};

/**
 * What the doctor entered, part by part, for the review step: raw answers only. Scores are the medical service's to
 * compute, so none is worked out here.
 */
export function scat6ReviewLines(draft: Scat6Draft): Scat6ReviewLine[] {
    if (draft.status === "NOT_ADMINISTERED") return [{ label: "SCAT6", value: `Not administered: ${blankAs(draft.notAdministeredReason, "no reason yet")}`, step: "history" }];
    const notPerformed = (part: { performed: boolean | null; reason: string }, performed: () => string) =>
        part.performed === null ? "Not answered yet" : part.performed ? performed() : `Not performed: ${blankAs(part.reason, "no reason yet")}`;
    const ratings = draft.symptoms.ratings;
    const rated = ratings.filter((rating) => rating.trim() !== "");
    const aboveZero = ratings.flatMap((rating, index) => (rating.trim() !== "" && Number(rating) > 0 ? [`item ${index + 1}: ${rating}`] : []));
    const conditions = BACKGROUND_CONDITIONS.map(([key, label]) => ({ label, answer: draft.background[key] }));
    const yes = conditions.filter((condition) => condition.answer === true).map((condition) => condition.label);
    const unanswered = conditions.filter((condition) => condition.answer === null).length;
    const memory = draft.immediateMemory;
    const stancesLine = (stances: StancesDraft) => [stances.doubleLeg, stances.singleLeg, stances.tandem].map((stance) => (stance.held ? blankAs(stance.errors, "–") : "not held")).join(", ");
    return [
        { label: "Started", value: clock(draft.administeredAt), step: "history" },
        { label: "Dominant hand", value: HANDS[draft.athlete.dominantHand] ?? "Not entered", step: "history" },
        { label: "Earlier concussions", value: blankAs(draft.concussionHistory.priorDiagnosedConcussions), step: "history" },
        { label: "Immediate assessment", value: notPerformed(draft.immediateAssessment, () => "Performed"), step: "history" },
        { label: "Medical background", value: yes.length > 0 ? `Yes: ${yes.join(", ")}` : unanswered > 0 ? `${unanswered} not answered` : "No to all", step: "history" },
        {
            label: "Symptoms",
            value: notPerformed(draft.symptoms, () =>
                [
                    `${rated.length} of ${ratings.length} rated`,
                    aboveZero.length > 0 ? `above 0: ${aboveZero.join(", ")}` : rated.length > 0 ? "none above 0" : null,
                    `percent of normal ${draft.symptoms.percentOfNormal.trim() ? `${draft.symptoms.percentOfNormal.trim()}%` : "not entered"}`,
                ]
                    .filter(Boolean)
                    .join(" · "),
            ),
            step: "history",
        },
        { label: "Orientation", value: notPerformed(draft.orientation, () => ticks(draft, "orientation.answers")), step: "memory" },
        {
            label: "Immediate memory",
            value: notPerformed(memory, () => [`List ${memory.wordList || "not chosen"}`, ...memory.trials.map((_, index) => `trial ${index + 1}: ${ticks(draft, `immediateMemory.trials.${index}`)}`), `last trial ${clock(memory.lastTrialCompletedAt)}`].join(" · ")),
            step: "memory",
        },
        {
            label: "Digits backward",
            value: notPerformed(draft.digitsBackward, () => `List ${draft.digitsBackward.digitList || "not chosen"} · ${digitStrings(draft.digitsBackward.strings).length} lengths recorded`),
            step: "memory",
        },
        {
            label: "Months in reverse",
            value: notPerformed(draft.monthsReverse, () => `${ticks(draft, "monthsReverse.correctResponses")} · ${blankAs(draft.monthsReverse.timeSeconds, "–")} s · ${blankAs(draft.monthsReverse.errors, "–")} errors`),
            step: "memory",
        },
        {
            label: "mBESS",
            value: notPerformed(draft.mbess, () =>
                [draft.mbess.footTested ? `${HANDS[draft.mbess.footTested]} foot` : "foot not chosen", blankAs(draft.mbess.testingSurface, "no surface"), blankAs(draft.mbess.footwear, "no footwear"), `errors ${stancesLine(draft.mbess.firm)}`, draft.mbess.foamPerformed ? `foam ${stancesLine(draft.mbess.foam)}` : null]
                    .filter(Boolean)
                    .join(" · "),
            ),
            step: "balance",
        },
        { label: "Tandem gait", value: notPerformed(draft.tandemGait, () => draft.tandemGait.trials.map((trial) => (trial.completed ? `${blankAs(trial.timeSeconds, "–")} s` : "stopped early")).join(", ")), step: "balance" },
        { label: "Dual-task gait", value: notPerformed(draft.dualTaskGait, () => "Performed"), step: "balance" },
        { label: "Delayed recall", value: notPerformed(draft.delayedRecall, () => `started ${clock(draft.delayedRecall.startedAt)} · ${ticks(draft, "delayedRecall.words")}`), step: "balance" },
        { label: "Different from usual self", value: ANSWERS[draft.differentFromUsualSelf] ?? "Not answered", step: "balance" },
        { label: "Concussion diagnosed", value: ANSWERS[draft.concussionDiagnosed] ?? "Not recorded", step: "balance" },
    ];
}

/** The first problem per path, for showing each next to its control. */
export function problemsByPath(problems: readonly Scat6Problem[]): Record<string, Scat6Problem> {
    const byPath: Record<string, Scat6Problem> = {};
    for (const problem of problems) byPath[problem.path] ??= problem;
    return byPath;
}
