import type {
    ClearanceLevel,
    ClearanceStatus,
    ExaminationAssessment,
    ExaminationOutcome,
    ExaminationType,
    Injury,
    MedicalClearance,
    MedicalDocument,
    MedicalExamination,
    MedicalRecord,
    RecoveryCheckIn,
    RecoveryPhase,
    RecoveryPhaseStatus,
    RecoveryPlan,
    TrainingRestriction,
    Treatment,
    Vitals,
} from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { clamp, round } from "@/lib/utils";
import { BAO_BASELINE_EXAM_DATE, mockFighters, type SeedFighter } from "./people";
import { createRandom } from "./random";
import { clampPastToday, daysAgo, daysFromNow, fromToday } from "./time";

/**
 * Sports-medicine seed: medical records, examinations, injuries, treatments, recovery
 * plans and Medical Clearances. Follows the fighter storylines in people.ts.
 *
 * Doctor references (examination.doctorId, injury.recordedById, recoveryPlan.doctorId,
 * clearance.doctorId) hold doctor profile ids (d-*).
 */

const THU_LE = "d-thu-le";
const SAMUEL_BROOKS = "d-samuel-brooks";
const THU_LE_NAME = "Dr. Thu Lê";
const SAMUEL_BROOKS_NAME = "BS. Samuel Brooks";
const LOTUS_PHYSIO = "Phòng khám vật lý trị liệu Lotus";

const fighterMap = new Map(mockFighters.map((f) => [f.id, f]));

function fighter(fighterId: string): SeedFighter {
    const found = fighterMap.get(fighterId);
    if (!found) throw new Error(`Unknown fighter in medical seed: ${fighterId}`);
    return found;
}

/** "f-minh-tran" → "minh" */
const slug = (fighterId: string) => fighterId.split("-")[1];

/** End of a calendar day `days` from today (negative = past) — used for validity dates. */
const endOfDay = (days: number) => fromToday(days, 23, 59);

/* ─── Vitals ──────────────────────────────────────────────────────────────── */

/** Extra walking weight carried before the current camp, in kg (tapers to 0 at today). */
const CAMP_WEIGHT_OFFSET_KG: Record<string, number> = {
    "f-minh-tran": 1.6,
    "f-aigerim-sadykova": 1.1,
    "f-sofia-kowalski": 1.3,
    "f-hoang-long": 1.9,
    "f-linh-pham": 0.6,
};

function vitals(fighterId: string, dayOffset: number, overrides: Partial<Vitals> = {}): Vitals {
    const f = fighter(fighterId);
    const rng = createRandom(`vitals:${fighterId}:${dayOffset}`);
    const campRamp = Math.min(dayOffset, 56) / 56;
    const heavy = f.weightKg > 100;
    return {
        weightKg: round(f.weightKg + (CAMP_WEIGHT_OFFSET_KG[fighterId] ?? 0) * campRamp + rng.jitter(0.5), 1),
        restingHeartRate: f.restingHeartRate + rng.int(-2, 3),
        bloodPressureSystolic: heavy ? rng.int(122, 130) : rng.int(110, 126),
        bloodPressureDiastolic: heavy ? rng.int(76, 84) : rng.int(66, 80),
        temperatureC: rng.float(36.4, 36.9, 1),
        spo2Pct: rng.int(97, 99),
        hydration: "good",
        ...overrides,
    };
}

/* ─── Examination builders ────────────────────────────────────────────────── */

interface ExamInput {
    fighterId: string;
    /** Days before today. */
    dayOffset: number;
    type: ExaminationType;
    /** Id label, e.g. "routine" → ex-minh-routine-62d. */
    label: string;
    doctorId?: string;
    hour?: number;
    minute?: number;
    outcome?: ExaminationOutcome;
    assessments: ExaminationAssessment[] | ((vitals: Vitals) => ExaminationAssessment[]);
    summary: string;
    recommendations: string;
    /** Follow-up date as days from today. */
    followUpInDays?: number;
    vitals?: Partial<Vitals>;
}

function exam(input: ExamInput): MedicalExamination {
    const f = fighter(input.fighterId);
    const measured = vitals(f.id, input.dayOffset, input.vitals);
    return {
        id: `ex-${slug(f.id)}-${input.label}-${input.dayOffset}d`,
        fighterId: f.id,
        doctorId: input.doctorId ?? f.doctorIds[0],
        date: clampPastToday(daysAgo(input.dayOffset, input.hour ?? 10, input.minute ?? 0)),
        type: input.type,
        vitals: measured,
        assessments: typeof input.assessments === "function" ? input.assessments(measured) : input.assessments,
        outcome: input.outcome ?? "fit",
        summary: input.summary,
        recommendations: input.recommendations,
        followUpDate: input.followUpInDays === undefined ? null : daysFromNow(input.followUpInDays, 10, 0),
    };
}

function weightNote(fighterId: string, weightKg: number): string {
    const f = fighter(fighterId);
    const above = round(weightKg - f.targetWeightKg, 1);
    return above > 0
        ? `Cân nặng thường ngày ${weightKg} kg — vượt ${above} kg so với giới hạn hạng cân ${f.targetWeightKg} kg.`
        : `Walking weight ${weightKg} kg — within the ${f.targetWeightKg} kg class limit.`;
}

interface BaselineNotes {
    summary?: string;
    respiratory?: string;
    scat?: string;
    musculoskeletal?: string;
    bloodwork?: string;
}

function baselineExam(fighterId: string, dayOffset: number, notes: BaselineNotes = {}): MedicalExamination {
    const rng = createRandom(`baseline:${fighterId}`);
    return exam({
        fighterId,
        dayOffset,
        type: "baseline",
        label: "baseline",
        hour: 9,
        assessments: [
            { area: "Tim mạch", result: "normal", note: "Regular rhythm, no murmurs. Resting ECG within normal limits for a trained athlete." },
            {
                area: "Hô hấp",
                result: "normal",
                note: notes.respiratory ?? "Clear breath sounds bilaterally; no exercise-related symptoms reported.",
            },
            { area: "Neurological screen", result: "normal", note: "Cranial nerves, coordination and reflexes intact." },
            {
                area: "SCAT6 baseline",
                result: "normal",
                note: notes.scat ?? `Symptom score ${rng.int(0, 2)}/22, SAC ${rng.int(40, 46)}/50, mBESS ${rng.int(1, 4)} errors.`,
            },
            { area: "Vision", result: "normal", note: "Visual acuity 6/6 in both eyes; full visual fields." },
            {
                area: "Sàng lọc cơ xương khớp",
                result: "normal",
                note: notes.musculoskeletal ?? `Full, pain-free range at all major joints. Functional movement screen ${rng.int(15, 18)}/21.`,
            },
            {
                area: "Bloodwork",
                result: "normal",
                note: notes.bloodwork ?? "Full blood count, ferritin, vitamin D, renal function and electrolytes within reference ranges.",
            },
        ],
        summary: notes.summary ?? "Khám nền hằng năm. Không có chống chỉ định tập va chạm toàn phần hay thi đấu.",
        recommendations: "Baseline values stored for comparison after any head impact or injury. Repeat the baseline in 12 months.",
    });
}

const ROUTINE_SUMMARIES = [
    "Khám định kỳ. Không có vấn đề sức khỏe mới; chịu tốt khối lượng tập hiện tại.",
    "Khám định kỳ. Cảm thấy khỏe, ngủ 7–8 giờ, không than đau.",
    "Khám định kỳ. Không chấn thương hay bệnh trong thời gian qua; chỉ số hồi phục tốt.",
    "Khám định kỳ. Tập luyện và hồi phục cân bằng; không có vấn đề.",
] as const;

const ROUTINE_RECOMMENDATIONS = [
    "Tiếp tục giáo án hiện tại. Duy trì đủ nước và giấc ngủ đều đặn.",
    "No changes needed. Next routine check in 6–8 weeks.",
    "Continue the current load. Report any new joint pain or head knocks promptly.",
] as const;

const RENEWAL_SUMMARY = "Khám định kỳ và gia hạn giấy phép. Không chấn thương hay bệnh trong thời gian qua.";
const RENEWAL_RECOMMENDATIONS = "Clearance renewed without restrictions. Next routine check in 6–8 weeks.";

interface RoutineOptions {
    hour?: number;
    summary?: string;
    recommendations?: string;
    outcome?: ExaminationOutcome;
    followUpInDays?: number;
    vitals?: Partial<Vitals>;
    musculoskeletal?: ExaminationAssessment;
    weight?: (vitals: Vitals) => ExaminationAssessment;
    extra?: ExaminationAssessment[];
}

function routineExam(fighterId: string, dayOffset: number, options: RoutineOptions = {}): MedicalExamination {
    const rng = createRandom(`routine:${fighterId}:${dayOffset}`);
    return exam({
        fighterId,
        dayOffset,
        type: "routine",
        label: "routine",
        hour: options.hour ?? rng.pick([8, 9, 10]),
        outcome: options.outcome,
        followUpInDays: options.followUpInDays,
        vitals: options.vitals,
        assessments: (v) => [
            { area: "Tim mạch", result: "normal", note: "Nhịp đều, không có tiếng thổi." },
            { area: "Hô hấp", result: "normal", note: "Rì rào phế nang rõ hai bên." },
            options.musculoskeletal ?? {
                area: "Sàng lọc cơ xương khớp",
                result: "normal",
                note: "Không có than phiền mới về khớp hay mô mềm; đủ biên độ, không đau.",
            },
            { area: "Da", result: "normal", note: "Không có dấu hiệu nhiễm trùng da; không có vết thương hở." },
            options.weight?.(v) ?? { area: "Cân nặng & mức nước", result: "normal", note: `${weightNote(fighterId, v.weightKg)} Đủ nước.` },
            ...(options.extra ?? []),
        ],
        summary: options.summary ?? rng.pick(ROUTINE_SUMMARIES),
        recommendations: options.recommendations ?? rng.pick(ROUTINE_RECOMMENDATIONS),
    });
}

