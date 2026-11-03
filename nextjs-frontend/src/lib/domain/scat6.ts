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
        .string({ error: `Hãy nhập ${label}.` })
        .datetime({ error: `Hãy nhập ${label}.` })
        .refine((value) => new Date(value).getTime() <= Date.now(), `${label.charAt(0).toUpperCase()}${label.slice(1)} không thể ở tương lai.`);

const items = (length: number) => z.array(z.boolean()).length(length);

const wholeNumber = (label: string, min: number, max: number) =>
    z
        .number({ error: `Hãy nhập ${label}.` })
        .int(`Hãy nhập ${label} dạng số nguyên.`)
        .min(min, `${label.charAt(0).toUpperCase()}${label.slice(1)} phải từ ${min} đến ${max}.`)
        .max(max, `${label.charAt(0).toUpperCase()}${label.slice(1)} phải từ ${min} đến ${max}.`);

const seconds = (label: string) =>
    z
        .number({ error: `Hãy nhập ${label} theo giây.` })
        .finite()
        .positive(`Hãy nhập ${label} theo giây.`)
        .max(3_600, `${label.charAt(0).toUpperCase()}${label.slice(1)} không thể quá một giờ.`);

const text = (label: string, max: number) =>
    z
        .string({ error: `Hãy nhập ${label}.` })
        .trim()
        .min(1, `Hãy nhập ${label}.`)
        .max(max, `${label} tối đa ${max.toLocaleString("vi")} ký tự.`);

const optionalText = (label: string, max: number) => text(label, max).nullable();

const list = z.enum(SCAT6_LISTS, { error: "Choose the list you used." });

const notPerformed = z.strictObject({ performed: z.literal(false), reason: text("lý do không thực hiện", 1_000) });

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
                assessedAt: pastDateTime("thời điểm đánh giá GCS"),
                eye: wholeNumber("đáp ứng mắt", 1, 4),
                verbal: wholeNumber("đáp ứng lời nói", 1, 5),
                motor: wholeNumber("đáp ứng vận động", 1, 6),
            }),
        )
        .min(1, "Hãy ghi ít nhất một lần đánh giá GCS.")
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
            error: "Chỉ trả lời câu biên độ vận động khi không đau cổ và không đau khi ấn.",
            path: ["fullActiveRangeOfMotion"],
        }),
    coordinationOcularMotor: z
        .strictObject({
            fingerToNoseNormal: z.boolean(),
            ocularMotorWithoutDoubleVision: z.boolean(),
            extraocularMovementsNormal: z.boolean(),
            extraocularDescription: optionalText("mô tả", 1_000),
        })
        .refine((data) => data.extraocularMovementsNormal || data.extraocularDescription !== null, {
            error: "Hãy mô tả vận động nhãn cầu bất thường.",
            path: ["extraocularDescription"],
        }),
    maddocks: items(SCAT6.MADDOCKS_QUESTIONS),
});

const symptomsSchema = section({
    ratings: z.array(wholeNumber("mọi điểm triệu chứng", 0, SCAT6.SYMPTOM_MAX_RATING)).length(SCAT6.SYMPTOMS),
    worseWithPhysicalActivity: z.boolean(),
    worseWithMentalActivity: z.boolean(),
    percentOfNormal: wholeNumber("phần trăm so với bình thường", 0, 100),
    notNormalReason: optionalText("lý do", 1_000),
});

const orientationSchema = section({ answers: items(SCAT6.ORIENTATION_QUESTIONS) });

const immediateMemorySchema = section({
    wordList: list,
    trials: z.array(items(SCAT6.WORDS_PER_LIST)).length(SCAT6.MEMORY_TRIALS),
    lastTrialCompletedAt: pastDateTime("thời điểm kết thúc lượt cuối"),
});

