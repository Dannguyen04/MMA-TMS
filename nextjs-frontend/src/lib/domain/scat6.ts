import { z } from "zod";

/**
 * The SCAT6 baseline record a BASELINE examination carries (official English form, adolescents 13+ and adults), as the
 * medical service takes it. Items are recorded by their position on the official form, never by its wording: the form's
 * text, word lists and digit strings can't be reproduced digitally without BMJ consent, so the doctor reads them from
 * the paper form. Scores are computed by the service, never sent. Mirrors the service's schema rule for rule, so a form
 * can name the field to fix before sending. Safe for Server and Client Components.
 */

export const SCAT6 = {
    FORM_VERSION: "SCAT6-2023-EN",
    MIN_AGE_YEARS: 13,
    OBSERVABLE_SIGNS: 8,
    GCS_MAX_ASSESSMENTS: 3,
    MADDOCKS_QUESTIONS: 5,
    SYMPTOMS: 22,
    SYMPTOM_MAX_RATING: 6,
    ORIENTATION_QUESTIONS: 5,
    WORDS_PER_LIST: 10,
    MEMORY_TRIALS: 3,
    DIGIT_STRING_LENGTHS: 4,
    MONTHS_TIME_LIMIT_SECONDS: 30,
    MONTHS: 12,
    DELAYED_RECALL_MIN_DELAY_MS: 5 * 60 * 1000,
    MBESS_MAX_ERRORS: 10,
    GAIT_TRIALS: 3,
    DUAL_TASK_STEP: 7,
    DUAL_TASK_PRACTICE_RESPONSES: 8,
    DUAL_TASK_TRIAL_RESPONSES: 13,
    DUAL_TASK_ALTERNATE_MAX_RESPONSES: 30,
} as const;

export const SCAT6_LISTS = ["A", "B", "C"] as const;
export type Scat6List = (typeof SCAT6_LISTS)[number];

/* ─── Field rules ─────────────────────────────────────────────────────────── */

const pastDateTime = (label: string) =>
    z
        .string({ error: `Enter ${label}.` })
        .datetime({ error: `Enter ${label}.` })
        .refine((value) => new Date(value).getTime() <= Date.now(), `${label.charAt(0).toUpperCase()}${label.slice(1)} can't be in the future.`);

const items = (length: number) => z.array(z.boolean()).length(length);

const wholeNumber = (label: string, min: number, max: number) =>
    z
        .number({ error: `Enter ${label}.` })
        .int(`Enter ${label} as a whole number.`)
        .min(min, `${label.charAt(0).toUpperCase()}${label.slice(1)} must be between ${min} and ${max}.`)
        .max(max, `${label.charAt(0).toUpperCase()}${label.slice(1)} must be between ${min} and ${max}.`);

const seconds = (label: string) =>
    z
        .number({ error: `Enter ${label} in seconds.` })
        .finite()
        .positive(`Enter ${label} in seconds.`)
        .max(3_600, `${label.charAt(0).toUpperCase()}${label.slice(1)} can't be more than an hour.`);

const text = (label: string, max: number) =>
    z
        .string({ error: `Enter ${label}.` })
        .trim()
        .min(1, `Enter ${label}.`)
        .max(max, `Keep ${label} under ${max.toLocaleString("en")} characters.`);

const optionalText = (label: string, max: number) => text(label, max).nullable();

const list = z.enum(SCAT6_LISTS, { error: "Choose the list you used." });

const notPerformed = z.strictObject({ performed: z.literal(false), reason: text("why it wasn't performed", 1_000) });

/** A section performed with its answers, or explicitly not performed with the reason. Nothing is assumed 0 or normal. */
function section<Shape extends z.ZodRawShape>(shape: Shape) {
    return z.discriminatedUnion("performed", [notPerformed, z.strictObject({ performed: z.literal(true), ...shape })]);
}

/* ─── Sections ────────────────────────────────────────────────────────────── */