function preFightExam(fighterId: string, dayOffset: number): MedicalExamination {
    return exam({
        fighterId,
        dayOffset,
        type: "pre_fight",
        label: "prefight",
        hour: 9,
        assessments: (v) => [
            { area: "Tim mạch", result: "normal", note: "Regular rhythm, no murmurs; blood pressure within competition limits." },
            { area: "Neurological screen", result: "normal", note: "No neurological symptoms; SCAT6 symptom score at baseline." },
            { area: "Ophthalmic screen", result: "normal", note: "Visual acuity 6/6; fundoscopy normal." },
            { area: "Sàng lọc cơ xương khớp", result: "normal", note: "No current injuries." },
            { area: "Weight check", result: "normal", note: `${v.weightKg} kg at check; on track for a safe weigh-in.` },
            { area: "Infectious disease screen", result: "normal", note: "Hepatitis B, hepatitis C and HIV results current and negative." },
        ],
        summary: "Khám trước trận. Đủ điều kiện thi đấu.",
        recommendations: "Cleared to compete. Rehydrate gradually after the weigh-in; post-fight check within 48 hours.",
    });
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

export const mockMedicalExaminations: MedicalExamination[] = [
    /* Minh Trần — healthy, fight camp */
    baselineExam("f-minh-tran", 318),
    routineExam("f-minh-tran", 262),
    routineExam("f-minh-tran", 205),
    preFightExam("f-minh-tran", 151),
    exam({
        fighterId: "f-minh-tran",
        dayOffset: 149,
        type: "post_injury",
        label: "shin",
        assessments: [
            { area: "Right shin inspection", result: "abnormal", note: "Bruising with a 4 × 3 cm firm haematoma over the anterior tibia; skin intact." },
            { area: "Bony tenderness", result: "normal", note: "No point tenderness over the tibial crest; pain-free single-leg hop." },
            { area: "Compartment check", result: "normal", note: "Soft compartments, pain-free passive toe stretch, normal distal pulses and sensation." },
            { area: "Neurological screen", result: "normal", note: "Post-bout SCAT6 symptom score at baseline." },
        ],
        summary: "Khám sau trận do bị chặn đá nhiều lần. Đụng dập cẳng chân phải kèm tụ máu nhỏ; không có dấu hiệu gãy xương hay hội chứng chèn ép khoang.",
        recommendations:
            "Ice and compression for 48–72 hours during the planned post-bout rest week, then a pain-guided return to kicking. Review if swelling increases or pain wakes him at night.",
    }),
    routineExam("f-minh-tran", 108),
    routineExam("f-minh-tran", 62),
    routineExam("f-minh-tran", 20, {
        hour: 15,
        summary:
            "Khám trước Fight Camp và gia hạn giấy phép trước Saigon Warriors MMA 04. Đụng dập cẳng chân trước đây đã khỏi hẳn; kế hoạch giảm cân đã xem lại, đang giảm từ từ đúng tiến độ.",
        recommendations:
            "Clearance renewed without restrictions. Aim for about 0.5 kg per week through diet; no dehydration-based cutting before fight week. Pre-fight medical in fight week.",
    }),

    /* Lucas Ferreira — left hamstring strain, recovery */
    baselineExam("f-lucas-ferreira", 300, {
        musculoskeletal: "Full, pain-free range. Previous left shoulder labral repair (2017) is stable with full strength.",
    }),
    routineExam("f-lucas-ferreira", 240),
    routineExam("f-lucas-ferreira", 185),
    routineExam("f-lucas-ferreira", 128, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-lucas-ferreira", 71),
    exam({
        fighterId: "f-lucas-ferreira",
        dayOffset: 23,
        type: "post_injury",
        label: "injury",
        outcome: "unfit",
        assessments: [
            {
                area: "Palpation — left posterior thigh",
                result: "abnormal",
                note: "Tenderness mid-belly of the biceps femoris, 18 cm above the knee crease; no palpable defect.",
            },
            { area: "Active knee extension (90/90)", result: "abnormal", note: "Left 38° short of full extension vs. 12° on the right." },
            { area: "Isometric strength", result: "abnormal", note: "Painful, weak resisted knee flexion at 15° and 90° (4/5)." },
            { area: "Gait", result: "abnormal", note: "Antalgic gait with a shortened left stride." },
            { area: "Neural tension (slump test)", result: "normal", note: "Negative; no sciatic nerve involvement." },
        ],
        summary:
            "Chấn thương cấp cơ đùi sau trái khi đấu tập tối qua. Dấu hiệu phù hợp căng cơ nhị đầu đùi mức vừa; đã chỉ định MRI để xác định mức độ.",
        recommendations:
            "Not cleared to train. Protect the muscle for 3–5 days with relative rest, compression and pain-free walking. Start physiotherapy-led isometrics once walking is pain-free.",
    }),
    exam({
        fighterId: "f-lucas-ferreira",
        dayOffset: 10,
        type: "return_to_play",
        label: "review",
        hour: 11,
        outcome: "fit_with_restrictions",
        followUpInDays: 4,
        assessments: [
            { area: "Palpation — left posterior thigh", result: "normal", note: "No residual tenderness." },
            { area: "Active knee extension (90/90)", result: "normal", note: "Left 16° vs. 12° on the right — near symmetrical." },
            { area: "Isometric strength", result: "abnormal", note: "Knee flexion 78% of the right side on hand-held dynamometry; pain-free." },
            { area: "Running assessment", result: "normal", note: "Pain-free jogging and strides at 60% effort." },
            { area: "Explosive hip extension", result: "inconclusive", note: "Mild tightness on sprint starts and fast hip-extension drills." },
        ],
        summary:
            "Đánh giá trở lại tập hai tuần sau căng cơ. Sinh hoạt không đau, biên độ gần đầy đủ, sức mạnh cải thiện; chưa sẵn sàng cho tải tốc độ cao hay bùng nổ.",
        recommendations:
            "Cleared with restrictions: no sparring, no kicks, session intensity capped at RPE 7. Continue progressive loading and the running progression. Review at the end of rehabilitation phase 3.",
    }),

    /* Aigerim Sadykova — healthy, bout in 27 days */
    baselineExam("f-aigerim-sadykova", 290, {
        bloodwork: "Ferritin 28 µg/L (low-normal) with normal haemoglobin; alternate-day iron supplementation started.",
    }),
    routineExam("f-aigerim-sadykova", 228),
    routineExam("f-aigerim-sadykova", 170, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-aigerim-sadykova", 115),
    preFightExam("f-aigerim-sadykova", 61),
    exam({
        fighterId: "f-aigerim-sadykova",
        dayOffset: 59,
        type: "post_injury",
        label: "brow",
        hour: 11,
        outcome: "fit_with_restrictions",
        assessments: [
            {
                area: "Wound inspection — left eyebrow",
                result: "abnormal",
                note: "2 cm laceration closed with 4 sutures; edges well opposed, no signs of infection.",
            },
            { area: "Neurological screen", result: "normal", note: "No concussion symptoms; SCAT6 symptom score and balance at baseline." },
            { area: "Ophthalmic screen", result: "normal", note: "Eye movements full and pain-free; no visual disturbance." },
            { area: "Facial bones", result: "normal", note: "No orbital or nasal tenderness; no step deformity." },
        ],
        summary:
            "Post-bout review the morning after competition. Left eyebrow laceration from an accidental clash of heads, closed ringside. No signs of concussion.",
        recommendations:
            "No sparring or head contact until the wound has healed. Keep the wound clean and dry and apply ointment daily. Suture removal and wound review in 10 days.",
    }),
    exam({
        fighterId: "f-aigerim-sadykova",
        dayOffset: 49,
        type: "return_to_play",
        label: "review",
        hour: 11,
        assessments: [
            { area: "Wound review", result: "normal", note: "Sutures removed; wound fully healed with a well-formed, non-tender scar." },
            { area: "Neurological screen", result: "normal", note: "Asymptomatic." },
        ],
        summary: "Wound review 10 days after the bout. Laceration healed well.",
        recommendations: "Cleared for full training including sparring. Apply petroleum jelly over the scar before sparring for the next 4 weeks.",
    }),
    routineExam("f-aigerim-sadykova", 12, {
        summary: "Routine check during fight camp. Weight and iron status on track.",
        recommendations: "Continue alternate-day iron supplementation and the current weight plan. Pre-fight medical in fight week.",
        extra: [{ area: "Bloodwork", result: "normal", note: "Ferritin 46 µg/L — improved on supplementation; haemoglobin 13.6 g/dL." }],
    }),

    /* Kenji Morita — monitoring right shoulder */
    baselineExam("f-kenji-morita", 276),
    routineExam("f-kenji-morita", 219),
    routineExam("f-kenji-morita", 160),
    routineExam("f-kenji-morita", 101, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-kenji-morita", 45),
    exam({
        fighterId: "f-kenji-morita",
        dayOffset: 7,
        type: "routine",
        label: "shoulder",
        hour: 10,
        outcome: "fit_with_restrictions",
        followUpInDays: 5,
        assessments: [
            { area: "Active ROM", result: "normal", note: "Full active range; end-range discomfort in flexion and internal rotation on the right." },
            { area: "Hawkins–Kennedy", result: "abnormal", note: "Positive on the right (reproduces anterolateral shoulder pain); negative on the left." },
            { area: "Empty can", result: "normal", note: "5/5 strength bilaterally; no pain." },
            { area: "Painful arc", result: "abnormal", note: "Mild painful arc between 80° and 110° of abduction on the right." },
            { area: "Scapular control", result: "inconclusive", note: "Subtle early elevation of the right scapula with repeated overhead reaching." },
            { area: "Cột sống cổ", result: "normal", note: "Full, pain-free range; no referred symptoms." },
        ],
        summary:
            "Đánh giá trọng tâm vai phải sau quan sát AI về vai nâng lệch khi đấm thẳng tay sau. Dấu hiệu gợi ý chèn ép dưới mỏm cùng vai mức nhẹ; không có dấu hiệu rách chóp xoay hay mất vững. Chưa ghi nhận chấn thương ở giai đoạn này.",
        recommendations:
            "Cleared with restrictions: session intensity capped at RPE 8 and protect the right shoulder (limit high-volume power punching and overhead loading). Start scapular control and rotator cuff exercises. Consider ultrasound if symptoms have not settled at follow-up.",
    }),

    /* Diego Alvarez — concussion, not cleared */
    baselineExam("f-diego-alvarez", 265, {
        scat: "Symptom score 1/22, SAC 43/50, mBESS 2 errors.",
        musculoskeletal: "Full range. Right knee partial meniscectomy (2015) is asymptomatic with no effusion.",
    }),
    routineExam("f-diego-alvarez", 208),
    routineExam("f-diego-alvarez", 150),
    routineExam("f-diego-alvarez", 93, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-diego-alvarez", 37),
    exam({
        fighterId: "f-diego-alvarez",
        dayOffset: 6,
        type: "concussion_screen",
        label: "concussion",
        hour: 19,
        minute: 0,
        outcome: "unfit",
        vitals: { restingHeartRate: 66, bloodPressureSystolic: 126, bloodPressureDiastolic: 80 },
        assessments: [
            {
                area: "Red flag screen",
                result: "normal",
                note: "No red flags: GCS 15, no worsening headache, repeated vomiting, seizure or focal neurological signs.",
            },
            {
                area: "Đánh giá triệu chứng",
                result: "abnormal",
                note: "Symptom score 9/22, severity 21 (baseline 1/22): headache, dizziness, feeling 'in a fog', light sensitivity.",
            },
            { area: "Sàng lọc nhận thức (SAC)", result: "abnormal", note: "SAC 36/50 (baseline 43/50); reduced delayed recall and concentration." },
            { area: "Thăng bằng (mBESS)", result: "abnormal", note: "8 errors (baseline 2), mainly in tandem and single-leg stance." },
            { area: "Cột sống cổ", result: "normal", note: "Full, pain-free range; no midline tenderness." },
        ],
        summary:
            "Đánh giá trong vòng một giờ sau va chạm đầu khi đấu tập. Biểu hiện phù hợp chấn động não do thể thao. Không có dấu hiệu nguy hiểm; không cần chẩn đoán hình ảnh.",
        recommendations:
            "Not cleared to train. Relative rest for 24–48 hours with someone at home overnight; avoid alcohol and driving, limit screens while symptomatic. Paracetamol for headache as needed. Begin the graded return-to-training protocol as symptoms settle. Seek urgent care if symptoms worsen.",
    }),
    exam({
        fighterId: "f-diego-alvarez",
        dayOffset: 3,
        type: "concussion_screen",
        label: "concussion",
        hour: 10,
        outcome: "unfit",
        followUpInDays: 2,
        vitals: { restingHeartRate: 60 },
        assessments: [
            { area: "Đánh giá triệu chứng", result: "abnormal", note: "Điểm triệu chứng 3/22, mức độ 5: đau đầu nhẹ cuối ngày và mệt nhẹ." },
            { area: "Sàng lọc nhận thức (SAC)", result: "normal", note: "SAC 42/50 — đã trở về mức nền." },
            { area: "Thăng bằng (mBESS)", result: "abnormal", note: "4 lỗi (mức nền 2); đang cải thiện." },
            { area: "Cột sống cổ", result: "normal", note: "Đủ biên độ, không đau." },
            { area: "Khả năng chịu gắng sức", result: "normal", note: "Đi bộ 30 phút không tăng triệu chứng." },
        ],
        summary: "Tái khám ngày thứ 3. Cải thiện đều; triệu chứng nhẹ, không tăng khi vận động nhẹ.",
        recommendations:
            "Vẫn chưa được tập. Chuyển sang bậc 2 của phác đồ (aerobic nhẹ, không tập kháng lực). Tầm soát lại trước khi chuyển sang bài tập chuyên môn.",
    }),

    /* Linh Phạm — healthy */
    baselineExam("f-linh-pham", 298, {
        summary: "Khám nền khi gia nhập học viện. Không có chống chỉ định tập va chạm toàn phần hay thi đấu.",
    }),
    routineExam("f-linh-pham", 240),
    routineExam("f-linh-pham", 178),
    routineExam("f-linh-pham", 113, {
        summary: "Khám định kỳ và gia hạn giấy phép sau khi giấy phép trước hết hạn. Không chấn thương hay bệnh trong thời gian qua.",
        recommendations: RENEWAL_RECOMMENDATIONS,
    }),
    routineExam("f-linh-pham", 55),

    /* Marcus Hale — right 5th metacarpal fracture */
    baselineExam("f-marcus-hale", 255),
    routineExam("f-marcus-hale", 198),
    routineExam("f-marcus-hale", 141),
    routineExam("f-marcus-hale", 84, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-marcus-hale", 30),
    exam({
        fighterId: "f-marcus-hale",
        dayOffset: 10,
        type: "post_injury",
        label: "hand",
        hour: 9,
        outcome: "fit_with_restrictions",
        followUpInDays: 18,
        assessments: [
            { area: "Inspection — right hand", result: "abnormal", note: "Swelling over the ulnar border of the hand with loss of the 5th knuckle contour." },
            { area: "Palpation", result: "abnormal", note: "Point tenderness over the 5th metacarpal neck." },
            { area: "Rotational alignment", result: "normal", note: "No finger scissoring on composite fist; nail plates aligned." },
            { area: "Neurovascular status", result: "normal", note: "Sensation and capillary refill intact in all digits." },
            { area: "Da", result: "normal", note: "Skin intact over the knuckle; no wound." },
            { area: "Imaging review", result: "abnormal", note: "X-ray: 5th metacarpal neck fracture, 15° volar angulation, no intra-articular extension." },
        ],
        summary:
            "Khám sáng hôm sau chấn thương khi đánh bao. Gãy kín cổ xương bàn tay V phải, di lệch gập góc ít, phù hợp điều trị bảo tồn.",
        recommendations:
            "Ulnar gutter splint for 4 weeks with a repeat X-ray at 1 week. Cleared with restrictions: no striking with the right hand and no heavy bag, pad work or sparring; footwork, lower-body strength and conditioning are fine. Review with X-ray at 4 weeks.",
    }),

    /* Sofia Kowalski — healthy, clearance renewal due */
    baselineExam("f-sofia-kowalski", 359),
    routineExam("f-sofia-kowalski", 300),
    routineExam("f-sofia-kowalski", 238),
    routineExam("f-sofia-kowalski", 177, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-sofia-kowalski", 118),
    exam({
        fighterId: "f-sofia-kowalski",
        dayOffset: 94,
        type: "post_injury",
        label: "ribs",
        assessments: [
            {
                area: "Palpation — left lower ribs",
                result: "abnormal",
                note: "Localised tenderness over the 9th–10th ribs in the mid-axillary line; no crepitus or step.",
            },
            { area: "Rib springing", result: "normal", note: "Anterior–posterior compression does not reproduce sharp pain." },
            { area: "Hô hấp", result: "normal", note: "Breath sounds equal and clear; SpO2 99%." },
            { area: "Pain on movement", result: "abnormal", note: "Pain on deep breathing and trunk rotation (4/10)." },
        ],
        summary:
            "Review the day after a knee-on-belly in grappling rounds. Findings consistent with a left lower rib contusion; no clinical signs of fracture or lung involvement.",
        recommendations:
            "Pain-guided training: ease off live grappling and chest-loaded positions until deep breathing is comfortable (usually 1–2 weeks). Paracetamol as needed. Return promptly if breathlessness develops.",
    }),
    routineExam("f-sofia-kowalski", 35, {
        followUpInDays: 4,
        summary: "Routine check ahead of Lotus Fight Night 17. No health concerns; weight on track.",
        recommendations: "Pre-fight medical and Medical Clearance renewal booked before the current clearance expires.",
    }),

    /* Hoàng Long — monitoring low back and weight cut */
    baselineExam("f-hoang-long", 324),
    routineExam("f-hoang-long", 266),
    routineExam("f-hoang-long", 204),
    routineExam("f-hoang-long", 142, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-hoang-long", 80),
    routineExam("f-hoang-long", 12, {
        followUpInDays: 2,
        vitals: { hydration: "fair", restingHeartRate: 61 },
        musculoskeletal: {
            area: "Sàng lọc cơ xương khớp",
            result: "abnormal",
            note: "Paraspinal tightness L3–L5 bilaterally; full lumbar flexion with end-range discomfort. No radicular signs; neurological examination normal.",
        },
        weight: (v) => ({
            area: "Cân nặng & mức nước",
            result: "abnormal",
            note: `${weightNote("f-hoang-long", v.weightKg)} Urine specific gravity 1.026 — fair hydration.`,
        }),
        summary:
            "Khám định kỳ trong giai đoạn giảm cân. Cảm thấy căng thắt lưng sau buổi tập dài; không có dấu hiệu thần kinh. Mức nước khi đến chỉ ở mức trung bình.",
        recommendations:
            "Fit to train. Keep the cut to about 1% of body weight per week and avoid fluid restriction outside fight week. Daily lumbar mobility routine. Weight and hydration check in 2 weeks.",
    }),

    /* Tariq Haddad — left knee MCL sprain, recovery */
    baselineExam("f-tariq-haddad", 310, {
        musculoskeletal: "Full range. Right ACL reconstruction (2019) is stable with symmetrical hop tests.",
    }),
    routineExam("f-tariq-haddad", 252),
    routineExam("f-tariq-haddad", 190),
    routineExam("f-tariq-haddad", 128, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-tariq-haddad", 70),
    exam({
        fighterId: "f-tariq-haddad",
        dayOffset: 37,
        type: "post_injury",
        label: "injury",
        hour: 11,
        outcome: "fit_with_restrictions",
        assessments: [
            { area: "Inspection", result: "abnormal", note: "Mild swelling over the medial left knee; no joint effusion." },
            { area: "Valgus stress test (30°)", result: "abnormal", note: "Pain with minimal opening and a firm end-feel (grade I)." },
            { area: "Valgus stress test (0°)", result: "normal", note: "Stable in full extension." },
            { area: "Lachman", result: "normal", note: "Firm end-point; symmetrical with the reconstructed right knee." },
            { area: "McMurray", result: "normal", note: "No meniscal signs." },
            { area: "Gait", result: "abnormal", note: "Mild antalgic gait." },
        ],
        summary:
            "Assessment the day after a left knee valgus injury in a conditioning circuit. Findings consistent with a grade I MCL sprain; cruciate ligaments and menisci clinically intact. Ultrasound requested given his previous right ACL reconstruction.",
        recommendations:
            "Cleared with restrictions: upper-body boxing technique and conditioning only — no sparring, kicks, running or jumping; session intensity capped at RPE 6. Hinged brace for 3 weeks. Physiotherapy for range of motion and quadriceps activation.",
    }),
    exam({
        fighterId: "f-tariq-haddad",
        dayOffset: 21,
        type: "post_injury",
        label: "review",
        hour: 11,
        outcome: "fit_with_restrictions",
        assessments: [
            { area: "Valgus stress test (30°)", result: "normal", note: "Pain-free with a firm end-feel." },
            { area: "Biên độ vận động", result: "normal", note: "0–140°, symmetrical." },
            { area: "Sức mạnh", result: "abnormal", note: "Quadriceps strength 82% of the right side." },
            { area: "Single-leg squat", result: "inconclusive", note: "Mild dynamic valgus with fatigue." },
        ],
        summary: "Two-week review. Ligament pain-free on stress testing with full range; strength and control still building.",
        recommendations: "Restrictions unchanged. Wean off the brace over the next 5 days, progress strength rehab and start straight-line running.",
    }),
    exam({
        fighterId: "f-tariq-haddad",
        dayOffset: 5,
        type: "return_to_play",
        label: "rtp",
        hour: 8,
        minute: 30,
        outcome: "fit_with_restrictions",
        followUpInDays: 6,
        assessments: [
            { area: "Valgus stress test (30°)", result: "normal", note: "Stable and pain-free." },
            { area: "Sức mạnh", result: "normal", note: "Quadriceps 93% and hamstrings 95% of the right side." },
            { area: "Single-leg hop tests", result: "normal", note: "Hop for distance 91% and triple hop 90% of the right side." },
            { area: "Change of direction", result: "inconclusive", note: "Pain-free but cautious on sharp cuts to the left." },
            { area: "Footwork under fatigue", result: "normal", note: "Pivots and lateral movement on pads without symptoms." },
        ],
        summary:
            "Return-to-training assessment. Meets strength and hop criteria for sport-specific training; confidence on sharp cutting is still developing.",
        recommendations:
            "Cleared with restrictions: no sparring, no kicks, session intensity capped at RPE 8, protect the left knee. Full pad, bag and footwork training allowed. Final review before lifting restrictions.",
    }),

    /* Emma Lindqvist — healthy, previous ankle sprain */
    baselineExam("f-emma-lindqvist", 335, {
        respiratory: "Clear at rest. Known mild exercise-induced asthma, well controlled with a reliever before intense sessions.",
    }),
    routineExam("f-emma-lindqvist", 272),
    exam({
        fighterId: "f-emma-lindqvist",
        dayOffset: 209,
        type: "post_injury",
        label: "ankle",
        outcome: "fit_with_restrictions",
        assessments: [
            { area: "Inspection", result: "abnormal", note: "Moderate swelling and bruising around the lateral malleolus." },
            {
                area: "Tiêu chuẩn Ottawa cổ chân",
                result: "normal",
                note: "No bony tenderness at the malleoli, navicular or 5th metatarsal base; able to weight-bear. X-ray not indicated.",
            },
            { area: "Anterior drawer", result: "abnormal", note: "Increased laxity with a soft end-point compared with the right." },
            { area: "Talar tilt", result: "normal", note: "No calcaneofibular ligament laxity." },
            { area: "Biên độ vận động", result: "abnormal", note: "Dorsiflexion limited by pain and swelling." },
        ],
        summary:
            "Khám sáng hôm sau chấn thương lật cổ chân khi đấu tập. Dấu hiệu phù hợp bong gân dây chằng sên mác trước độ II; không có dấu hiệu gãy xương.",
        recommendations:
            "Cleared with restrictions: no sparring, no kicks and no jumping or cutting; upper-body and seated conditioning allowed. Compression, elevation and early protected weight-bearing. Start physiotherapy this week.",
    }),
    exam({
        fighterId: "f-emma-lindqvist",
        dayOffset: 172,
        type: "return_to_play",
        label: "rtp",
        hour: 11,
        assessments: [
            { area: "Anterior drawer", result: "normal", note: "Firm end-point, symmetrical." },
            { area: "Y-balance test", result: "normal", note: "Composite reach 97% of the right side." },
            { area: "Single-leg hop tests", result: "normal", note: "Hop for distance 96% of the right side." },
            { area: "Sport-specific drills", result: "normal", note: "Full-intensity kicks and switch kicks on pads without symptoms." },
        ],
        summary: "Đánh giá trở lại tập sau bong gân cổ chân trái. Đạt mọi tiêu chí trở lại.",
        recommendations:
            "Cleared for full training including sparring. Continue balance work twice a week for 3 months; a lace-up brace is optional for sparring.",
    }),
    routineExam("f-emma-lindqvist", 130),
    routineExam("f-emma-lindqvist", 80, { summary: RENEWAL_SUMMARY, recommendations: RENEWAL_RECOMMENDATIONS }),
    routineExam("f-emma-lindqvist", 24),
];

/* ─── Injuries ────────────────────────────────────────────────────────────── */

export const mockInjuries: Injury[] = [
    {
        id: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        recordedById: THU_LE,
        type: "strain",
        bodyRegion: "left_hamstring",
        severity: "moderate",
        status: "recovering",
        mechanism: "sparring",
        occurredAt: daysAgo(24, 18, 35),
        diagnosedAt: daysAgo(23, 10, 30),
        description:
            "Felt a sharp pull in the left posterior thigh during a scramble in sparring; unable to continue. Tenderness mid-belly of the biceps femoris with painful resisted knee flexion. MRI confirms a grade II strain of the biceps femoris long head.",
        expectedReturnAt: daysFromNow(18, 9, 0),
        resolvedAt: null,
        linkedAlertId: null,
    },
    {
        id: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        recordedById: THU_LE,
        type: "concussion",
        bodyRegion: "head",
        severity: "moderate",
        status: "active",
        mechanism: "sparring",
        occurredAt: daysAgo(6, 18, 24),
        diagnosedAt: daysAgo(6, 19, 20),
        description:
            "Trúng đòn tay phải gọn khi tách ôm ở hiệp 3 đấu tập. Không mất ý thức; chậm hồi thế thủ, sau đó đau đầu, chóng mặt và cảm giác 'mơ hồ'. HLV dừng buổi tập. SCAT6 buổi tối cho điểm triệu chứng, nhận thức và thăng bằng thấp hơn mức nền; không có dấu hiệu nguy hiểm.",
        expectedReturnAt: daysFromNow(10, 9, 0),
        resolvedAt: null,
        linkedAlertId: "al-diego-balance-6d",
    },
    {
        id: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        recordedById: THU_LE,
        type: "fracture",
        bodyRegion: "right_hand",
        severity: "moderate",
        status: "active",
        mechanism: "heavy_bag",
        occurredAt: daysAgo(11, 16, 40),
        diagnosedAt: daysAgo(11, 19, 15),
        description:
            "Immediate pain over the right little-finger knuckle after a right cross on the heavy bag in round 4; session stopped. Swelling and point tenderness over the 5th metacarpal neck with a depressed knuckle; no rotational deformity. X-ray confirms a closed 5th metacarpal neck fracture with 15° volar angulation, managed non-operatively.",
        expectedReturnAt: daysFromNow(31, 9, 0),
        resolvedAt: null,
        linkedAlertId: "al-marcus-hand-11d",
    },
    {
        id: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        recordedById: SAMUEL_BROOKS,
        type: "sprain",
        bodyRegion: "left_knee",
        severity: "minor",
        status: "recovering",
        mechanism: "strength_conditioning",
        occurredAt: daysAgo(38, 10, 20),
        diagnosedAt: daysAgo(37, 11, 0),
        description:
            "Felt medial left knee pain when the knee buckled inward during a lateral lunge in a conditioning circuit; walked off with a mild limp. Tender over the medial collateral ligament, valgus stress at 30° painful with a firm end-feel; Lachman and McMurray negative. Ultrasound consistent with a grade I MCL sprain.",
        expectedReturnAt: daysFromNow(6, 9, 0),
        resolvedAt: null,
        linkedAlertId: null,
    },
    {
        id: "inj-minh-shin",
        fighterId: "f-minh-tran",
        recordedById: THU_LE,
        type: "contusion",
        bodyRegion: "right_shin",
        severity: "minor",
        status: "resolved",
        mechanism: "competition",
        occurredAt: daysAgo(150, 21, 40),
        diagnosedAt: daysAgo(149, 10, 0),
        description:
            "Repeated checked kicks during his bout left bruising and a firm haematoma over the right anterior shin. No bony tenderness and pain-free hopping, so imaging was not indicated.",
        expectedReturnAt: daysAgo(140, 9, 0),
        resolvedAt: daysAgo(139, 10, 0),
        linkedAlertId: null,
    },
    {
        id: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        recordedById: THU_LE,
        type: "sprain",
        bodyRegion: "left_ankle",
        severity: "moderate",
        status: "resolved",
        mechanism: "sparring",
        occurredAt: daysAgo(210, 18, 45),
        diagnosedAt: daysAgo(209, 10, 0),
        description:
            "Lật cổ chân trái khi tiếp đất sau cú đá đổi chân bị chặn lúc đấu tập. Sưng và đau tại dây chằng sên mác trước, nghiệm pháp ngăn kéo trước lỏng hơn; tiêu chuẩn Ottawa âm tính. Phù hợp bong gân cổ chân ngoài độ II.",
        expectedReturnAt: daysAgo(172, 9, 0),
        resolvedAt: daysAgo(172, 12, 0),
        linkedAlertId: null,
    },
    {
        id: "inj-sofia-ribs",
        fighterId: "f-sofia-kowalski",
        recordedById: SAMUEL_BROOKS,
        type: "contusion",
        bodyRegion: "ribs",
        severity: "minor",
        status: "resolved",
        mechanism: "grappling",
        occurredAt: daysAgo(95, 17, 20),
        diagnosedAt: daysAgo(94, 10, 0),
        description:
            "Took a knee-on-belly during grappling rounds. Localised pain over the left 9th–10th ribs on deep breathing and trunk rotation; no crepitus or deformity and normal breath sounds. Consistent with a rib contusion.",
        expectedReturnAt: daysAgo(81, 9, 0),
        resolvedAt: daysAgo(82, 10, 0),
        linkedAlertId: null,
    },
    {
        id: "inj-aigerim-brow",
        fighterId: "f-aigerim-sadykova",
        recordedById: SAMUEL_BROOKS,
        type: "laceration",
        bodyRegion: "head",
        severity: "minor",
        status: "resolved",
        mechanism: "competition",
        occurredAt: daysAgo(60, 20, 45),
        diagnosedAt: daysAgo(60, 21, 30),
        description:
            "2 cm laceration over the left eyebrow from an accidental clash of heads in round 2 of her bout. Closed ringside with 4 sutures. No concussion symptoms; SCAT6 at baseline.",
        expectedReturnAt: daysAgo(49, 9, 0),
        resolvedAt: daysAgo(49, 11, 0),
        linkedAlertId: null,
    },
];

/* ─── Treatments ──────────────────────────────────────────────────────────── */

export const mockTreatments: Treatment[] = [
    // Lucas — left hamstring strain
    {
        id: "tr-lucas-ice",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: THU_LE_NAME,
        type: "ice_compression",
        description: "Relative rest, ice and compression — first 72 hours",
        frequency: "Ice 15 min every 2–3 hours while awake",
        startDate: daysAgo(24, 19, 30),
        endDate: daysAgo(21, 19, 0),
        status: "completed",
        notes: "Crutches not required; walking pain-free by day 3.",
    },
    {
        id: "tr-lucas-mri",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: THU_LE_NAME,
        type: "imaging",
        description: "MRI left thigh",
        frequency: "Single scan",
        startDate: daysAgo(22, 14, 0),
        endDate: daysAgo(22, 15, 0),
        status: "completed",
        notes: "Grade II strain of the biceps femoris long head; intramuscular tendon intact.",
    },
    {
        id: "tr-lucas-physio",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: SAMUEL_BROOKS_NAME,
        type: "physiotherapy",
        description: "Physiotherapy — progressive loading (Nordic curls, isometrics)",
        frequency: "3 lần/tuần",
        startDate: daysAgo(20, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Progressed from isometrics to Nordic curls 3×6. Next: high-speed loading.",
    },
    {
        id: "tr-lucas-soft-tissue",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: LOTUS_PHYSIO,
        type: "manual_therapy",
        description: "Soft-tissue therapy — posterior chain",
        frequency: "2× per week",
        startDate: daysAgo(14, 15, 0),
        endDate: null,
        status: "ongoing",
        notes: null,
    },
    {
        id: "tr-lucas-running",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: SAMUEL_BROOKS_NAME,
        type: "physiotherapy",
        description: "Running progression — 50% to 90% of max velocity",
        frequency: "3× per week, non-consecutive days",
        startDate: daysAgo(10, 16, 0),
        endDate: null,
        status: "ongoing",
        notes: "Currently at 80% of max velocity without symptoms.",
    },

    // Diego — concussion
    {
        id: "tr-diego-rest",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "rest",
        description: "Nghỉ tương đối (trí óc & thể chất)",
        frequency: "Liên tục trong 48 giờ đầu",
        startDate: daysAgo(6, 20, 0),
        endDate: daysAgo(4, 20, 0),
        status: "completed",
        notes: "Giảm thời gian dùng màn hình, đi bộ ngắn theo khả năng, nghỉ làm hai ngày.",
    },
    {
        id: "tr-diego-analgesia",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "medication",
        description: "Giảm đau — paracetamol khi đau đầu",
        frequency: "Tối đa 4 lần/ngày",
        startDate: daysAgo(6, 20, 0),
        endDate: daysAgo(3, 10, 0),
        status: "completed",
        notes: "Tránh NSAID và aspirin trong 48 giờ đầu.",
    },
    {
        id: "tr-diego-monitoring",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "rest",
        description: "Theo dõi triệu chứng",
        frequency: "Bảng kiểm triệu chứng hằng ngày; tầm soát lại trước mỗi bậc",
        startDate: daysAgo(5, 9, 0),
        endDate: null,
        status: "ongoing",
        notes: "Triệu chứng giảm dần; không có dấu hiệu nguy hiểm.",
    },
    {
        id: "tr-diego-protocol",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "physiotherapy",
        description: "Phác đồ trở lại tập theo bậc",
        frequency: "Hằng ngày; mỗi bậc ít nhất 24 giờ không triệu chứng",
        startDate: daysAgo(3, 11, 0),
        endDate: null,
        status: "ongoing",
        notes: "Hiện ở bậc 2 — aerobic nhẹ.",
    },

    // Marcus — right 5th metacarpal fracture
    {
        id: "tr-marcus-analgesia",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "medication",
        description: "Giảm đau — paracetamol khi cần",
        frequency: "Up to 4× daily for the first week",
        startDate: daysAgo(11, 19, 30),
        endDate: daysAgo(4, 9, 0),
        status: "completed",
        notes: "NSAIDs avoided during early fracture healing.",
    },
    {
        id: "tr-marcus-immobilisation",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "immobilisation",
        description: "Immobilisation — ulnar gutter splint 4 weeks",
        frequency: "Worn continuously; removed only for skin checks",
        startDate: daysAgo(10, 9, 30),
        endDate: daysFromNow(18, 9, 30),
        status: "ongoing",
        notes: "Ring and little fingers included with the knuckles flexed at 70°.",
    },
    {
        id: "tr-marcus-xray",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "imaging",
        description: "Imaging follow-up X-ray",
        frequency: "At 1 week and 4 weeks",
        startDate: daysAgo(3, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "1-week film: alignment maintained, angulation unchanged at 15°. 4-week film due at splint removal.",
    },
    {
        id: "tr-marcus-hand-therapy",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: SAMUEL_BROOKS_NAME,
        type: "specialist_referral",
        description: "Hand therapy referral",
        frequency: "2× per week after splint removal",
        startDate: daysFromNow(18, 14, 0),
        endDate: null,
        status: "planned",
        notes: null,
    },

    // Tariq — left knee MCL sprain
    {
        id: "tr-tariq-ice",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "ice_compression",
        description: "Ice, compression and elevation",
        frequency: "15 min 3–4× daily",
        startDate: daysAgo(38, 12, 0),
        endDate: daysAgo(34, 12, 0),
        status: "completed",
        notes: null,
    },
    {
        id: "tr-tariq-ultrasound",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "imaging",
        description: "Ultrasound left knee",
        frequency: "Single scan",
        startDate: daysAgo(36, 14, 0),
        endDate: daysAgo(36, 14, 30),
        status: "completed",
        notes: "Thickened proximal MCL fibres consistent with a grade I sprain; no full-thickness tear or effusion.",
    },
    {
        id: "tr-tariq-brace",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "immobilisation",
        description: "Hinged brace",
        frequency: "Worn for training and daily activity, 3 weeks",
        startDate: daysAgo(37, 12, 0),
        endDate: daysAgo(16, 12, 0),
        status: "completed",
        notes: "Weaned off after the two-week review.",
    },
    {
        id: "tr-tariq-strength",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: LOTUS_PHYSIO,
        type: "strength_rehab",
        description: "Strength rehab — quadriceps, hip and adductor strengthening",
        frequency: "3 lần/tuần",
        startDate: daysAgo(30, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Quadriceps strength 93% of the right side at the last test.",
    },
    {
        id: "tr-tariq-agility",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "physiotherapy",
        description: "Agility progression",
        frequency: "3 lần/tuần",
        startDate: daysAgo(10, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Lateral shuffles, pivots and cutting drills; sharp cuts to the left still progressing.",
    },

    // Minh — right shin contusion (resolved)
    {
        id: "tr-minh-ice",
        injuryId: "inj-minh-shin",
        fighterId: "f-minh-tran",
        providerName: THU_LE_NAME,
        type: "ice_compression",
        description: "Ice and compression",
        frequency: "15 min 3–4× daily for 72 hours",
        startDate: daysAgo(149, 10, 30),
        endDate: daysAgo(146, 10, 30),
        status: "completed",
        notes: null,
    },
    {
        id: "tr-minh-rest",
        injuryId: "inj-minh-shin",
        fighterId: "f-minh-tran",
        providerName: THU_LE_NAME,
        type: "rest",
        description: "Relative rest — post-bout rest week",
        frequency: "7 days, then a pain-guided return to kicking",
        startDate: daysAgo(149, 10, 30),
        endDate: daysAgo(142, 10, 0),
        status: "completed",
        notes: "Haematoma resolved; full kicking resumed on day 10.",
    },

    // Emma — left ankle sprain (resolved)
    {
        id: "tr-emma-compression",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        providerName: THU_LE_NAME,
        type: "ice_compression",
        description: "Băng ép, kê cao và chịu lực có bảo vệ",
        frequency: "Băng ép hằng ngày; kê cao 3 lần/ngày",
        startDate: daysAgo(209, 10, 30),
        endDate: daysAgo(203, 10, 0),
        status: "completed",
        notes: null,
    },
    {
        id: "tr-emma-physio",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        providerName: LOTUS_PHYSIO,
        type: "physiotherapy",
        description: "Vật lý trị liệu — chương trình thăng bằng và cảm thụ bản thể",
        frequency: "3 lần/tuần",
        startDate: daysAgo(205, 15, 0),
        endDate: daysAgo(174, 15, 0),
        status: "completed",
        notes: "Chỉ số Y-balance tổng hợp đạt 97% bên phải khi kết thúc.",
    },
    {
        id: "tr-emma-strength",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        providerName: LOTUS_PHYSIO,
        type: "strength_rehab",
        description: "Phục hồi sức mạnh — tăng sức cơ bắp chân và cơ mác",
        frequency: "3 lần/tuần",
        startDate: daysAgo(200, 15, 0),
        endDate: daysAgo(172, 15, 0),
        status: "completed",
        notes: null,
    },

    // Sofia — rib contusion (resolved)
    {
        id: "tr-sofia-analgesia",
        injuryId: "inj-sofia-ribs",
        fighterId: "f-sofia-kowalski",
        providerName: SAMUEL_BROOKS_NAME,
        type: "medication",
        description: "Giảm đau — paracetamol khi cần",
        frequency: "Tối đa 4 lần/ngày",
        startDate: daysAgo(94, 10, 30),
        endDate: daysAgo(88, 10, 0),
        status: "completed",
        notes: null,
    },
    {
        id: "tr-sofia-modified-training",
        injuryId: "inj-sofia-ribs",
        fighterId: "f-sofia-kowalski",
        providerName: SAMUEL_BROOKS_NAME,
        type: "rest",
        description: "Modified training — no live grappling until breathing is pain-free",
        frequency: "Until symptom-free",
        startDate: daysAgo(94, 10, 30),
        endDate: daysAgo(82, 10, 0),
        status: "completed",
        notes: "Returned to live randori on day 13.",
    },

    // Aigerim — eyebrow laceration (resolved)
    {
        id: "tr-aigerim-wound-care",
        injuryId: "inj-aigerim-brow",
        fighterId: "f-aigerim-sadykova",
        providerName: SAMUEL_BROOKS_NAME,
        type: "medication",
        description: "Wound care — daily cleaning and topical antibiotic ointment",
        frequency: "Daily until suture removal",
        startDate: daysAgo(59, 11, 0),
        endDate: daysAgo(49, 11, 0),
        status: "completed",
        notes: null,
    },
    {
        id: "tr-aigerim-no-contact",
        injuryId: "inj-aigerim-brow",
        fighterId: "f-aigerim-sadykova",
        providerName: SAMUEL_BROOKS_NAME,
        type: "rest",
        description: "No sparring or head contact until wound review",
        frequency: "10 ngày",
        startDate: daysAgo(59, 11, 0),
        endDate: daysAgo(49, 11, 0),
        status: "completed",
        notes: "Sutures removed at review; scar well healed.",
    },
];

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

interface PhaseSeed {
    name: string;
    goal: string;
    /** Start and end as days from today (negative = past). */
    from: number;
    to: number;
    status: RecoveryPhaseStatus;
    milestones: [label: string, done: boolean][];
}

function phases(planId: string, seeds: PhaseSeed[]): RecoveryPhase[] {
    return seeds.map((seed, index) => ({
        id: `${planId}-phase-${index + 1}`,
        name: seed.name,
        goal: seed.goal,
        startDate: fromToday(seed.from, 9, 0),
        endDate: fromToday(seed.to, 18, 0),
        status: seed.status,
        milestones: seed.milestones.map(([label, done]) => ({ label, done })),
    }));
}

interface RecoveryMarkers {
    pain: number;
    mobility: number;
    strength: number;
}

/**
 * Check-ins trending from `start` to `end` markers. Progress is front-loaded (recovery
 * is fastest early) with small seeded noise so the series looks measured, not drawn.
 */
function checkIns(
    seed: string,
    points: [dayOffset: number, note: string, hour?: number, minute?: number][],
    start: RecoveryMarkers,
    end: RecoveryMarkers,
): RecoveryCheckIn[] {
    const rng = createRandom(`checkins:${seed}`);
    const lastIndex = Math.max(points.length - 1, 1);
    return points.map(([dayOffset, note, hour = 8, minute = 30], index) => {
        const progress = 1 - (1 - index / lastIndex) ** 1.5;
        const at = (from: number, to: number) => from + (to - from) * progress;
        return {
            date: clampPastToday(daysAgo(dayOffset, hour, minute)),
            painLevel: clamp(Math.round(at(start.pain, end.pain) + rng.jitter(0.3)), 0, 10),
            mobilityPct: clamp(Math.round(at(start.mobility, end.mobility) + rng.jitter(1.5)), 0, 100),
            strengthPct: clamp(Math.round(at(start.strength, end.strength) + rng.jitter(1.5)), 0, 100),
            note,
        };
    });
}

export const mockRecoveryPlans: RecoveryPlan[] = [
    {
        id: "rp-lucas-hamstring",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        doctorId: SAMUEL_BROOKS,
        title: "Căng cơ đùi sau trái — trở lại tập vật",
        startDate: daysAgo(23, 10, 45),
        targetReturnDate: daysFromNow(18, 18, 0),
        status: "active",
        phases: phases("rp-lucas-hamstring", [
            {
                name: "Protection & pain control",
                goal: "Settle pain and protect the healing muscle while keeping the rest of the body moving.",
                from: -23,
                to: -19,
                status: "completed",
                milestones: [
                    ["Pain-free walking", true],
                    ["MRI reviewed and strain grade confirmed", true],
                ],
            },
            {
                name: "Early loading & mobility",
                goal: "Restore range of motion and start pain-free isometric loading.",
                from: -19,
                to: -10,
                status: "completed",
                milestones: [
                    ["Pain-free isometric holds at 90°, 60° and 30°", true],
                    ["Active knee extension within 10° of the right side", true],
                    ["Return-to-training review passed", true],
                ],
            },
            {
                name: "Tăng sức mạnh dần",
                goal: "Build eccentric hamstring strength and restore running mechanics.",
                from: -10,
                to: 4,
                status: "current",
                milestones: [
                    ["Nordic curls 3×6 without pain", true],
                    ["Running at 70% of max velocity pain-free", true],
                    ["Hamstring strength ≥ 90% of the right side", false],
                    ["Sprints at 90% of max velocity pain-free", false],
                ],
            },
            {
                name: "Sport-specific reconditioning",
                goal: "Reintroduce explosive grappling movements and kicking progressively.",
                from: 4,
                to: 12,
                status: "upcoming",
                milestones: [
                    ["Full-speed sprints and changes of direction", false],
                    ["Positional grappling drills without symptoms", false],
                    ["Kicks on pads at 50% effort without symptoms", false],
                ],
            },
            {
                name: "Trở lại tập đầy đủ",
                goal: "Tolerate full training weeks, including live rounds, before restrictions are lifted.",
                from: 12,
                to: 18,
                status: "upcoming",
                milestones: [
                    ["Live grappling rounds without symptoms", false],
                    ["Hamstring strength ≥ 95% of the right side", false],
                    ["Đạt đánh giá trở lại tập", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-lucas-hamstring",
            [
                [22, "Pain on stairs and when bending; short walks comfortable. Compression and gentle isometrics."],
                [19, "Walking pain-free. Isometric holds at 90° and 60° tolerated well."],
                [17, "Bài cầu mông và đẳng trường ở 30° không đau; không bùng phát sau bài tập giai đoạn 2. Đạp xe tại chỗ 20 phút.", 18, 10],
                [13, "Started eccentric slider curls. Mild tightness next morning, settled by midday."],
                [10, "Return-to-training review passed with restrictions. Jogging and strides at 60% pain-free."],
                [7, "Nordic curls 3×5 introduced. Running at 70% effort without symptoms."],
                [4, "Nordic curls 3×6 pain-free. Technical grappling drills (no live rolling) at RPE 6."],
                [1, "Hơi căng sau chạy nước rút 80%, hết vào buổi tối. Kiểm tra lại sức mạnh khi đánh giá giai đoạn.", 13, 42],
            ],
            { pain: 5, mobility: 58, strength: 45 },
            { pain: 1, mobility: 93, strength: 86 },
        ),
    },
    {
        id: "rp-diego-concussion",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        doctorId: THU_LE,
        title: "Phác đồ trở lại tập theo bậc",
        startDate: daysAgo(6, 20, 0),
        targetReturnDate: daysFromNow(10, 18, 0),
        status: "active",
        phases: phases("rp-diego-concussion", [
            {
                name: "Hoạt động giới hạn theo triệu chứng",
                goal: "Nghỉ tương đối 24–48 giờ đầu, sau đó sinh hoạt hằng ngày không gây triệu chứng.",
                from: -6,
                to: -3,
                status: "completed",
                milestones: [
                    ["Hoàn tất 24–48 giờ nghỉ tương đối", true],
                    ["Sinh hoạt hằng ngày không làm nặng triệu chứng", true],
                ],
            },
            {
                name: "Tập aerobic nhẹ",
                goal: "Đi bộ hoặc đạp xe tại chỗ nhịp chậm đến vừa để tăng nhịp tim; không tập kháng lực.",
                from: -3,
                to: 1,
                status: "current",
                milestones: [
                    ["Đi bộ 30 phút không tăng triệu chứng", true],
                    ["Đạp xe tại chỗ 20 phút ở ≤ 55% nhịp tim tối đa", true],
                    ["Chịu được buổi aerobic vừa (≤ 70% nhịp tim tối đa)", false],
                    ["Không triệu chứng khi nghỉ", false],
                ],
            },
            {
                name: "Bài tập chuyên môn (không va chạm)",
                goal: "Bài tập cá nhân không va chạm — chạy, nhảy dây và đánh gió.",
                from: 1,
                to: 3,
                status: "upcoming",
                milestones: [
                    ["Chạy và nhảy dây không triệu chứng", false],
                    ["Đánh gió và tập bộ pháp không triệu chứng", false],
                ],
            },
            {
                name: "Bài tập không va chạm",
                goal: "Bài tập nặng hơn không có nguy cơ va chạm đầu, kèm tập kháng lực. Phải hết triệu chứng.",
                from: 3,
                to: 6,
                status: "upcoming",
                milestones: [
                    ["Đánh đích và tập kỹ thuật vật (không đấu thật) không triệu chứng", false],
                    ["Đã tập lại kháng lực", false],
                    ["SCAT6 trở về mức nền", false],
                ],
            },
            {
                name: "Tập va chạm toàn phần (sau khi có giấy phép)",
                goal: "Tập bình thường kể cả va chạm có kiểm soát, chỉ sau khi bác sĩ cấp phép.",
                from: 6,
                to: 9,
                status: "upcoming",
                milestones: [
                    ["Giấy phép tập va chạm", false],
                    ["Đấu tập có kiểm soát và vật thật không triệu chứng", false],
                ],
            },
            {
                name: "Trở lại thi đấu",
                goal: "Tập không hạn chế và đủ điều kiện thi đấu.",
                from: 9,
                to: 10,
                status: "upcoming",
                milestones: [
                    ["Một tuần tập đầy đủ không triệu chứng", false],
                    ["Giấy phép được nâng lên đầy đủ", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-diego-concussion",
            [
                [5, "Đau đầu và nhạy cảm ánh sáng khi thức dậy; ngủ kém. Tiếp tục nghỉ tương đối."],
                [3, "Triệu chứng giảm; đi bộ 30 phút không nặng hơn. Chuyển sang bậc aerobic nhẹ sau khi đánh giá."],
                [1, "Chịu được đạp xe tại chỗ 20 phút ở ≤ 55% nhịp tim tối đa. Chỉ đau đầu nhẹ cuối ngày."],
            ],
            { pain: 5, mobility: 90, strength: 90 },
            { pain: 2, mobility: 98, strength: 95 },
        ),
    },
    {
        id: "rp-marcus-hand",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        doctorId: THU_LE,
        title: "Gãy xương bàn tay V phải — trở lại ra đòn",
        startDate: daysAgo(10, 9, 30),
        targetReturnDate: daysFromNow(31, 18, 0),
        status: "active",
        phases: phases("rp-marcus-hand", [
            {
                name: "Bảo vệ & bất động",
                goal: "Protect the fracture in the splint while maintaining lower-body strength and conditioning.",
                from: -10,
                to: 18,
                status: "current",
                milestones: [
                    ["Splint fitted and skin checked", true],
                    ["1-week X-ray shows maintained alignment", true],
                    ["Pain ≤ 2/10 with daily tasks", true],
                    ["4-week X-ray shows fracture healing", false],
                ],
            },
            {
                name: "Early mobility",
                goal: "Restore finger and wrist movement after the splint is removed.",
                from: 18,
                to: 23,
                status: "upcoming",
                milestones: [
                    ["Full composite fist without pain", false],
                    ["Wrist and finger range ≥ 90% of the left side", false],
                ],
            },
            {
                name: "Strength & graded impact",
                goal: "Rebuild grip strength and reintroduce light technical striking.",
                from: 23,
                to: 28,
                status: "upcoming",
                milestones: [
                    ["Grip strength ≥ 80% of the left side", false],
                    ["Light shadow boxing and technical pad work in wraps", false],
                ],
            },
            {
                name: "Return to striking",
                goal: "Progress to full-power bag and pad work before the clearance review.",
                from: 28,
                to: 31,
                status: "upcoming",
                milestones: [
                    ["Full-power bag rounds without pain", false],
                    ["Đạt đánh giá trở lại tập", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-marcus-hand",
            [
                [9, "Splint fitted yesterday; throbbing at night eased with elevation. Fingers warm with normal sensation."],
                [6, "Swelling reducing. Lower-body strength and bike conditioning without hand pain."],
                [3, "X-quang sau 1 tuần: xương giữ thẳng trục. Đau 2/10 khi sinh hoạt."],
                [1, "Comfortable in the splint. Footwork drills and running without hand symptoms."],
            ],
            { pain: 4, mobility: 30, strength: 20 },
            { pain: 2, mobility: 40, strength: 26 },
        ),
    },
    {
        id: "rp-tariq-knee",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        doctorId: SAMUEL_BROOKS,
        title: "Left knee MCL sprain — return to boxing",
        startDate: daysAgo(37, 12, 0),
        targetReturnDate: daysFromNow(6, 18, 0),
        status: "active",
        phases: phases("rp-tariq-knee", [
            {
                name: "Bảo vệ & kiểm soát sưng",
                goal: "Settle swelling and protect the ligament in a hinged brace.",
                from: -37,
                to: -30,
                status: "completed",
                milestones: [
                    ["Swelling resolved", true],
                    ["Walking without a limp in the brace", true],
                ],
            },
            {
                name: "Range of motion & activation",
                goal: "Restore full knee range and quadriceps activation.",
                from: -30,
                to: -21,
                status: "completed",
                milestones: [
                    ["Knee range 0–135°", true],
                    ["Straight-leg raise without lag", true],
                ],
            },
            {
                name: "Strength & neuromuscular control",
                goal: "Rebuild leg strength and control of the knee under load.",
                from: -21,
                to: -10,
                status: "completed",
                milestones: [
                    ["Quadriceps strength ≥ 85% of the right side", true],
                    ["Pain-free straight-line running", true],
                    ["Brace discontinued", true],
                ],
            },
            {
                name: "Chạy & nhanh nhẹn",
                goal: "Tolerate lateral movement, hopping and pivoting.",
                from: -10,
                to: -5,
                status: "completed",
                milestones: [
                    ["Bài bật nhảy ≥ 90% bên phải", true],
                    ["Pain-free lateral shuffles and pivots", true],
                ],
            },
            {
                name: "Sport-specific return",
                goal: "Full boxing footwork, pad and bag work at training intensity before restrictions are lifted.",
                from: -5,
                to: 6,
                status: "current",
                milestones: [
                    ["Full pad and bag sessions at RPE 8 without symptoms", true],
                    ["Confident sharp cutting to both sides", false],
                    ["Final return-to-training review passed", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-tariq-knee",
            [
                [36, "Mild medial knee pain on stairs; swelling down with ice and compression. Brace on."],
                [33, "Walking without a limp in the brace. Quad sets and straight-leg raises."],
                [30, "Stationary bike 15 min pain-free. Range 0–120°."],
                [27, "Range 0–135°. Mini squats and step-ups added."],
                [25, "Leg press and split squats pain-free. Upper-body boxing technique continuing.", 19, 5],
                [21, "Two-week review: ligament pain-free. Weaning off the brace this week."],
                [18, "Brace off for training. Straight-line jogging 10 min."],
                [15, "Running intervals and single-leg balance work without symptoms."],
                [12, "Lateral shuffles and ladder drills at moderate pace. Slight ache afterwards, gone by morning."],
                [9, "Hop tests 88% of the right side. Pivot drills on pads pain-free."],
                [6, "No knee pain during jogging and lateral shuffles; still cautious on sharp cuts to the left.", 9, 20],
                [3, "Full pad and bag sessions at RPE 8 with pivots, no knee symptoms."],
                [1, "Footwork under fatigue good. Final review booked."],
            ],
            { pain: 4, mobility: 72, strength: 58 },
            { pain: 0, mobility: 99, strength: 94 },
        ),
    },
    {
        id: "rp-emma-ankle",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        doctorId: THU_LE,
        title: "Bong gân cổ chân trái — trở lại Kickboxing",
        startDate: daysAgo(209, 10, 30),
        targetReturnDate: daysAgo(172, 18, 0),
        status: "completed",
        phases: phases("rp-emma-ankle", [
            {
                name: "Bảo vệ & kiểm soát sưng",
                goal: "Kiểm soát sưng và phục hồi dáng đi bình thường.",
                from: -209,
                to: -204,
                status: "completed",
                milestones: [
                    ["Đã kiểm soát sưng", true],
                    ["Chịu lực hoàn toàn, không đi khập khiễng", true],
                ],
            },
            {
                name: "Biên độ vận động & thăng bằng",
                goal: "Phục hồi biên độ cổ chân và thăng bằng một chân.",
                from: -204,
                to: -195,
                status: "completed",
                milestones: [
                    ["Gập mu chênh không quá 5° so với bên phải", true],
                    ["Thăng bằng một chân 30 giây, mở mắt", true],
                ],
            },
            {
                name: "Sức mạnh & cảm thụ bản thể",
                goal: "Tăng sức cơ bắp chân, cơ mác và kiểm soát cổ chân.",
                from: -195,
                to: -186,
                status: "completed",
                milestones: [
                    ["Nhón gót một chân 3×15", true],
                    ["Chạy chậm không đau", true],
                ],
            },
            {
                name: "Chạy & nhanh nhẹn",
                goal: "Chịu được đổi hướng, bật nhảy và tiếp đất.",
                from: -186,
                to: -179,
                status: "completed",
                milestones: [
                    ["Di chuyển ngang và bật nhảy không đau", true],
                    ["Bài bật nhảy ≥ 90% bên phải", true],
                ],
            },
            {
                name: "Trở lại tập đầy đủ",
                goal: "Đá hết cường độ và sẵn sàng đấu tập.",
                from: -179,
                to: -172,
                status: "completed",
                milestones: [
                    ["Đá đích hết cường độ", true],
                    ["Đạt đánh giá trở lại tập", true],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-emma-ankle",
            [
                [208, "Sưng và bầm quanh mắt cá ngoài; đi lại có băng ép, hơi khập khiễng."],
                [205, "Đã giảm sưng. Chịu lực hoàn toàn, hơi khập khiễng khi lên cầu thang."],
                [201, "Bắt đầu tập ván thăng bằng và bài xoay ngoài với dây kháng lực."],
                [197, "Gập mu cải thiện; đạp xe tại chỗ và đánh đích thân trên."],
                [193, "Chạy chậm trên nền phẳng không đau. Thăng bằng một chân 30 giây."],
                [189, "Nhón gót một chân 3×15. Chạy thẳng ở 70%."],
                [185, "Di chuyển ngang và nhảy dây không đau."],
                [181, "Đá đích ở 60% không triệu chứng. Bài bật nhảy đạt 90% bên phải."],
                [177, "Đánh đích hết cường độ và đá đổi chân không đau."],
                [173, "Đổi hướng và tiếp đất tự tin. Sẵn sàng đánh giá trở lại tập."],
            ],
            { pain: 6, mobility: 60, strength: 50 },
            { pain: 0, mobility: 98, strength: 96 },
        ),
    },
];

/* ─── Medical Clearances ──────────────────────────────────────────────────── */

type RestrictionBlocks = Partial<Omit<TrainingRestriction, "id" | "label">>;

function restriction(id: string, label: string, blocks: RestrictionBlocks): TrainingRestriction {
    return {
        id,
        label,
        blockedTrainingTypes: blocks.blockedTrainingTypes ?? [],
        blockedTechniques: blocks.blockedTechniques ?? [],
        blockedRegions: blocks.blockedRegions ?? [],
        maxRpe: blocks.maxRpe ?? null,
    };
}

interface ClearanceSeed {
    id: string;
    fighterId: string;
    level: ClearanceLevel;
    status: ClearanceStatus;
    issuedAt: string;
    validUntil: string | null;
    examinationId: string;
    reason: string;
    restrictions?: TrainingRestriction[];
    revokedAt?: string;
    revokedReason?: string;
}

function clearance(seed: ClearanceSeed): MedicalClearance {
    return {
        id: seed.id,
        fighterId: seed.fighterId,
        doctorId: fighter(seed.fighterId).doctorIds[0],
        level: seed.level,
        status: seed.status,
        issuedAt: clampPastToday(seed.issuedAt),
        validUntil: seed.validUntil,
        reason: seed.reason,
        restrictions: seed.restrictions ?? [],
        examinationId: seed.examinationId,
        revokedAt: seed.revokedAt === undefined ? null : clampPastToday(seed.revokedAt),
        revokedReason: seed.revokedReason ?? null,
    };
}

const BASELINE_REASON = "Khám nền đạt. Được tập va chạm toàn phần và thi đấu.";
const RENEWAL_REASON = "Khám định kỳ đạt. Gia hạn giấy phép không hạn chế.";

export const mockMedicalClearances: MedicalClearance[] = [
    /* Minh Trần */
    clearance({
        id: "cl-minh-full-318d",
        fighterId: "f-minh-tran",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(318, 11, 0),
        validUntil: endOfDay(-136),
        examinationId: "ex-minh-baseline-318d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-minh-full-151d",
        fighterId: "f-minh-tran",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(151, 11, 0),
        validUntil: endOfDay(31),
        examinationId: "ex-minh-prefight-151d",
        reason: "Khám trước trận đạt. Được thi đấu và tập không hạn chế.",
    }),
    clearance({
        id: "cl-minh-current",
        fighterId: "f-minh-tran",
        level: "full",
        status: "active",
        issuedAt: daysAgo(20, 16, 5),
        validUntil: endOfDay(120),
        examinationId: "ex-minh-routine-20d",
        reason: "Khám trước Fight Camp đạt. Được tập đầy đủ và thi đấu không hạn chế.",
    }),

    /* Lucas Ferreira */
    clearance({
        id: "cl-lucas-full-300d",
        fighterId: "f-lucas-ferreira",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(300, 11, 0),
        validUntil: endOfDay(-118),
        examinationId: "ex-lucas-baseline-300d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-lucas-previous",
        fighterId: "f-lucas-ferreira",
        level: "full",
        status: "revoked",
        issuedAt: daysAgo(128, 11, 0),
        validUntil: endOfDay(54),
        examinationId: "ex-lucas-routine-128d",
        reason: RENEWAL_REASON,
        revokedAt: daysAgo(24, 19, 46),
        revokedReason: "Chấn thương cơ đùi sau trái khi đấu tập. Thu hồi giấy phép đầy đủ chờ đánh giá y tế.",
    }),
    clearance({
        id: "cl-lucas-notcleared-23d",
        fighterId: "f-lucas-ferreira",
        level: "not_cleared",
        status: "superseded",
        issuedAt: daysAgo(23, 11, 0),
        validUntil: null,
        examinationId: "ex-lucas-injury-23d",
        reason: "Căng cơ đùi sau trái mức vừa. Chưa được tập cho đến khi xong giai đoạn phục hồi sớm.",
    }),
    clearance({
        id: "cl-lucas-current",
        fighterId: "f-lucas-ferreira",
        level: "restricted",
        status: "active",
        issuedAt: daysAgo(10, 11, 34),
        validUntil: endOfDay(18),
        examinationId: "ex-lucas-review-10d",
        reason:
            "Đang hồi phục sau căng cơ đùi sau trái, tiến triển tốt theo kế hoạch. Được tập kỹ thuật và thể lực trong các hạn chế dưới đây.",
        restrictions: [
            restriction("rst-lucas-current-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-lucas-current-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-lucas-current-max-rpe", "Cường độ buổi tập tối đa RPE 7", { maxRpe: 7 }),
            restriction("rst-lucas-current-hamstring", "Bảo vệ cơ đùi sau trái — không duỗi hông bùng nổ", {
                blockedRegions: ["left_hamstring"],
            }),
        ],
    }),

    /* Aigerim Sadykova */
    clearance({
        id: "cl-aigerim-full-290d",
        fighterId: "f-aigerim-sadykova",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(290, 11, 0),
        validUntil: endOfDay(-108),
        examinationId: "ex-aigerim-baseline-290d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-aigerim-full-170d",
        fighterId: "f-aigerim-sadykova",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(170, 11, 0),
        validUntil: endOfDay(12),
        examinationId: "ex-aigerim-routine-170d",
        reason: RENEWAL_REASON,
    }),
    clearance({
        id: "cl-aigerim-restricted-59d",
        fighterId: "f-aigerim-sadykova",
        level: "restricted",
        status: "superseded",
        issuedAt: daysAgo(59, 12, 0),
        validUntil: endOfDay(-49),
        examinationId: "ex-aigerim-brow-59d",
        reason: "Sutured left eyebrow laceration from competition. Contact restricted until the wound has healed.",
        restrictions: [
            restriction("rst-aigerim-59d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-aigerim-59d-head", "Protect the healing eyebrow wound — no head contact", { blockedRegions: ["head"] }),
        ],
    }),
    clearance({
        id: "cl-aigerim-current",
        fighterId: "f-aigerim-sadykova",
        level: "full",
        status: "active",
        issuedAt: daysAgo(49, 11, 30),
        validUntil: endOfDay(75),
        examinationId: "ex-aigerim-review-49d",
        reason: "Eyebrow laceration fully healed. Cleared for full training and competition without restrictions.",
    }),

    /* Kenji Morita */
    clearance({
        id: "cl-kenji-full-276d",
        fighterId: "f-kenji-morita",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(276, 11, 0),
        validUntil: endOfDay(-94),
        examinationId: "ex-kenji-baseline-276d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-kenji-full-101d",
        fighterId: "f-kenji-morita",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(101, 11, 0),
        validUntil: endOfDay(81),
        examinationId: "ex-kenji-routine-101d",
        reason: RENEWAL_REASON,
    }),
    clearance({
        id: "cl-kenji-current",
        fighterId: "f-kenji-morita",
        level: "restricted",
        status: "active",
        issuedAt: daysAgo(7, 12, 26),
        validUntil: endOfDay(5),
        examinationId: "ex-kenji-shoulder-7d",
        reason:
            "Khám thấy dấu hiệu chèn ép vai phải nhẹ; chưa xác định chấn thương. Được tập cường độ giảm, bảo vệ vai đến lần tái khám.",
        restrictions: [
            restriction("rst-kenji-current-max-rpe", "Cường độ buổi tập tối đa RPE 8", { maxRpe: 8 }),
            restriction("rst-kenji-current-shoulder", "Bảo vệ vai phải — hạn chế đấm mạnh khối lượng lớn và tải trên đầu", {
                blockedRegions: ["right_shoulder"],
            }),
        ],
    }),

    /* Diego Alvarez */
    clearance({
        id: "cl-diego-full-265d",
        fighterId: "f-diego-alvarez",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(265, 11, 0),
        validUntil: endOfDay(-83),
        examinationId: "ex-diego-baseline-265d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-diego-previous",
        fighterId: "f-diego-alvarez",
        level: "full",
        status: "revoked",
        issuedAt: daysAgo(93, 11, 0),
        validUntil: endOfDay(89),
        examinationId: "ex-diego-routine-93d",
        reason: RENEWAL_REASON,
        revokedAt: daysAgo(6, 19, 30),
        revokedReason: "Va chạm đầu khi đấu tập, có triệu chứng chấn động. Dừng tập chờ đánh giá y tế.",
    }),
    clearance({
        id: "cl-diego-current",
        fighterId: "f-diego-alvarez",
        level: "not_cleared",
        status: "active",
        issuedAt: daysAgo(6, 19, 32),
        validUntil: null,
        examinationId: "ex-diego-concussion-6d",
        reason:
            "Chấn động não do thể thao. Chưa được tập tại học viện; chỉ thực hiện phác đồ trở lại tập có giám sát cho đến khi khám lại.",
    }),

    /* Linh Phạm */
    clearance({
        id: "cl-linh-full-298d",
        fighterId: "f-linh-pham",
        level: "full",
        status: "expired",
        issuedAt: daysAgo(298, 11, 0),
        validUntil: endOfDay(-116),
        examinationId: "ex-linh-baseline-298d",
        reason: "Khám nền khi gia nhập học viện đạt. Được tập va chạm toàn phần và thi đấu.",
    }),
    clearance({
        id: "cl-linh-current",
        fighterId: "f-linh-pham",
        level: "full",
        status: "active",
        issuedAt: daysAgo(113, 11, 0),
        validUntil: endOfDay(69),
        examinationId: "ex-linh-routine-113d",
        reason: RENEWAL_REASON,
    }),

    /* Marcus Hale */
    clearance({
        id: "cl-marcus-full-255d",
        fighterId: "f-marcus-hale",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(255, 11, 0),
        validUntil: endOfDay(-73),
        examinationId: "ex-marcus-baseline-255d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-marcus-previous",
        fighterId: "f-marcus-hale",
        level: "full",
        status: "revoked",
        issuedAt: daysAgo(84, 11, 0),
        validUntil: endOfDay(98),
        examinationId: "ex-marcus-routine-84d",
        reason: RENEWAL_REASON,
        revokedAt: daysAgo(11, 18, 31),
        revokedReason: "Nghi chấn thương bàn tay phải khi đánh bao. Thu hồi giấy phép đầy đủ chờ chụp X-quang.",
    }),
    clearance({
        id: "cl-marcus-current",
        fighterId: "f-marcus-hale",
        level: "restricted",
        status: "active",
        issuedAt: daysAgo(10, 11, 20),
        validUntil: endOfDay(18),
        examinationId: "ex-marcus-hand-10d",
        reason:
            "Gãy kín xương bàn tay V phải, cố định nẹp. Chỉ được tập bộ pháp, sức mạnh thân dưới và thể lực đến lần chụp X-quang tuần thứ 4.",
        restrictions: [
            restriction("rst-marcus-current-impact", "Không đánh bao, đánh đích hay đấu tập", {
                blockedTrainingTypes: ["heavy_bag", "pad_work", "sparring"],
            }),
            restriction("rst-marcus-current-punching", "Không tập đấm (jab, đấm thẳng, móc hay tổ hợp)", {
                blockedTechniques: ["jab", "cross", "hook", "combination"],
            }),
            restriction("rst-marcus-current-right-hand", "Không ra đòn tay phải", { blockedRegions: ["right_hand"] }),
        ],
    }),

    /* Sofia Kowalski */
    clearance({
        id: "cl-sofia-full-359d",
        fighterId: "f-sofia-kowalski",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(359, 11, 0),
        validUntil: endOfDay(-177),
        examinationId: "ex-sofia-baseline-359d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-sofia-current",
        fighterId: "f-sofia-kowalski",
        level: "full",
        status: "active",
        issuedAt: daysAgo(177, 11, 0),
        validUntil: endOfDay(5),
        examinationId: "ex-sofia-routine-177d",
        reason: RENEWAL_REASON,
    }),

    /* Hoàng Long */
    clearance({
        id: "cl-hoang-full-324d",
        fighterId: "f-hoang-long",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(324, 11, 0),
        validUntil: endOfDay(-142),
        examinationId: "ex-hoang-baseline-324d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-hoang-current",
        fighterId: "f-hoang-long",
        level: "full",
        status: "active",
        issuedAt: daysAgo(142, 11, 0),
        validUntil: endOfDay(40),
        examinationId: "ex-hoang-routine-142d",
        reason: RENEWAL_REASON,
    }),

    /* Tariq Haddad */
    clearance({
        id: "cl-tariq-full-310d",
        fighterId: "f-tariq-haddad",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(310, 11, 0),
        validUntil: endOfDay(-128),
        examinationId: "ex-tariq-baseline-310d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-tariq-full-128d",
        fighterId: "f-tariq-haddad",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(128, 11, 0),
        validUntil: endOfDay(54),
        examinationId: "ex-tariq-routine-128d",
        reason: RENEWAL_REASON,
    }),
    clearance({
        id: "cl-tariq-restricted-37d",
        fighterId: "f-tariq-haddad",
        level: "restricted",
        status: "superseded",
        issuedAt: daysAgo(37, 12, 0),
        validUntil: endOfDay(-3),
        examinationId: "ex-tariq-injury-37d",
        reason: "Grade I left knee MCL sprain. Cleared for upper-body technique and conditioning while the ligament heals.",
        restrictions: [
            restriction("rst-tariq-37d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-tariq-37d-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-tariq-37d-knee", "Protect left knee — no running, jumping or footwork drills", {
                blockedTechniques: ["footwork"],
                blockedRegions: ["left_knee"],
            }),
            restriction("rst-tariq-37d-max-rpe", "Max session intensity RPE 6", { maxRpe: 6 }),
        ],
    }),
    clearance({
        id: "cl-tariq-current",
        fighterId: "f-tariq-haddad",
        level: "restricted",
        status: "active",
        issuedAt: daysAgo(5, 10, 55),
        validUntil: endOfDay(9),
        examinationId: "ex-tariq-rtp-5d",
        reason:
            "Final sport-specific phase after a grade I left knee MCL sprain. Meets strength and hop criteria; cleared for pad, bag and footwork training within the restrictions below until the final review.",
        restrictions: [
            restriction("rst-tariq-current-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-tariq-current-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-tariq-current-knee", "Protect left knee — no full-speed sharp cutting drills", { blockedRegions: ["left_knee"] }),
            restriction("rst-tariq-current-max-rpe", "Cường độ buổi tập tối đa RPE 8", { maxRpe: 8 }),
        ],
    }),

    /* Emma Lindqvist */
    clearance({
        id: "cl-emma-full-335d",
        fighterId: "f-emma-lindqvist",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(335, 11, 0),
        validUntil: endOfDay(-153),
        examinationId: "ex-emma-baseline-335d",
        reason: BASELINE_REASON,
    }),
    clearance({
        id: "cl-emma-restricted-209d",
        fighterId: "f-emma-lindqvist",
        level: "restricted",
        status: "superseded",
        issuedAt: daysAgo(209, 11, 0),
        validUntil: endOfDay(-170),
        examinationId: "ex-emma-ankle-209d",
        reason: "Bong gân cổ chân trái độ II. Được tập thân trên và thể lực tư thế ngồi trong khi dây chằng lành.",
        restrictions: [
            restriction("rst-emma-209d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-emma-209d-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-emma-209d-ankle", "Protect left ankle — no jumping or cutting drills", {
                blockedTechniques: ["footwork"],
                blockedRegions: ["left_ankle"],
            }),
        ],
    }),
    clearance({
        id: "cl-emma-full-172d",
        fighterId: "f-emma-lindqvist",
        level: "full",
        status: "superseded",
        issuedAt: daysAgo(172, 12, 0),
        validUntil: endOfDay(-80),
        examinationId: "ex-emma-rtp-172d",
        reason: "Đạt mọi tiêu chí trở lại tập sau bong gân cổ chân trái. Được tập không hạn chế.",
    }),
    clearance({
        id: "cl-emma-current",
        fighterId: "f-emma-lindqvist",
        level: "full",
        status: "active",
        issuedAt: daysAgo(80, 11, 0),
        validUntil: endOfDay(102),
        examinationId: "ex-emma-routine-80d",
        reason: RENEWAL_REASON,
    }),
];

/* ─── Medical records ─────────────────────────────────────────────────────── */

const PHYSICAL_EXAM_TYPES: ExaminationType[] = ["baseline", "routine", "pre_fight"];

function lastPhysicalAt(fighterId: string): string {
    const dates = mockMedicalExaminations
        .filter((e) => e.fighterId === fighterId && e.type !== null && PHYSICAL_EXAM_TYPES.includes(e.type))
        .map((e) => e.date)
        .sort();
    const latest = dates[dates.length - 1];
    if (!latest) throw new Error(`No physical examination seeded for ${fighterId}`);
    return latest;
}

function scatBaselineDocument(fighterId: string, dayOffset: number, authorName: string, summary?: string): MedicalDocument {
    return {
        id: `doc-${slug(fighterId)}-scat6-baseline`,
        title: "SCAT6 baseline",
        kind: "report",
        date: clampPastToday(daysAgo(dayOffset, 9, 45)),
        authorName,
        summary: summary ?? "Symptom score, cognitive screening (SAC) and balance (mBESS) baseline recorded for comparison after any head impact.",
    };
}

function bloodworkDocument(fighterId: string, dayOffset: number, authorName: string, summary?: string): MedicalDocument {
    return {
        id: `doc-${slug(fighterId)}-bloods-${dayOffset}d`,
        title: "Bloodwork panel — routine",
        kind: "lab",
        date: clampPastToday(daysAgo(dayOffset, 8, 0)),
        authorName,
        summary: summary ?? "Full blood count, ferritin, vitamin D, renal and liver function within reference ranges.",
    };
}

type RecordSeed = Omit<MedicalRecord, "id" | "fighterId" | "primaryDoctorId" | "lastPhysicalAt"> & { lastPhysicalAt?: string };

function medicalRecord(fighterId: string, seed: RecordSeed): MedicalRecord {
    return {
        ...seed,
        id: `mr-${slug(fighterId)}`,
        fighterId,
        primaryDoctorId: fighter(fighterId).doctorIds[0],
        lastPhysicalAt: seed.lastPhysicalAt ?? lastPhysicalAt(fighterId),
    };
}

export const mockMedicalRecords: MedicalRecord[] = [
    medicalRecord("f-minh-tran", {
        bloodType: "O+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [],
        emergencyContact: { name: "Trần Thị Hoa", relation: "Mother", phone: "+84 903 418 227" },
        notes: "Professional Muay Thai athlete in fight camp for Saigon Warriors MMA 04. Previous post-bout right shin contusion fully resolved. No ongoing health concerns.",
        documents: [
            scatBaselineDocument("f-minh-tran", 318, THU_LE_NAME),
            {
                id: "doc-minh-ecg-151d",
                title: "Resting ECG — pre-fight medical",
                kind: "report",
                date: daysAgo(151, 9, 30),
                authorName: THU_LE_NAME,
                summary: "Sinus bradycardia at 51 bpm with athletic voltage criteria; no pathological findings.",
            },
            { ...bloodworkDocument("f-minh-tran", 21, THU_LE_NAME), title: "Bloodwork panel — pre-camp" },
        ],
        updatedAt: daysAgo(20, 16, 10),
    }),
    medicalRecord("f-lucas-ferreira", {
        bloodType: "A+",
        allergies: ["Penicillin"],
        chronicConditions: [],
        medications: ["Paracetamol 1 g as required for post-session soreness"],
        surgicalHistory: [{ year: 2017, procedure: "Left shoulder arthroscopic labral repair" }],
        emergencyContact: { name: "Camila Ferreira", relation: "Wife", phone: "+55 21 98765 4312" },
        notes: "Recovering from a grade II left biceps femoris strain on a physiotherapy-led loading plan. Previous left shoulder labral repair is stable. Penicillin allergy (rash) — use alternatives.",
        documents: [
            scatBaselineDocument("f-lucas-ferreira", 300, THU_LE_NAME),
            bloodworkDocument("f-lucas-ferreira", 129, THU_LE_NAME, "Within reference ranges; vitamin D 32 ng/mL."),
            {
                id: "doc-lucas-mri-22d",
                title: "MRI left hamstring — grade II strain biceps femoris long head",
                kind: "imaging",
                date: daysAgo(22, 16, 0),
                authorName: THU_LE_NAME,
                summary: "Oedema along 6 cm of the biceps femoris long head; intramuscular tendon intact, no avulsion.",
            },
            {
                id: "doc-lucas-referral-20d",
                title: "Referral letter — sports physiotherapy",
                kind: "referral",
                date: daysAgo(20, 9, 0),
                authorName: THU_LE_NAME,
                summary: "Referred to Dr. Samuel Brooks for progressive hamstring loading and a running progression.",
            },
        ],
        updatedAt: daysAgo(10, 12, 0),
    }),
    medicalRecord("f-aigerim-sadykova", {
        bloodType: "B+",
        allergies: [],
        chronicConditions: ["Low iron stores without anaemia — monitored"],
        medications: ["Ferrous sulfate 200 mg every second day"],
        surgicalHistory: [],
        emergencyContact: { name: "Dana Sadykova", relation: "Sister", phone: "+7 701 482 9163" },
        notes: "Iron stores improving on alternate-day supplementation; recheck ferritin in 8 weeks. Left eyebrow laceration from competition healed well.",
        documents: [
            scatBaselineDocument("f-aigerim-sadykova", 290, SAMUEL_BROOKS_NAME),
            {
                id: "doc-aigerim-wound-49d",
                title: "Wound review — left eyebrow laceration",
                kind: "report",
                date: daysAgo(49, 11, 15),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Sutures removed; wound fully healed with a well-formed, non-tender scar.",
            },
            {
                ...bloodworkDocument("f-aigerim-sadykova", 13, SAMUEL_BROOKS_NAME, "Ferritin 46 µg/L (previously 28 µg/L); haemoglobin 13.6 g/dL."),
                title: "Bloodwork panel — ferritin recheck",
            },
        ],
        updatedAt: daysAgo(12, 11, 0),
    }),
    medicalRecord("f-kenji-morita", {
        bloodType: "A+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [],
        emergencyContact: { name: "Yuki Morita", relation: "Brother", phone: "+81 90 3827 1164" },
        notes: "Under monitoring for mild right shoulder impingement signs examined after an AI movement observation. No confirmed injury. Follow-up examination booked.",
        documents: [
            scatBaselineDocument("f-kenji-morita", 276, THU_LE_NAME),
            bloodworkDocument("f-kenji-morita", 102, THU_LE_NAME),
            {
                id: "doc-kenji-shoulder-7d",
                title: "Shoulder examination report — right shoulder",
                kind: "report",
                date: daysAgo(7, 12, 0),
                authorName: THU_LE_NAME,
                summary: "Positive Hawkins–Kennedy and mild painful arc on the right with preserved strength. Consistent with mild subacromial impingement.",
            },
        ],
        updatedAt: daysAgo(7, 12, 0),
    }),
    medicalRecord("f-diego-alvarez", {
        bloodType: "O+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [{ year: 2015, procedure: "Right knee arthroscopic partial meniscectomy" }],
        emergencyContact: { name: "María Alvarez", relation: "Wife", phone: "+52 55 4127 8839" },
        notes: "One previous concussion (2021) with full recovery in 12 days. Currently following a graded return-to-training protocol after a concussion in sparring.",
        documents: [
            scatBaselineDocument("f-diego-alvarez", 265, THU_LE_NAME, "Symptom score 1/22, SAC 43/50, mBESS 2 errors."),
            bloodworkDocument("f-diego-alvarez", 94, THU_LE_NAME),
            {
                id: "doc-diego-scat6-6d",
                title: "SCAT6 — post-injury assessment",
                kind: "report",
                date: daysAgo(6, 20, 0),
                authorName: THU_LE_NAME,
                summary: "Symptom score 9/22 (severity 21), SAC 36/50, mBESS 8 errors. No red flags.",
            },
            {
                id: "doc-diego-scat6-3d",
                title: "SCAT6 — day 3 follow-up",
                kind: "report",
                date: daysAgo(3, 10, 45),
                authorName: THU_LE_NAME,
                summary: "Symptom score 3/22 (severity 5), SAC 42/50, mBESS 4 errors. Progressing to stage 2 of the protocol.",
            },
        ],
        updatedAt: daysAgo(3, 11, 0),
    }),
    medicalRecord("f-linh-pham", {
        bloodType: "O+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [],
        emergencyContact: { name: "Phạm Văn Tuấn", relation: "Father", phone: "+84 912 305 781" },
        notes: "Amateur kickboxer with no significant medical history. AI knee movement observation reviewed and dismissed — landing mechanics within the normal range.",
        documents: [scatBaselineDocument("f-linh-pham", 298, THU_LE_NAME), bloodworkDocument("f-linh-pham", 114, THU_LE_NAME)],
        updatedAt: daysAgo(5, 15, 0),
    }),
    medicalRecord("f-marcus-hale", {
        bloodType: "A-",
        allergies: [],
        chronicConditions: [],
        medications: ["Paracetamol 1 g as required"],
        surgicalHistory: [{ year: 2018, procedure: "Nasal septoplasty" }],
        emergencyContact: { name: "Olivia Hale", relation: "Partner", phone: "+44 7700 900481" },
        notes: "Closed right 5th metacarpal neck fracture managed non-operatively in an ulnar gutter splint. 4-week X-ray and hand therapy planned.",
        documents: [
            scatBaselineDocument("f-marcus-hale", 255, THU_LE_NAME),
            {
                id: "doc-marcus-xray-11d",
                title: "X-ray right hand — 5th metacarpal neck fracture, 15° angulation",
                kind: "imaging",
                date: daysAgo(11, 19, 0),
                authorName: THU_LE_NAME,
                summary: "Closed, extra-articular 5th metacarpal neck fracture with 15° volar angulation; no rotational deformity.",
            },
            {
                id: "doc-marcus-xray-3d",
                title: "X-ray right hand — 1-week follow-up",
                kind: "imaging",
                date: daysAgo(3, 10, 0),
                authorName: THU_LE_NAME,
                summary: "Alignment maintained; angulation unchanged at 15°.",
            },
            {
                id: "doc-marcus-referral-3d",
                title: "Referral letter — hand therapy",
                kind: "referral",
                date: daysAgo(3, 11, 0),
                authorName: THU_LE_NAME,
                summary: "Referred to Dr. Samuel Brooks for mobility and grip strengthening after splint removal.",
            },
        ],
        updatedAt: daysAgo(3, 11, 0),
    }),
    medicalRecord("f-sofia-kowalski", {
        bloodType: "A+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [],
        emergencyContact: { name: "Katarzyna Kowalska", relation: "Mother", phone: "+48 601 237 845" },
        notes: "Healthy. Pre-fight medical and Medical Clearance renewal due before Lotus Fight Night 17. Previous left rib contusion resolved.",
        documents: [
            scatBaselineDocument("f-sofia-kowalski", 359, SAMUEL_BROOKS_NAME),
            {
                id: "doc-sofia-ecg-359d",
                title: "Resting ECG — annual screening",
                kind: "report",
                date: daysAgo(359, 9, 30),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Normal sinus rhythm; no pathological findings.",
            },
            bloodworkDocument("f-sofia-kowalski", 178, SAMUEL_BROOKS_NAME),
        ],
        updatedAt: daysAgo(35, 11, 0),
    }),
    medicalRecord("f-hoang-long", {
        bloodType: "B+",
        allergies: [],
        chronicConditions: [],
        medications: ["Oral rehydration salts during the weight cut"],
        surgicalHistory: [],
        emergencyContact: { name: "Hoàng Thị Mai", relation: "Mother", phone: "+84 938 612 054" },
        notes: "Monitoring low-back tightness and hydration during his weight cut for Lotus Fight Night 17. No radicular symptoms. Weight and hydration check booked.",
        documents: [
            scatBaselineDocument("f-hoang-long", 324, THU_LE_NAME),
            bloodworkDocument("f-hoang-long", 143, THU_LE_NAME),
            {
                id: "doc-hoang-urinalysis-12d",
                title: "Urinalysis & electrolytes — weight-cut monitoring",
                kind: "lab",
                date: daysAgo(12, 9, 0),
                authorName: THU_LE_NAME,
                summary: "Urine specific gravity 1.026 (fair hydration). Sodium and potassium within range; creatinine upper-normal.",
            },
        ],
        updatedAt: daysAgo(12, 11, 0),
    }),
    medicalRecord("f-tariq-haddad", {
        bloodType: "B+",
        allergies: ["Sulfonamide antibiotics"],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [{ year: 2019, procedure: "Right ACL reconstruction (hamstring autograft)" }],
        emergencyContact: { name: "Omar Haddad", relation: "Brother", phone: "+962 79 552 3806" },
        notes: "In the final sport-specific phase after a grade I left knee MCL sprain. Right ACL reconstruction (2019) remains stable.",
        documents: [
            scatBaselineDocument("f-tariq-haddad", 310, SAMUEL_BROOKS_NAME),
            {
                id: "doc-tariq-ultrasound-36d",
                title: "Ultrasound left knee — grade I MCL sprain",
                kind: "imaging",
                date: daysAgo(36, 14, 30),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Thickened, hypoechoic proximal MCL fibres; no full-thickness tear and no joint effusion.",
            },
            {
                id: "doc-tariq-rtp-5d",
                title: "Return-to-training assessment report",
                kind: "report",
                date: daysAgo(5, 10, 50),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Quadriceps 93%, hamstrings 95% and hop for distance 91% of the right side. Restricted: no sparring, no kicks, RPE ≤ 8.",
            },
        ],
        updatedAt: daysAgo(5, 10, 55),
    }),
    medicalRecord("f-emma-lindqvist", {
        bloodType: "O-",
        allergies: [],
        chronicConditions: ["Hen do gắng sức mức nhẹ"],
        medications: ["Salbutamol inhaler 100 mcg — 2 puffs as required before intense sessions"],
        surgicalHistory: [],
        emergencyContact: { name: "Erik Lindqvist", relation: "Father", phone: "+46 70 318 2254" },
        notes: "Asthma well controlled; reliever used before sparring days only. Left ankle sprain fully rehabilitated.",
        documents: [
            scatBaselineDocument("f-emma-lindqvist", 335, THU_LE_NAME),
            {
                id: "doc-emma-spirometry-335d",
                title: "Spirometry — exercise challenge",
                kind: "report",
                date: daysAgo(335, 10, 30),
                authorName: THU_LE_NAME,
                summary: "12% fall in FEV1 after exercise, reversed with salbutamol. Consistent with mild exercise-induced bronchoconstriction.",
            },
            bloodworkDocument("f-emma-lindqvist", 81, THU_LE_NAME),
        ],
        updatedAt: daysAgo(24, 11, 0),
    }),
    medicalRecord("f-bao-nguyen", {
        bloodType: "Not recorded",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [],
        emergencyContact: { name: "Nguyễn Văn Hùng", relation: "Father", phone: "+84 987 204 613" },
        lastPhysicalAt: daysAgo(160, 9, 0),
        notes: `Record opened at registration from the pre-participation health questionnaire; no conditions declared. Last physical is an external amateur licence medical. Baseline physical booked for ${formatDate(BAO_BASELINE_EXAM_DATE)}.`,
        documents: [
            {
                id: "doc-bao-licence-medical",
                title: "Amateur licence medical (external)",
                kind: "report",
                date: daysAgo(160, 9, 0),
                authorName: "External licensing physician",
                summary: "Fit to compete as an amateur. Provided by the fighter at registration; to be confirmed at the baseline physical.",
            },
        ],
        updatedAt: daysAgo(12, 10, 0),
    }),
];