const digitsBackwardSchema = section({
    digitList: list,
    strings: z
        .array(z.strictObject({ trial1Correct: z.boolean(), trial2Correct: z.boolean().nullable() }))
        .min(1, "Hãy ghi ít nhất độ dài dãy đầu tiên.")
        .max(SCAT6.DIGIT_STRING_LENGTHS)
        .superRefine((strings, ctx) => {
            strings.forEach((entry, index) => {
                if (entry.trial1Correct !== (entry.trial2Correct === null)) {
                    ctx.addIssue({ code: "custom", path: [index, "trial2Correct"], message: "Chỉ ghi lượt 2 khi lượt 1 sai." });
                }
                if (!entry.trial1Correct && entry.trial2Correct === false && index !== strings.length - 1) {
                    ctx.addIssue({ code: "custom", path: [index + 1], message: "Bài kiểm tra dừng khi cả hai lượt của một độ dài đều sai." });
                }
            });
            const last = strings.at(-1);
            const stopped = last !== undefined && !last.trial1Correct && last.trial2Correct === false;
            if (!stopped && strings.length !== SCAT6.DIGIT_STRING_LENGTHS) {
                ctx.addIssue({ code: "custom", path: [], message: "Hãy ghi mọi độ dài dãy cho đến khi dừng." });
            }
        }),
});

const monthsReverseSchema = section({
    correctResponses: items(SCAT6.MONTHS),
    timeSeconds: seconds("thời gian"),
    errors: wholeNumber("số lỗi", 0, SCAT6.MONTHS),
});

const stanceSchema = z.discriminatedUnion("unableToHoldFiveSeconds", [
    z.strictObject({ unableToHoldFiveSeconds: z.literal(true) }),
    z.strictObject({ unableToHoldFiveSeconds: z.literal(false), errors: wholeNumber("số lỗi", 0, SCAT6.MBESS_MAX_ERRORS) }),
]);

const stancesSchema = z.strictObject({ doubleLeg: stanceSchema, singleLeg: stanceSchema, tandem: stanceSchema });

const mbessSchema = section({
    footTested: z.enum(["LEFT", "RIGHT"], { error: "Choose the foot tested." }),
    testingSurface: text("bề mặt kiểm tra", 200),
    footwear: text("giày dép", 200),
    firm: stancesSchema,
    foam: z.discriminatedUnion("performed", [z.strictObject({ performed: z.literal(false) }), z.strictObject({ performed: z.literal(true), stances: stancesSchema })]),
});

const gaitTrialSchema = z.discriminatedUnion("completed", [
    z.strictObject({ completed: z.literal(true), timeSeconds: seconds("thời gian") }),
    z.strictObject({ completed: z.literal(false) }),
]);

const tandemGaitSchema = section({ trials: z.array(gaitTrialSchema).length(SCAT6.GAIT_TRIALS) });

const subtractionErrors = wholeNumber("số lỗi", 0, 100);

const dualTaskTrialSchema = z.discriminatedUnion("completed", [
    z.strictObject({ completed: z.literal(true), correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES), errors: subtractionErrors, timeSeconds: seconds("thời gian") }),
    z.strictObject({ completed: z.literal(false), correctResponses: items(SCAT6.DUAL_TASK_TRIAL_RESPONSES).nullable() }),
]);

const dualTaskSequenceSchema = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("PRINTED"), trials: z.array(dualTaskTrialSchema).length(SCAT6.GAIT_TRIALS) }),
    z.strictObject({
        kind: z.literal("ALTERNATE"),
        startingInteger: wholeNumber("số bắt đầu", 1, 1_000),
        responses: z.array(wholeNumber("mọi câu trả lời", -1_000, 1_000)).max(SCAT6.DUAL_TASK_ALTERNATE_MAX_RESPONSES, "Ghi tối đa 30 câu trả lời."),
        trial: z.discriminatedUnion("completed", [
            z.strictObject({ completed: z.literal(true), errors: subtractionErrors, timeSeconds: seconds("thời gian") }),
            z.strictObject({ completed: z.literal(false) }),
        ]),
    }),
]);

const dualTaskGaitSchema = section({
    subtractionStep: wholeNumber("bước trừ", 1, 20),
    practice: z.strictObject({ correctResponses: items(SCAT6.DUAL_TASK_PRACTICE_RESPONSES), errors: subtractionErrors, timeSeconds: seconds("thời gian").nullable() }),
    sequence: dualTaskSequenceSchema,
});