const immediateAssessmentSchema = section({
    observableSigns: z.strictObject({ witnessed: z.boolean(), observedOnVideo: z.boolean(), signs: items(SCAT6.OBSERVABLE_SIGNS) }),
    glasgowComaScale: z
        .array(
            z.strictObject({
                assessedAt: pastDateTime("when the GCS was assessed"),
                eye: wholeNumber("the eye response", 1, 4),
                verbal: wholeNumber("the verbal response", 1, 5),
                motor: wholeNumber("the motor response", 1, 6),
            }),
        )
        .min(1, "Record at least one GCS assessment.")
        .max(SCAT6.GCS_MAX_ASSESSMENTS),
    cervicalSpine: z
        .strictObject({
            neckPainAtRest: z.boolean(),
            tendernessToPalpation: z.boolean(),
            /** Asked only when there is no neck pain and no tenderness. */
            fullActiveRangeOfMotion: z.boolean().nullable(),
            limbStrengthAndSensationNormal: z.boolean(),
        })
        .refine((data) => (data.neckPainAtRest || data.tendernessToPalpation) === (data.fullActiveRangeOfMotion === null), {
            error: "Answer the range-of-motion question only when there is no neck pain and no tenderness.",
            path: ["fullActiveRangeOfMotion"],
        }),
    coordinationOcularMotor: z
        .strictObject({
            fingerToNoseNormal: z.boolean(),
            ocularMotorWithoutDoubleVision: z.boolean(),
            extraocularMovementsNormal: z.boolean(),
            extraocularDescription: optionalText("the description", 1_000),
        })
        .refine((data) => data.extraocularMovementsNormal || data.extraocularDescription !== null, {
            error: "Describe the abnormal extraocular movements.",
            path: ["extraocularDescription"],
        }),
    maddocks: items(SCAT6.MADDOCKS_QUESTIONS),
});

const symptomsSchema = section({
    ratings: z.array(wholeNumber("every symptom rating", 0, SCAT6.SYMPTOM_MAX_RATING)).length(SCAT6.SYMPTOMS),
    worseWithPhysicalActivity: z.boolean(),
    worseWithMentalActivity: z.boolean(),
    percentOfNormal: wholeNumber("the percent of normal", 0, 100),
    notNormalReason: optionalText("the reason", 1_000),
});

const orientationSchema = section({ answers: items(SCAT6.ORIENTATION_QUESTIONS) });

const immediateMemorySchema = section({
    wordList: list,
    trials: z.array(items(SCAT6.WORDS_PER_LIST)).length(SCAT6.MEMORY_TRIALS),
    lastTrialCompletedAt: pastDateTime("when the last trial ended"),
});

const digitsBackwardSchema = section({
    digitList: list,
    strings: z
        .array(z.strictObject({ trial1Correct: z.boolean(), trial2Correct: z.boolean().nullable() }))
        .min(1, "Record at least the first string length.")
        .max(SCAT6.DIGIT_STRING_LENGTHS)
        .superRefine((strings, ctx) => {
            strings.forEach((entry, index) => {
                if (entry.trial1Correct !== (entry.trial2Correct === null)) {
                    ctx.addIssue({ code: "custom", path: [index, "trial2Correct"], message: "Record trial 2 exactly when trial 1 is incorrect." });
                }
                if (!entry.trial1Correct && entry.trial2Correct === false && index !== strings.length - 1) {
                    ctx.addIssue({ code: "custom", path: [index + 1], message: "The test ends after both trials of a length are incorrect." });
                }
            });
            const last = strings.at(-1);
            const stopped = last !== undefined && !last.trial1Correct && last.trial2Correct === false;
            if (!stopped && strings.length !== SCAT6.DIGIT_STRING_LENGTHS) {
                ctx.addIssue({ code: "custom", path: [], message: "Give every string length until the test ends." });
            }
        }),
});

const monthsReverseSchema = section({
    correctResponses: items(SCAT6.MONTHS),
    timeSeconds: seconds("the time"),
    errors: wholeNumber("the errors", 0, SCAT6.MONTHS),
});

const stanceSchema = z.discriminatedUnion("unableToHoldFiveSeconds", [
    z.strictObject({ unableToHoldFiveSeconds: z.literal(true) }),
    z.strictObject({ unableToHoldFiveSeconds: z.literal(false), errors: wholeNumber("the errors", 0, SCAT6.MBESS_MAX_ERRORS) }),
]);