const delayedRecallSchema = section({ startedAt: pastDateTime("thời điểm bắt đầu nhớ lại có trì hoãn"), words: items(SCAT6.WORDS_PER_LIST) });

const administeredSchema = z
    .strictObject({
        status: z.literal("ADMINISTERED"),
        formVersion: z.literal(SCAT6.FORM_VERSION),
        administeredAt: pastDateTime("thời điểm thực hiện SCAT6"),
        examinerAttestation: z.literal(true, { error: "Hãy xác nhận bạn đã thực hiện hoặc giám sát SCAT6." }),
        athlete: z.strictObject({
            dominantHand: z.enum(["LEFT", "RIGHT", "AMBIDEXTROUS"], { error: "Choose the dominant hand." }),
            sportTeamSchool: optionalText("môn thể thao, đội hoặc trường", 200),
            currentSchoolYear: optionalText("năm học", 50),
            yearsOfEducation: wholeNumber("số năm đi học", 0, 40).nullable(),
            firstLanguage: optionalText("ngôn ngữ mẹ đẻ", 100),
            preferredLanguage: optionalText("ngôn ngữ ưu tiên", 100),
        }),
        concussionHistory: z.strictObject({
            priorDiagnosedConcussions: wholeNumber("số lần chấn động não trước đây", 0, 100),
            mostRecentConcussion: optionalText("lần chấn động não gần nhất", 200),
            primarySymptoms: optionalText("triệu chứng chính", 1_000),
            mostRecentRecoveryDays: wholeNumber("số ngày hồi phục", 0, 3_650).nullable(),
        }),
        immediateAssessment: immediateAssessmentSchema,
        background: z.strictObject({
            hospitalisedForHeadInjury: z.boolean(),
            headacheDisorderOrMigraine: z.boolean(),
            learningDisabilityOrDyslexia: z.boolean(),
            adhd: z.boolean(),
            depressionAnxietyOrOtherPsychological: z.boolean(),
            notes: optionalText("ghi chú", 2_000),
            currentMedications: optionalText("thuốc đang dùng", 2_000),
        }),
        symptoms: symptomsSchema,
        orientation: orientationSchema,
        immediateMemory: immediateMemorySchema,
        digitsBackward: digitsBackwardSchema,
        monthsReverse: monthsReverseSchema,
        mbess: mbessSchema,
        tandemGait: tandemGaitSchema,
        dualTaskGait: dualTaskGaitSchema,
        gaitIncompleteReason: optionalText("lý do lượt đi chưa hoàn thành", 1_000),
        delayedRecall: delayedRecallSchema,
        differentFromUsualSelf: z.enum(["YES", "NO", "NOT_APPLICABLE"], { error: "Answer whether the athlete is different from their usual self." }),
        concussionDiagnosed: z.enum(["YES", "NO", "DEFERRED"]).nullable(),
        clinicalNotes: optionalText("ghi chú lâm sàng", 4_000),
    })
    .superRefine((data, ctx) => {
        if (data.monthsReverse.performed && data.monthsReverse.errors === 0 && data.monthsReverse.correctResponses.includes(false)) {
            ctx.addIssue({ code: "custom", path: ["monthsReverse", "errors"], message: "Tính tháng không được đánh dấu đúng là một lỗi." });
        }
        const tandemCompleted = data.tandemGait.performed && data.tandemGait.trials.every((trial) => trial.completed);
        if (data.dualTaskGait.performed && !tandemCompleted) {
            ctx.addIssue({ code: "custom", path: ["dualTaskGait"], message: "Hãy hoàn thành cả 3 lượt đi nối gót tính giờ trước bài nhiệm vụ kép." });
        }
        const dual = data.dualTaskGait.performed ? data.dualTaskGait : undefined;
        if (dual?.sequence.kind === "PRINTED" && dual.subtractionStep !== SCAT6.DUAL_TASK_STEP) {
            ctx.addIssue({ code: "custom", path: ["dualTaskGait", "sequence"], message: "Dãy in sẵn đếm lùi 7. Ghi bước khác ở dòng thay thế." });
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
                message: anyIncomplete ? "Hãy giải thích lý do lượt đi chưa hoàn thành." : "Để trống: mọi lượt đi đã hoàn thành.",
            });
        }
        if (data.delayedRecall.performed) {
            if (!data.immediateMemory.performed) {
                ctx.addIssue({ code: "custom", path: ["delayedRecall"], message: "Nhớ lại có trì hoãn dùng danh sách từ của Trí nhớ tức thời, nên phải thực hiện Trí nhớ tức thời." });
            } else if (new Date(data.delayedRecall.startedAt).getTime() - new Date(data.immediateMemory.lastTrialCompletedAt).getTime() < SCAT6.DELAYED_RECALL_MIN_DELAY_MS) {
                ctx.addIssue({ code: "custom", path: ["delayedRecall", "startedAt"], message: "Bắt đầu nhớ lại có trì hoãn ít nhất 5 phút sau lượt Trí nhớ tức thời cuối." });
            }
        }
        if (data.immediateMemory.performed && new Date(data.immediateMemory.lastTrialCompletedAt).getTime() < new Date(data.administeredAt).getTime()) {
            ctx.addIssue({ code: "custom", path: ["immediateMemory", "lastTrialCompletedAt"], message: "Lượt cuối không thể kết thúc trước khi bắt đầu SCAT6." });
        }
    });