const stancesSchema = z.strictObject({ doubleLeg: stanceSchema, singleLeg: stanceSchema, tandem: stanceSchema });

const mbessSchema = section({
    footTested: z.enum(["LEFT", "RIGHT"], { error: "Choose the foot tested." }),
    testingSurface: text("the testing surface", 200),
    footwear: text("the footwear", 200),
    firm: stancesSchema,
    foam: z.discriminatedUnion("performed", [z.strictObject({ performed: z.literal(false) }), z.strictObject({ performed: z.literal(true), stances: stancesSchema })]),
});

const gaitTrialSchema = z.discriminatedUnion("completed", [
    z.strictObject({ completed: z.literal(true), timeSeconds: seconds("the time") }),
    z.strictObject({ completed: z.literal(false) }),
]);

const tandemGaitSchema = section({ trials: z.array(gaitTrialSchema).length(SCAT6.GAIT_TRIALS) });

const subtractionErrors = wholeNumber("the errors", 0, 100);

const dualTaskTrialSchema = z.discriminatedUnion("completed", [
    z.strictObject({ completed: z.literal(true), correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES), errors: subtractionErrors, timeSeconds: seconds("the time") }),
    z.strictObject({ completed: z.literal(false), correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES).nullable() }),
]);

const dualTaskSequenceSchema = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("PRINTED"), trials: z.array(dualTaskTrialSchema).length(SCAT6.GAIT_TRIALS) }),
    z.strictObject({
        kind: z.literal("ALTERNATE"),
        startingInteger: wholeNumber("the starting number", 1, 1_000),
        responses: z.array(wholeNumber("every response", -1_000, 1_000)).max(SCAT6.DUAL_TASK_ALTERNATE_MAX_RESPONSES, "Record at most 30 responses."),
        trial: z.discriminatedUnion("completed", [
            z.strictObject({ completed: z.literal(true), errors: subtractionErrors, timeSeconds: seconds("the time") }),
            z.strictObject({ completed: z.literal(false) }),
        ]),
    }),
]);

const dualTaskGaitSchema = section({
    subtractionStep: wholeNumber("the subtraction step", 1, 20),
    practice: z.strictObject({ correctResponses: items(SCAT6.DUAL_TASK_PRACTICE_RESPONSES), errors: subtractionErrors, timeSeconds: seconds("the time").nullable() }),
    sequence: dualTaskSequenceSchema,
});

const delayedRecallSchema = section({ startedAt: pastDateTime("when delayed recall started"), words: items(SCAT6.WORDS_PER_LIST) });

const administeredSchema = z
    .strictObject({
        status: z.literal("ADMINISTERED"),
        formVersion: z.literal(SCAT6.FORM_VERSION),
        administeredAt: pastDateTime("when the SCAT6 was administered"),
        examinerAttestation: z.literal(true, { error: "Confirm you administered or supervised the SCAT6." }),
        athlete: z.strictObject({
            dominantHand: z.enum(["LEFT", "RIGHT", "AMBIDEXTROUS"], { error: "Choose the dominant hand." }),
            sportTeamSchool: optionalText("the sport, team or school", 200),
            currentSchoolYear: optionalText("the school year", 50),
            yearsOfEducation: wholeNumber("the years of education", 0, 40).nullable(),
            firstLanguage: optionalText("the first language", 100),
            preferredLanguage: optionalText("the preferred language", 100),
        }),
        concussionHistory: z.strictObject({
            priorDiagnosedConcussions: wholeNumber("the number of earlier concussions", 0, 100),
            mostRecentConcussion: optionalText("the most recent concussion", 200),
            primarySymptoms: optionalText("the primary symptoms", 1_000),
            mostRecentRecoveryDays: wholeNumber("the recovery days", 0, 3_650).nullable(),
        }),
        immediateAssessment: immediateAssessmentSchema,
        background: z.strictObject({
            hospitalisedForHeadInjury: z.boolean(),
            headacheDisorderOrMigraine: z.boolean(),
            learningDisabilityOrDyslexia: z.boolean(),
            adhd: z.boolean(),
            depressionAnxietyOrOtherPsychological: z.boolean(),
            notes: optionalText("the notes", 2_000),
            currentMedications: optionalText("the current medications", 2_000),
        }),
        symptoms: symptomsSchema,
        orientation: orientationSchema,
        immediateMemory: immediateMemorySchema,
        digitsBackward: digitsBackwardSchema,
        monthsReverse: monthsReverseSchema,
        mbess: mbessSchema,
        tandemGait: tandemGaitSchema,
        dualTaskGait: dualTaskGaitSchema,
        gaitIncompleteReason: optionalText("why a gait trial wasn't completed", 1_000),
        delayedRecall: delayedRecallSchema,
        differentFromUsualSelf: z.enum(["YES", "NO", "NOT_APPLICABLE"], { error: "Answer whether the athlete is different from their usual self." }),
        concussionDiagnosed: z.enum(["YES", "NO", "DEFERRED"]).nullable(),
        clinicalNotes: optionalText("the clinical notes", 4_000),
    })
    .superRefine((data, ctx) => {
        if (data.monthsReverse.performed && data.monthsReverse.errors === 0 && data.monthsReverse.correctResponses.includes(false)) {
            ctx.addIssue({ code: "custom", path: ["monthsReverse", "errors"], message: "Count a month not marked correct as an error." });
        }
        const tandemCompleted = data.tandemGait.performed && data.tandemGait.trials.every((trial) => trial.completed);
        if (data.dualTaskGait.performed && !tandemCompleted) {
            ctx.addIssue({ code: "custom", path: ["dualTaskGait"], message: "Complete all 3 timed tandem gait trials before the dual task." });
        }
        const dual = data.dualTaskGait.performed ? data.dualTaskGait : undefined;
        if (dual?.sequence.kind === "PRINTED" && dual.subtractionStep !== SCAT6.DUAL_TASK_STEP) {
            ctx.addIssue({ code: "custom", path: ["dualTaskGait", "sequence"], message: "The printed sequences count down by 7. Record another step on the alternate row." });
        }
        const gaitTrials = [
            ...(data.tandemGait.performed ? data.tandemGait.trials : []),
            ...(dual === undefined ? [] : dual.sequence.kind === "PRINTED" ? dual.sequence.trials : [dual.sequence.trial]),
        ];
        const anyIncomplete = gaitTrials.some((trial) => !trial.completed);
        if (anyIncomplete !== (data.gaitIncompleteReason !== null)) {
            ctx.addIssue({
                code: "custom",
                path: ["gaitIncompleteReason"],
                message: anyIncomplete ? "Explain why a gait trial wasn't completed." : "Leave this empty: every gait trial was completed.",
            });
        }
        if (data.delayedRecall.performed) {
            if (!data.immediateMemory.performed) {
                ctx.addIssue({ code: "custom", path: ["delayedRecall"], message: "Delayed recall uses the Immediate Memory word list, so Immediate Memory must be performed." });
            } else if (new Date(data.delayedRecall.startedAt).getTime() - new Date(data.immediateMemory.lastTrialCompletedAt).getTime() < SCAT6.DELAYED_RECALL_MIN_DELAY_MS) {
                ctx.addIssue({ code: "custom", path: ["delayedRecall", "startedAt"], message: "Start delayed recall at least 5 minutes after the last Immediate Memory trial." });
            }
        }
        if (data.immediateMemory.performed && new Date(data.immediateMemory.lastTrialCompletedAt).getTime() < new Date(data.administeredAt).getTime()) {
            ctx.addIssue({ code: "custom", path: ["immediateMemory", "lastTrialCompletedAt"], message: "The last trial can't end before the SCAT6 started." });
        }
    });

/** A baseline without a SCAT6, e.g. an athlete under 13 or when it isn't clinically appropriate. */
const notAdministeredSchema = z.strictObject({
    status: z.literal("NOT_ADMINISTERED"),
    formVersion: z.literal(SCAT6.FORM_VERSION),
    reason: text("why the SCAT6 wasn't administered", 2_000),
});