/** A baseline without a SCAT6, e.g. an athlete under 13 or when it isn't clinically appropriate. */
const notAdministeredSchema = z.strictObject({
    status: z.literal("NOT_ADMINISTERED"),
    formVersion: z.literal(SCAT6.FORM_VERSION),
    reason: text("lý do không thực hiện SCAT6", 2_000),
});

export const scat6InputSchema = z.discriminatedUnion("status", [administeredSchema, notAdministeredSchema], { error: "Hãy ghi SCAT6, hoặc lý do không thực hiện." });

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
    { key: "symptomCount", label: "Triệu chứng", max: SCAT6.SYMPTOMS },
    { key: "symptomSeverity", label: "Mức độ triệu chứng", max: SCAT6.SYMPTOMS * SCAT6.SYMPTOM_MAX_RATING },
    { key: "orientation", label: "Định hướng", max: SCAT6.ORIENTATION_QUESTIONS },
    { key: "immediateMemory", label: "Trí nhớ tức thời", max: SCAT6.WORDS_PER_LIST * SCAT6.MEMORY_TRIALS },
    { key: "concentration", label: "Tập trung", max: SCAT6.DIGIT_STRING_LENGTHS + 1 },
    { key: "delayedRecall", label: "Nhớ lại có trì hoãn", max: SCAT6.WORDS_PER_LIST },
    { key: "cognitiveTotal", label: "Tổng điểm nhận thức", max: SCAT6.ORIENTATION_QUESTIONS + SCAT6.WORDS_PER_LIST * SCAT6.MEMORY_TRIALS + SCAT6.DIGIT_STRING_LENGTHS + 1 + SCAT6.WORDS_PER_LIST },
    { key: "maddocks", label: "Maddocks", max: SCAT6.MADDOCKS_QUESTIONS },
    { key: "mbessFirmTotal", label: "Lỗi mBESS, nền cứng", max: SCAT6.MBESS_MAX_ERRORS * 3 },
    { key: "mbessFoamTotal", label: "Lỗi mBESS, đệm xốp", max: SCAT6.MBESS_MAX_ERRORS * 3 },
    { key: "tandemGaitFastestSeconds", label: "Đi nối gót, nhanh nhất", max: null, unit: "s" },
    { key: "tandemGaitAverageSeconds", label: "Đi nối gót, trung bình", max: null, unit: "s" },
    { key: "dualTaskGaitFastestSeconds", label: "Đi nhiệm vụ kép, nhanh nhất", max: null, unit: "s" },
];