export const scat6InputSchema = z.discriminatedUnion("status", [administeredSchema, notAdministeredSchema], { error: "Record the SCAT6, or why it wasn't administered." });

export type Scat6Input = z.infer<typeof scat6InputSchema>;
export type AdministeredScat6 = z.infer<typeof administeredSchema>;

/* ─── Scores (computed by the service) ────────────────────────────────────── */

const nullableScore = z.number().nullable();

export const scat6ScoresSchema = z.object({
    maddocks: nullableScore,
    glasgowComaScale: z.array(z.number()).nullable(),
    symptomCount: nullableScore,
    symptomSeverity: nullableScore,
    orientation: nullableScore,
    immediateMemoryTrials: z.array(z.number()).nullable(),
    immediateMemory: nullableScore,
    digitsBackward: nullableScore,
    monthsReverse: nullableScore,
    concentration: nullableScore,
    delayedRecall: nullableScore,
    cognitiveTotal: nullableScore,
    mbessFirmTotal: nullableScore,
    mbessFoamTotal: nullableScore,
    tandemGaitFastestSeconds: nullableScore,
    tandemGaitAverageSeconds: nullableScore,
    dualTaskGaitFastestSeconds: nullableScore,
    /** True when every component of the cognitive total, symptoms and mBESS was computed. */
    complete: z.boolean(),
});
export type Scat6Scores = z.infer<typeof scat6ScoresSchema>;

/** What an examination keeps of its SCAT6. Stored answers are only identified, never re-validated against a newer form. */
export const scat6RecordSchema = z.object({
    formVersion: z.string(),
    responses: z.looseObject({ status: z.enum(["ADMINISTERED", "NOT_ADMINISTERED"]), formVersion: z.string(), reason: z.string().optional() }),
    scoringVersion: z.number().int().nullable(),
    scores: scat6ScoresSchema.nullable(),
});
export type Scat6Record = z.infer<typeof scat6RecordSchema>;

/** Scores worth reading at a glance, with the form's maximum where it has one. */
export const SCAT6_SCORE_ROWS: { key: Exclude<keyof Scat6Scores, "complete" | "glasgowComaScale" | "immediateMemoryTrials">; label: string; max: number | null; unit?: "s" }[] = [
    { key: "symptomCount", label: "Symptoms", max: SCAT6.SYMPTOMS },
    { key: "symptomSeverity", label: "Symptom severity", max: SCAT6.SYMPTOMS * SCAT6.SYMPTOM_MAX_RATING },
    { key: "orientation", label: "Orientation", max: SCAT6.ORIENTATION_QUESTIONS },
    { key: "immediateMemory", label: "Immediate memory", max: SCAT6.WORDS_PER_LIST * SCAT6.MEMORY_TRIALS },
    { key: "concentration", label: "Concentration", max: SCAT6.DIGIT_STRING_LENGTHS + 1 },
    { key: "delayedRecall", label: "Delayed recall", max: SCAT6.WORDS_PER_LIST },
    { key: "cognitiveTotal", label: "Cognitive total", max: SCAT6.ORIENTATION_QUESTIONS + SCAT6.WORDS_PER_LIST * SCAT6.MEMORY_TRIALS + SCAT6.DIGIT_STRING_LENGTHS + 1 + SCAT6.WORDS_PER_LIST },
    { key: "maddocks", label: "Maddocks", max: SCAT6.MADDOCKS_QUESTIONS },
    { key: "mbessFirmTotal", label: "mBESS errors, firm", max: SCAT6.MBESS_MAX_ERRORS * 3 },
    { key: "mbessFoamTotal", label: "mBESS errors, foam", max: SCAT6.MBESS_MAX_ERRORS * 3 },
    { key: "tandemGaitFastestSeconds", label: "Tandem gait, fastest", max: null, unit: "s" },
    { key: "tandemGaitAverageSeconds", label: "Tandem gait, average", max: null, unit: "s" },
    { key: "dualTaskGaitFastestSeconds", label: "Dual-task gait, fastest", max: null, unit: "s" },
];
