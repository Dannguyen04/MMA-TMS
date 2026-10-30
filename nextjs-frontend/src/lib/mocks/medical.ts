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
 *
 * Text the doctors "typed" (notes, summaries, restriction labels…) is written in Vietnamese
 * for the Vietnamese demo; it does not go through the i18n dictionaries.
 */

const THU_LE = "d-thu-le";
const SAMUEL_BROOKS = "d-samuel-brooks";
const THU_LE_NAME = "Dr. Thu Lê";
const SAMUEL_BROOKS_NAME = "Dr. Samuel Brooks";
const LOTUS_PHYSIO = "Lotus Physio Clinic";

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
        ? `Cân nặng thường ngày ${weightKg} kg — vượt giới hạn hạng cân ${f.targetWeightKg} kg là ${above} kg.`
        : `Cân nặng thường ngày ${weightKg} kg — trong giới hạn hạng cân ${f.targetWeightKg} kg.`;
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
            { area: "Tim mạch", result: "normal", note: "Nhịp đều, không có tiếng thổi. Điện tâm đồ lúc nghỉ trong giới hạn bình thường của vận động viên." },
            {
                area: "Hô hấp",
                result: "normal",
                note: notes.respiratory ?? "Rì rào phế nang rõ hai bên; không có triệu chứng liên quan đến gắng sức.",
            },
            { area: "Khám thần kinh", result: "normal", note: "Dây thần kinh sọ, phối hợp vận động và phản xạ bình thường." },
            {
                area: "SCAT6 ban đầu",
                result: "normal",
                note: notes.scat ?? `Điểm triệu chứng ${rng.int(0, 2)}/22, SAC ${rng.int(40, 46)}/50, mBESS ${rng.int(1, 4)} lỗi.`,
            },
            { area: "Thị lực", result: "normal", note: "Thị lực 10/10 cả hai mắt; thị trường đầy đủ." },
            {
                area: "Khám cơ xương khớp",
                result: "normal",
                note: notes.musculoskeletal ?? `Biên độ vận động đầy đủ, không đau ở tất cả các khớp lớn. Đánh giá vận động chức năng (FMS) ${rng.int(15, 18)}/21.`,
            },
            {
                area: "Xét nghiệm máu",
                result: "normal",
                note: notes.bloodwork ?? "Công thức máu, ferritin, vitamin D, chức năng thận và điện giải trong giới hạn bình thường.",
            },
        ],
        summary: notes.summary ?? "Khám thể lực ban đầu hằng năm. Không có chống chỉ định với tập luyện đối kháng toàn phần và thi đấu.",
        recommendations: "Lưu các chỉ số ban đầu để so sánh sau mọi va chạm vùng đầu hoặc chấn thương. Khám lại sau 12 tháng.",
    });
}

const ROUTINE_SUMMARIES = [
    "Khám định kỳ. Không có vấn đề sức khỏe mới; võ sĩ chịu tốt khối lượng tập hiện tại.",
    "Khám định kỳ. Thể trạng tốt, ngủ 7–8 tiếng, không than đau.",
    "Khám định kỳ. Không có chấn thương hay bệnh mới kể từ lần khám trước; các chỉ số hồi phục tốt.",
    "Khám định kỳ. Tập luyện và hồi phục cân đối; không có vấn đề gì.",
] as const;

const ROUTINE_RECOMMENDATIONS = [
    "Tiếp tục giáo án hiện tại. Duy trì đều đặn việc bù nước và giấc ngủ.",
    "Không cần thay đổi. Khám định kỳ lần tới sau 6–8 tuần.",
    "Giữ khối lượng tập hiện tại. Báo ngay nếu có đau khớp mới hoặc va chạm vùng đầu.",
] as const;

const RENEWAL_SUMMARY = "Khám định kỳ và gia hạn cấp phép y tế. Không có chấn thương hay bệnh mới kể từ lần khám trước.";
const RENEWAL_RECOMMENDATIONS = "Gia hạn cấp phép, không có hạn chế. Khám định kỳ lần tới sau 6–8 tuần.";

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
                area: "Khám cơ xương khớp",
                result: "normal",
                note: "Không có than phiền mới về khớp hay mô mềm; biên độ vận động đầy đủ, không đau.",
            },
            { area: "Da", result: "normal", note: "Không có dấu hiệu nhiễm trùng da; không có vết thương hở." },
            options.weight?.(v) ?? { area: "Cân nặng và bù nước", result: "normal", note: `${weightNote(fighterId, v.weightKg)} Bù nước tốt.` },
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
            { area: "Tim mạch", result: "normal", note: "Nhịp đều, không có tiếng thổi; huyết áp trong giới hạn cho phép thi đấu." },
            { area: "Khám thần kinh", result: "normal", note: "Không có triệu chứng thần kinh; điểm triệu chứng SCAT6 bằng mức ban đầu." },
            { area: "Khám mắt", result: "normal", note: "Thị lực 10/10; soi đáy mắt bình thường." },
            { area: "Khám cơ xương khớp", result: "normal", note: "Hiện không có chấn thương." },
            { area: "Kiểm tra cân nặng", result: "normal", note: `${v.weightKg} kg lúc kiểm tra; đúng tiến độ để cân chính thức an toàn.` },
            { area: "Sàng lọc bệnh truyền nhiễm", result: "normal", note: "Kết quả viêm gan B, viêm gan C và HIV còn hiệu lực, đều âm tính." },
        ],
        summary: "Khám trước trận. Đủ điều kiện thi đấu.",
        recommendations: "Được phép thi đấu. Bù nước từ từ sau khi cân chính thức; khám sau trận trong vòng 48 giờ.",
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
            { area: "Quan sát cẳng chân phải", result: "abnormal", note: "Bầm tím kèm khối máu tụ chắc 4 × 3 cm mặt trước xương chày; da còn nguyên vẹn." },
            { area: "Ấn đau trên xương", result: "normal", note: "Không có điểm đau khu trú trên mào chày; bật nhảy một chân không đau." },
            { area: "Kiểm tra khoang cẳng chân", result: "normal", note: "Các khoang mềm, kéo duỗi thụ động ngón chân không đau, mạch và cảm giác ngoại vi bình thường." },
            { area: "Khám thần kinh", result: "normal", note: "Điểm triệu chứng SCAT6 sau trận bằng mức ban đầu." },
        ],
        summary: "Đánh giá sau trận, sau nhiều lần đòn đá bị đối thủ chặn. Đụng dập cẳng chân phải kèm khối máu tụ nhỏ; không có dấu hiệu gãy xương hay hội chứng chèn ép khoang.",
        recommendations:
            "Chườm lạnh và băng ép trong 48–72 giờ trong tuần nghỉ sau trận đã lên kế hoạch, sau đó tập đá trở lại theo mức đau. Khám lại nếu sưng tăng hoặc đau làm thức giấc ban đêm.",
    }),
    routineExam("f-minh-tran", 108),
    routineExam("f-minh-tran", 62),
    routineExam("f-minh-tran", 20, {
        hour: 15,
        summary:
            "Khám thể lực trước giai đoạn chuẩn bị thi đấu và gia hạn cấp phép y tế cho Lotus Fight Night 18. Đụng dập cẳng chân trước đây đã khỏi hoàn toàn; đã xem lại kế hoạch giảm cân, đúng tiến độ giảm từ từ.",
        recommendations:
            "Gia hạn cấp phép, không có hạn chế. Giảm khoảng 0,5 kg mỗi tuần bằng chế độ ăn; không giảm cân bằng cách gây mất nước trước tuần thi đấu. Khám trước trận trong tuần thi đấu.",
    }),

    /* Lucas Ferreira — left hamstring strain, recovery */
    baselineExam("f-lucas-ferreira", 300, {
        musculoskeletal: "Biên độ vận động đầy đủ, không đau. Vai trái đã khâu sụn viền (2017), ổn định và đủ sức cơ.",
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
                area: "Sờ nắn — mặt sau đùi trái",
                result: "abnormal",
                note: "Đau ở giữa bụng cơ nhị đầu đùi, cách nếp gấp gối 18 cm; không sờ thấy chỗ khuyết.",
            },
            { area: "Duỗi gối chủ động (90/90)", result: "abnormal", note: "Bên trái thiếu 38° so với duỗi hết, bên phải thiếu 12°." },
            { area: "Sức cơ đẳng trường", result: "abnormal", note: "Gập gối có kháng lực ở 15° và 90° đau và yếu (4/5)." },
            { area: "Dáng đi", result: "abnormal", note: "Đi tránh đau, bước chân trái ngắn lại." },
            { area: "Căng thần kinh (slump test)", result: "normal", note: "Âm tính; không ảnh hưởng thần kinh tọa." },
        ],
        summary:
            "Chấn thương gân kheo trái cấp tính khi đấu tập tối qua. Dấu hiệu phù hợp với căng cơ nhị đầu đùi mức trung bình; đã chỉ định chụp MRI để xác định mức độ.",
        recommendations:
            "Chưa được tập. Bảo vệ cơ trong 3–5 ngày: nghỉ tương đối, băng ép và đi bộ trong ngưỡng không đau. Bắt đầu bài tập đẳng trường với chuyên viên vật lý trị liệu khi đi bộ hết đau.",
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
            { area: "Sờ nắn — mặt sau đùi trái", result: "normal", note: "Không còn đau khi ấn." },
            { area: "Duỗi gối chủ động (90/90)", result: "normal", note: "Bên trái 16°, bên phải 12° — gần cân xứng." },
            { area: "Sức cơ đẳng trường", result: "abnormal", note: "Lực gập gối bằng 78% bên phải khi đo bằng lực kế cầm tay; không đau." },
            { area: "Đánh giá chạy", result: "normal", note: "Chạy nhẹ và chạy tăng tốc ở 60% sức không đau." },
            { area: "Duỗi hông bùng nổ", result: "inconclusive", note: "Hơi căng khi xuất phát chạy nước rút và các bài duỗi hông nhanh." },
        ],
        summary:
            "Đánh giá trở lại tập luyện hai tuần sau căng cơ. Sinh hoạt hằng ngày không đau, biên độ gần đầy đủ, sức cơ đang cải thiện; chưa sẵn sàng cho tải tốc độ cao hoặc bùng nổ.",
        recommendations:
            "Được tập có hạn chế: không đấu tập, không đá, cường độ buổi tập tối đa RPE 7. Tiếp tục tăng tải dần và lộ trình chạy. Đánh giá lại khi kết thúc giai đoạn phục hồi 3.",
    }),

    /* Aigerim Sadykova — healthy, bout in 27 days */
    baselineExam("f-aigerim-sadykova", 290, {
        bloodwork: "Ferritin 28 µg/L (giới hạn thấp của bình thường), huyết sắc tố bình thường; bắt đầu bổ sung sắt cách ngày.",
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
                area: "Quan sát vết thương — cung mày trái",
                result: "abnormal",
                note: "Vết rách 2 cm đã khâu 4 mũi; mép vết thương áp sát tốt, không có dấu hiệu nhiễm trùng.",
            },
            { area: "Khám thần kinh", result: "normal", note: "Không có triệu chứng chấn động não; điểm triệu chứng SCAT6 và thăng bằng bằng mức ban đầu." },
            { area: "Khám mắt", result: "normal", note: "Vận nhãn đầy đủ, không đau; không rối loạn thị giác." },
            { area: "Xương mặt", result: "normal", note: "Không đau vùng hốc mắt hay mũi; không có biến dạng bậc thang." },
        ],
        summary:
            "Đánh giá sau trận vào sáng hôm sau. Rách cung mày trái do vô tình va đầu, đã khâu ngay tại sàn đấu. Không có dấu hiệu chấn động não.",
        recommendations:
            "Không đấu tập hoặc va chạm vùng đầu cho đến khi vết thương lành. Giữ vết thương sạch, khô và bôi thuốc mỡ hằng ngày. Cắt chỉ và kiểm tra vết thương sau 10 ngày.",
    }),
    exam({
        fighterId: "f-aigerim-sadykova",
        dayOffset: 49,
        type: "return_to_play",
        label: "review",
        hour: 11,
        assessments: [
            { area: "Kiểm tra vết thương", result: "normal", note: "Đã cắt chỉ; vết thương lành hoàn toàn, sẹo đẹp, không đau." },
            { area: "Khám thần kinh", result: "normal", note: "Không có triệu chứng." },
        ],
        summary: "Kiểm tra vết thương 10 ngày sau trận. Vết rách lành tốt.",
        recommendations: "Được tập đầy đủ, kể cả đấu tập. Bôi vaseline lên sẹo trước khi đấu tập trong 4 tuần tới.",
    }),
    routineExam("f-aigerim-sadykova", 12, {
        summary: "Khám định kỳ trong giai đoạn chuẩn bị thi đấu. Cân nặng và chỉ số sắt đúng tiến độ.",
        recommendations: "Tiếp tục bổ sung sắt cách ngày và kế hoạch cân nặng hiện tại. Khám trước trận trong tuần thi đấu.",
        extra: [{ area: "Xét nghiệm máu", result: "normal", note: "Ferritin 46 µg/L — đã cải thiện nhờ bổ sung; huyết sắc tố 13,6 g/dL." }],
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
            { area: "Biên độ vận động chủ động", result: "normal", note: "Biên độ chủ động đầy đủ; khó chịu ở cuối tầm gập và xoay trong bên phải." },
            { area: "Nghiệm pháp Hawkins–Kennedy", result: "abnormal", note: "Dương tính bên phải (gây lại đau mặt trước ngoài vai); âm tính bên trái." },
            { area: "Nghiệm pháp Empty can", result: "normal", note: "Sức cơ 5/5 hai bên; không đau." },
            { area: "Cung đau", result: "abnormal", note: "Cung đau nhẹ trong khoảng dạng vai 80°–110° bên phải." },
            { area: "Kiểm soát xương bả vai", result: "inconclusive", note: "Xương bả vai phải nâng sớm nhẹ khi lặp lại động tác với tay qua đầu." },
            { area: "Cột sống cổ", result: "normal", note: "Biên độ đầy đủ, không đau; không có triệu chứng lan." },
        ],
        summary:
            "Khám tập trung vai phải sau khi AI ghi nhận vai nâng lệch khi tung đòn thẳng (cross). Dấu hiệu gợi ý hội chứng chèn ép dưới mỏm cùng vai mức nhẹ; không có dấu hiệu rách chóp xoay hay mất vững. Chưa ghi nhận chấn thương ở giai đoạn này.",
        recommendations:
            "Được tập có hạn chế: cường độ buổi tập tối đa RPE 8 và bảo vệ vai phải (hạn chế đấm lực mạnh khối lượng lớn và tải qua đầu). Bắt đầu bài tập kiểm soát xương bả vai và chóp xoay. Cân nhắc siêu âm nếu triệu chứng chưa giảm khi tái khám.",
    }),

    /* Diego Alvarez — concussion, not cleared */
    baselineExam("f-diego-alvarez", 265, {
        scat: "Điểm triệu chứng 1/22, SAC 43/50, mBESS 2 lỗi.",
        musculoskeletal: "Biên độ đầy đủ. Gối phải đã cắt một phần sụn chêm (2015), không có triệu chứng, không tràn dịch.",
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
                area: "Sàng lọc dấu hiệu nguy hiểm",
                result: "normal",
                note: "Không có dấu hiệu nguy hiểm: GCS 15, không đau đầu tăng dần, nôn nhiều lần, co giật hay dấu hiệu thần kinh khu trú.",
            },
            {
                area: "Đánh giá triệu chứng",
                result: "abnormal",
                note: "Điểm triệu chứng 9/22, mức độ 21 (ban đầu 1/22): đau đầu, chóng mặt, cảm giác 'lơ mơ', sợ ánh sáng.",
            },
            { area: "Sàng lọc nhận thức (SAC)", result: "abnormal", note: "SAC 36/50 (ban đầu 43/50); giảm khả năng nhớ lại muộn và tập trung." },
            { area: "Thăng bằng (mBESS)", result: "abnormal", note: "8 lỗi (ban đầu 2), chủ yếu ở tư thế đứng nối gót và đứng một chân." },
            { area: "Cột sống cổ", result: "normal", note: "Biên độ đầy đủ, không đau; không đau đường giữa." },
        ],
        summary:
            "Khám trong vòng một giờ sau va chạm vùng đầu khi đấu tập. Biểu hiện phù hợp với chấn động não do thể thao. Không có dấu hiệu nguy hiểm; không cần chẩn đoán hình ảnh.",
        recommendations:
            "Chưa được tập. Nghỉ tương đối 24–48 giờ, có người ở cùng qua đêm; tránh rượu bia và lái xe, hạn chế màn hình khi còn triệu chứng. Dùng paracetamol khi đau đầu nếu cần. Bắt đầu phác đồ trở lại tập luyện theo từng bước khi triệu chứng giảm. Đi cấp cứu ngay nếu triệu chứng nặng lên.",
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
            { area: "Đánh giá triệu chứng", result: "abnormal", note: "Điểm triệu chứng 3/22, mức độ 5: đau đầu nhẹ về chiều và hơi mệt." },
            { area: "Sàng lọc nhận thức (SAC)", result: "normal", note: "SAC 42/50 — đã về trong khoảng ban đầu." },
            { area: "Thăng bằng (mBESS)", result: "abnormal", note: "4 lỗi (ban đầu 2); đang cải thiện." },
            { area: "Cột sống cổ", result: "normal", note: "Biên độ đầy đủ, không đau." },
            { area: "Khả năng chịu gắng sức", result: "normal", note: "Đi bộ 30 phút không tăng triệu chứng." },
        ],
        summary: "Tái khám ngày thứ 3. Cải thiện đều; triệu chứng nhẹ và không bị kích hoạt khi vận động nhẹ.",
        recommendations:
            "Vẫn chưa được tập. Chuyển sang bước 2 của phác đồ (vận động ưa khí nhẹ, không tập kháng lực). Sàng lọc lại trước khi chuyển sang bài tập chuyên môn.",
    }),

    /* Linh Phạm — healthy */
    baselineExam("f-linh-pham", 298, {
        summary: "Khám thể lực ban đầu khi gia nhập học viện. Không có chống chỉ định với tập luyện đối kháng toàn phần và thi đấu.",
    }),
    routineExam("f-linh-pham", 240),
    routineExam("f-linh-pham", 178),
    routineExam("f-linh-pham", 113, {
        summary: "Khám định kỳ và gia hạn cấp phép y tế sau khi cấp phép trước đã hết hạn. Không có chấn thương hay bệnh mới kể từ lần khám trước.",
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
            { area: "Quan sát — bàn tay phải", result: "abnormal", note: "Sưng bờ trụ bàn tay, mất đường cong khớp đốt ngón 5." },
            { area: "Sờ nắn", result: "abnormal", note: "Đau khu trú ở cổ xương bàn tay thứ 5." },
            { area: "Trục xoay", result: "normal", note: "Không bắt chéo ngón khi nắm tay; móng tay thẳng hàng." },
            { area: "Thần kinh – mạch máu", result: "normal", note: "Cảm giác và thời gian đổ đầy mao mạch bình thường ở tất cả các ngón." },
            { area: "Da", result: "normal", note: "Da trên khớp đốt ngón còn nguyên vẹn; không có vết thương." },
            { area: "Xem phim chụp", result: "abnormal", note: "X-quang: gãy cổ xương bàn tay thứ 5, gập góc về phía lòng 15°, không lan vào khớp." },
        ],
        summary:
            "Khám sáng hôm sau chấn thương khi đấm bao cát. Gãy kín cổ xương bàn tay thứ 5 bên phải, gập góc ít, phù hợp điều trị bảo tồn.",
        recommendations:
            "Nẹp máng trụ trong 4 tuần, chụp X-quang lại sau 1 tuần. Được tập có hạn chế: không đánh bằng tay phải, không bao cát, đấm đích hay đấu tập; vẫn được tập di chuyển, sức mạnh thân dưới và thể lực. Tái khám kèm chụp X-quang sau 4 tuần.",
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
                area: "Sờ nắn — xương sườn dưới bên trái",
                result: "abnormal",
                note: "Đau khu trú ở xương sườn 9–10 trên đường nách giữa; không có tiếng lạo xạo hay biến dạng bậc thang.",
            },
            { area: "Ép lồng ngực", result: "normal", note: "Ép trước – sau không gây đau nhói." },
            { area: "Hô hấp", result: "normal", note: "Rì rào phế nang đều và rõ hai bên; SpO2 99%." },
            { area: "Đau khi vận động", result: "abnormal", note: "Đau khi hít sâu và xoay thân (4/10)." },
        ],
        summary:
            "Khám ngày hôm sau khi bị đè gối lên bụng trong các hiệp vật. Dấu hiệu phù hợp với đụng dập xương sườn dưới bên trái; không có dấu hiệu lâm sàng của gãy xương hay tổn thương phổi.",
        recommendations:
            "Tập theo mức đau: giảm vật thực chiến và các tư thế bị đè ngực cho đến khi hít sâu thoải mái (thường 1–2 tuần). Dùng paracetamol khi cần. Quay lại khám ngay nếu khó thở.",
    }),
    routineExam("f-sofia-kowalski", 35, {
        followUpInDays: 4,
        summary: "Khám định kỳ trước Lotus Fight Night 17. Không có vấn đề sức khỏe; cân nặng đúng tiến độ.",
        recommendations: "Đã đặt lịch khám trước trận và gia hạn cấp phép y tế trước khi cấp phép hiện tại hết hạn.",
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
            area: "Khám cơ xương khớp",
            result: "abnormal",
            note: "Co cứng cơ cạnh sống L3–L5 hai bên; gập thắt lưng hết tầm nhưng khó chịu ở cuối tầm. Không có dấu hiệu chèn ép rễ; khám thần kinh bình thường.",
        },
        weight: (v) => ({
            area: "Cân nặng và bù nước",
            result: "abnormal",
            note: `${weightNote("f-hoang-long", v.weightKg)} Tỷ trọng nước tiểu 1,026 — bù nước mức trung bình.`,
        }),
        summary:
            "Khám định kỳ trong giai đoạn giảm cân. Võ sĩ báo căng lưng dưới sau các buổi tập dài; không có dấu hiệu thần kinh. Lúc đến khám bù nước chỉ ở mức trung bình.",
        recommendations:
            "Đủ điều kiện tập. Giảm cân khoảng 1% trọng lượng cơ thể mỗi tuần, không hạn chế nước ngoài tuần thi đấu. Tập giãn cột sống thắt lưng hằng ngày. Kiểm tra cân nặng và bù nước sau 2 tuần.",
    }),

    /* Tariq Haddad — left knee MCL sprain, recovery */
    baselineExam("f-tariq-haddad", 310, {
        musculoskeletal: "Biên độ đầy đủ. Gối phải đã tái tạo dây chằng chéo trước (ACL) năm 2019, ổn định, test bật nhảy cân xứng.",
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
            { area: "Quan sát", result: "abnormal", note: "Sưng nhẹ mặt trong gối trái; không tràn dịch khớp." },
            { area: "Nghiệm pháp dạng gối (valgus) ở 30°", result: "abnormal", note: "Đau, khe khớp mở rất ít, cảm giác chặn cuối tầm chắc (độ I)." },
            { area: "Nghiệm pháp dạng gối (valgus) ở 0°", result: "normal", note: "Vững khi duỗi thẳng hoàn toàn." },
            { area: "Nghiệm pháp Lachman", result: "normal", note: "Điểm dừng chắc; cân xứng với gối phải đã tái tạo dây chằng." },
            { area: "Nghiệm pháp McMurray", result: "normal", note: "Không có dấu hiệu tổn thương sụn chêm." },
            { area: "Dáng đi", result: "abnormal", note: "Đi tránh đau nhẹ." },
        ],
        summary:
            "Khám ngày hôm sau chấn thương vẹo gối trái vào trong khi tập vòng thể lực. Dấu hiệu phù hợp với bong gân dây chằng bên trong (MCL) độ I; dây chằng chéo và sụn chêm còn nguyên vẹn trên lâm sàng. Đã chỉ định siêu âm do tiền sử tái tạo ACL gối phải.",
        recommendations:
            "Được tập có hạn chế: chỉ tập kỹ thuật quyền anh thân trên và thể lực — không đấu tập, không đá, không chạy hay bật nhảy; cường độ buổi tập tối đa RPE 6. Đeo nẹp gối có bản lề trong 3 tuần. Vật lý trị liệu để phục hồi biên độ vận động và kích hoạt cơ tứ đầu đùi.",
    }),
    exam({
        fighterId: "f-tariq-haddad",
        dayOffset: 21,
        type: "post_injury",
        label: "review",
        hour: 11,
        outcome: "fit_with_restrictions",
        assessments: [
            { area: "Nghiệm pháp dạng gối (valgus) ở 30°", result: "normal", note: "Không đau, cảm giác chặn cuối tầm chắc." },
            { area: "Biên độ vận động", result: "normal", note: "0–140°, cân xứng." },
            { area: "Sức cơ", result: "abnormal", note: "Sức cơ tứ đầu đùi bằng 82% bên phải." },
            { area: "Squat một chân", result: "inconclusive", note: "Gối hơi vẹo vào trong khi mỏi." },
        ],
        summary: "Tái khám sau hai tuần. Dây chằng không đau khi làm nghiệm pháp, biên độ đầy đủ; sức cơ và khả năng kiểm soát vẫn đang hồi phục.",
        recommendations: "Giữ nguyên các hạn chế. Bỏ nẹp dần trong 5 ngày tới, tăng bài tập phục hồi sức mạnh và bắt đầu chạy thẳng.",
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
            { area: "Nghiệm pháp dạng gối (valgus) ở 30°", result: "normal", note: "Vững và không đau." },
            { area: "Sức cơ", result: "normal", note: "Cơ tứ đầu đùi bằng 93% và gân kheo bằng 95% bên phải." },
            { area: "Test bật nhảy một chân", result: "normal", note: "Bật xa một chân bằng 91% và bật ba bước bằng 90% bên phải." },
            { area: "Đổi hướng", result: "inconclusive", note: "Không đau nhưng còn dè dặt khi đổi hướng gắt sang trái." },
            { area: "Di chuyển khi mỏi", result: "normal", note: "Xoay trụ và di chuyển ngang khi tập đích không có triệu chứng." },
        ],
        summary:
            "Đánh giá trở lại tập luyện. Đạt tiêu chí sức cơ và bật nhảy để tập chuyên môn; sự tự tin khi đổi hướng gắt vẫn đang cải thiện.",
        recommendations:
            "Được tập có hạn chế: không đấu tập, không đá, cường độ buổi tập tối đa RPE 8, bảo vệ đầu gối trái. Được tập đấm đích, bao cát và di chuyển đầy đủ. Đánh giá lần cuối trước khi bỏ hạn chế.",
    }),

    /* Emma Lindqvist — healthy, previous ankle sprain */
    baselineExam("f-emma-lindqvist", 335, {
        respiratory: "Phổi trong lúc nghỉ. Tiền sử hen nhẹ do gắng sức, kiểm soát tốt bằng thuốc cắt cơn trước các buổi tập cường độ cao.",
    }),
    routineExam("f-emma-lindqvist", 272),
    exam({
        fighterId: "f-emma-lindqvist",
        dayOffset: 209,
        type: "post_injury",
        label: "ankle",
        outcome: "fit_with_restrictions",
        assessments: [
            { area: "Quan sát", result: "abnormal", note: "Sưng và bầm tím vừa phải quanh mắt cá ngoài." },
            {
                area: "Tiêu chuẩn Ottawa cổ chân",
                result: "normal",
                note: "Không đau trên xương ở mắt cá, xương thuyền hay nền xương bàn chân thứ 5; chịu được sức nặng. Không cần chụp X-quang.",
            },
            { area: "Nghiệm pháp ngăn kéo trước", result: "abnormal", note: "Lỏng hơn, điểm dừng mềm so với bên phải." },
            { area: "Nghiệm pháp nghiêng sên", result: "normal", note: "Không lỏng dây chằng gót – mác." },
            { area: "Biên độ vận động", result: "abnormal", note: "Gập mu bàn chân bị hạn chế do đau và sưng." },
        ],
        summary:
            "Khám sáng hôm sau chấn thương lật cổ chân vào trong khi đấu tập. Dấu hiệu phù hợp với bong gân dây chằng sên – mác trước độ II; không có dấu hiệu gãy xương.",
        recommendations:
            "Được tập có hạn chế: không đấu tập, không đá, không bật nhảy hay đổi hướng; được tập thân trên và thể lực ở tư thế ngồi. Băng ép, kê cao chân và sớm chịu lực có bảo vệ. Bắt đầu vật lý trị liệu trong tuần này.",
    }),
    exam({
        fighterId: "f-emma-lindqvist",
        dayOffset: 172,
        type: "return_to_play",
        label: "rtp",
        hour: 11,
        assessments: [
            { area: "Nghiệm pháp ngăn kéo trước", result: "normal", note: "Điểm dừng chắc, cân xứng." },
            { area: "Test Y-balance", result: "normal", note: "Tổng tầm với bằng 97% bên phải." },
            { area: "Test bật nhảy một chân", result: "normal", note: "Bật xa một chân bằng 96% bên phải." },
            { area: "Bài tập chuyên môn", result: "normal", note: "Đá đích hết sức và đá đổi chân không có triệu chứng." },
        ],
        summary: "Đánh giá trở lại tập luyện sau bong gân cổ chân trái. Đạt tất cả tiêu chí trở lại.",
        recommendations:
            "Được tập đầy đủ, kể cả đấu tập. Tiếp tục tập thăng bằng hai lần mỗi tuần trong 3 tháng; có thể đeo nẹp cổ chân dạng buộc dây khi đấu tập.",
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
            "Thấy giật mạnh ở mặt sau đùi trái khi tranh chấp tư thế lúc đấu tập; không thể tập tiếp. Đau giữa bụng cơ nhị đầu đùi, gập gối có kháng lực gây đau. MRI xác nhận căng cơ độ II ở đầu dài cơ nhị đầu đùi.",
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
            "Trúng một cú tay phải gọn khi tách ôm ở hiệp 3 buổi đấu tập. Không mất ý thức; chậm nâng lại thế thủ, sau đó báo đau đầu, chóng mặt và cảm giác 'lơ mơ'. HLV dừng buổi tập. SCAT6 buổi tối cho thấy điểm triệu chứng, nhận thức và thăng bằng kém hơn mức ban đầu; không có dấu hiệu nguy hiểm.",
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
            "Đau ngay ở khớp đốt ngón út tay phải sau cú đòn thẳng (cross) vào bao cát ở hiệp 4; dừng buổi tập. Sưng và đau khu trú ở cổ xương bàn tay thứ 5, khớp đốt ngón bị lõm; không biến dạng xoay. X-quang xác nhận gãy kín cổ xương bàn tay thứ 5, gập góc về phía lòng 15°, điều trị bảo tồn.",
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
            "Đau mặt trong gối trái khi gối khuỵu vào trong lúc lunge ngang trong vòng tập thể lực; tự đi ra được, hơi khập khiễng. Đau trên dây chằng bên trong, nghiệm pháp dạng gối ở 30° gây đau với cảm giác chặn cuối tầm chắc; Lachman và McMurray âm tính. Siêu âm phù hợp với bong gân MCL độ I.",
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
            "Nhiều đòn đá bị chặn trong trận đấu gây bầm tím và khối máu tụ chắc ở mặt trước cẳng chân phải. Không đau trên xương, bật nhảy không đau nên không cần chẩn đoán hình ảnh.",
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
            "Lật cổ chân trái khi tiếp đất sau cú đá đổi chân bị chặn lúc đấu tập. Sưng và đau trên dây chằng sên – mác trước, nghiệm pháp ngăn kéo trước lỏng hơn; tiêu chuẩn Ottawa âm tính. Phù hợp với bong gân ngoài cổ chân độ II.",
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
            "Bị đè gối lên bụng trong các hiệp vật. Đau khu trú ở xương sườn 9–10 bên trái khi hít sâu và xoay thân; không có tiếng lạo xạo hay biến dạng, rì rào phế nang bình thường. Phù hợp với đụng dập xương sườn.",
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
            "Vết rách 2 cm ở cung mày trái do vô tình va đầu ở hiệp 2 trận đấu. Đã khâu 4 mũi ngay tại sàn đấu. Không có triệu chứng chấn động não; SCAT6 bằng mức ban đầu.",
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
        description: "Nghỉ tương đối, chườm lạnh và băng ép — 72 giờ đầu",
        frequency: "Chườm lạnh 15 phút mỗi 2–3 giờ khi thức",
        startDate: daysAgo(24, 19, 30),
        endDate: daysAgo(21, 19, 0),
        status: "completed",
        notes: "Không cần nạng; đến ngày thứ 3 đi bộ không đau.",
    },
    {
        id: "tr-lucas-mri",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: THU_LE_NAME,
        type: "imaging",
        description: "Chụp MRI đùi trái",
        frequency: "Chụp một lần",
        startDate: daysAgo(22, 14, 0),
        endDate: daysAgo(22, 15, 0),
        status: "completed",
        notes: "Căng cơ độ II ở đầu dài cơ nhị đầu đùi; gân trong cơ còn nguyên vẹn.",
    },
    {
        id: "tr-lucas-physio",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: SAMUEL_BROOKS_NAME,
        type: "physiotherapy",
        description: "Vật lý trị liệu — tăng tải dần (Nordic curl, bài tập đẳng trường)",
        frequency: "3 lần/tuần",
        startDate: daysAgo(20, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Đã chuyển từ bài tập đẳng trường sang Nordic curl 3×6. Tiếp theo: tải tốc độ cao.",
    },
    {
        id: "tr-lucas-soft-tissue",
        injuryId: "inj-lucas-hamstring",
        fighterId: "f-lucas-ferreira",
        providerName: LOTUS_PHYSIO,
        type: "manual_therapy",
        description: "Trị liệu mô mềm — chuỗi cơ phía sau",
        frequency: "2 lần/tuần",
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
        description: "Lộ trình chạy — từ 50% đến 90% tốc độ tối đa",
        frequency: "3 lần/tuần, không tập hai ngày liền",
        startDate: daysAgo(10, 16, 0),
        endDate: null,
        status: "ongoing",
        notes: "Hiện chạy ở 80% tốc độ tối đa, không có triệu chứng.",
    },

    // Diego — concussion
    {
        id: "tr-diego-rest",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "rest",
        description: "Nghỉ tương đối (trí óc và thể chất)",
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
        frequency: "Ghi bảng triệu chứng hằng ngày; sàng lọc lại trước mỗi bước",
        startDate: daysAgo(5, 9, 0),
        endDate: null,
        status: "ongoing",
        notes: "Triệu chứng giảm dần; không báo dấu hiệu nguy hiểm nào.",
    },
    {
        id: "tr-diego-protocol",
        injuryId: "inj-diego-concussion",
        fighterId: "f-diego-alvarez",
        providerName: THU_LE_NAME,
        type: "physiotherapy",
        description: "Phác đồ trở lại tập luyện theo từng bước",
        frequency: "Hằng ngày; mỗi bước ít nhất 24 giờ không có triệu chứng",
        startDate: daysAgo(3, 11, 0),
        endDate: null,
        status: "ongoing",
        notes: "Hiện ở bước 2 — vận động ưa khí nhẹ.",
    },

    // Marcus — right 5th metacarpal fracture
    {
        id: "tr-marcus-analgesia",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "medication",
        description: "Giảm đau — paracetamol khi cần",
        frequency: "Tối đa 4 lần/ngày trong tuần đầu",
        startDate: daysAgo(11, 19, 30),
        endDate: daysAgo(4, 9, 0),
        status: "completed",
        notes: "Tránh NSAID trong giai đoạn đầu liền xương.",
    },
    {
        id: "tr-marcus-immobilisation",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "immobilisation",
        description: "Bất động — nẹp máng trụ 4 tuần",
        frequency: "Đeo liên tục; chỉ tháo để kiểm tra da",
        startDate: daysAgo(10, 9, 30),
        endDate: daysFromNow(18, 9, 30),
        status: "ongoing",
        notes: "Nẹp cả ngón nhẫn và ngón út, khớp đốt ngón gập 70°.",
    },
    {
        id: "tr-marcus-xray",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: THU_LE_NAME,
        type: "imaging",
        description: "Chụp X-quang theo dõi",
        frequency: "Sau 1 tuần và 4 tuần",
        startDate: daysAgo(3, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Phim sau 1 tuần: giữ được trục, góc gập không đổi ở 15°. Phim sau 4 tuần chụp khi tháo nẹp.",
    },
    {
        id: "tr-marcus-hand-therapy",
        injuryId: "inj-marcus-hand",
        fighterId: "f-marcus-hale",
        providerName: SAMUEL_BROOKS_NAME,
        type: "specialist_referral",
        description: "Chuyển phục hồi chức năng bàn tay",
        frequency: "2 lần/tuần sau khi tháo nẹp",
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
        description: "Chườm lạnh, băng ép và kê cao chân",
        frequency: "15 phút, 3–4 lần/ngày",
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
        description: "Siêu âm gối trái",
        frequency: "Chụp một lần",
        startDate: daysAgo(36, 14, 0),
        endDate: daysAgo(36, 14, 30),
        status: "completed",
        notes: "Sợi MCL đoạn gần dày lên, phù hợp với bong gân độ I; không rách toàn bộ bề dày, không tràn dịch.",
    },
    {
        id: "tr-tariq-brace",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "immobilisation",
        description: "Nẹp gối có bản lề",
        frequency: "Đeo khi tập và sinh hoạt hằng ngày, 3 tuần",
        startDate: daysAgo(37, 12, 0),
        endDate: daysAgo(16, 12, 0),
        status: "completed",
        notes: "Đã bỏ nẹp dần sau lần tái khám hai tuần.",
    },
    {
        id: "tr-tariq-strength",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: LOTUS_PHYSIO,
        type: "strength_rehab",
        description: "Phục hồi sức mạnh — cơ tứ đầu đùi, hông và cơ khép",
        frequency: "3 lần/tuần",
        startDate: daysAgo(30, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Lần kiểm tra gần nhất: sức cơ tứ đầu đùi bằng 93% bên phải.",
    },
    {
        id: "tr-tariq-agility",
        injuryId: "inj-tariq-knee",
        fighterId: "f-tariq-haddad",
        providerName: SAMUEL_BROOKS_NAME,
        type: "physiotherapy",
        description: "Lộ trình tập nhanh nhẹn",
        frequency: "3 lần/tuần",
        startDate: daysAgo(10, 10, 0),
        endDate: null,
        status: "ongoing",
        notes: "Bước trượt ngang, xoay trụ và đổi hướng; đổi hướng gắt sang trái vẫn đang tiến triển.",
    },

    // Minh — right shin contusion (resolved)
    {
        id: "tr-minh-ice",
        injuryId: "inj-minh-shin",
        fighterId: "f-minh-tran",
        providerName: THU_LE_NAME,
        type: "ice_compression",
        description: "Chườm lạnh và băng ép",
        frequency: "15 phút, 3–4 lần/ngày trong 72 giờ",
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
        description: "Nghỉ tương đối — tuần nghỉ sau trận",
        frequency: "7 ngày, sau đó tập đá trở lại theo mức đau",
        startDate: daysAgo(149, 10, 30),
        endDate: daysAgo(142, 10, 0),
        status: "completed",
        notes: "Khối máu tụ đã tan; tập đá đầy đủ trở lại từ ngày thứ 10.",
    },

    // Emma — left ankle sprain (resolved)
    {
        id: "tr-emma-compression",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        providerName: THU_LE_NAME,
        type: "ice_compression",
        description: "Băng ép, kê cao chân và chịu lực có bảo vệ",
        frequency: "Băng ép hằng ngày; kê cao chân 3 lần/ngày",
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
        notes: "Khi kết thúc: tổng tầm với Y-balance bằng 97% bên phải.",
    },
    {
        id: "tr-emma-strength",
        injuryId: "inj-emma-ankle",
        fighterId: "f-emma-lindqvist",
        providerName: LOTUS_PHYSIO,
        type: "strength_rehab",
        description: "Phục hồi sức mạnh — cơ bắp chân và cơ mác",
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
        description: "Điều chỉnh tập luyện — không vật thực chiến cho đến khi thở không đau",
        frequency: "Đến khi hết triệu chứng",
        startDate: daysAgo(94, 10, 30),
        endDate: daysAgo(82, 10, 0),
        status: "completed",
        notes: "Trở lại randori thực chiến từ ngày thứ 13.",
    },

    // Aigerim — eyebrow laceration (resolved)
    {
        id: "tr-aigerim-wound-care",
        injuryId: "inj-aigerim-brow",
        fighterId: "f-aigerim-sadykova",
        providerName: SAMUEL_BROOKS_NAME,
        type: "medication",
        description: "Chăm sóc vết thương — vệ sinh hằng ngày và bôi thuốc mỡ kháng sinh",
        frequency: "Hằng ngày đến khi cắt chỉ",
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
        description: "Không đấu tập hoặc va chạm vùng đầu cho đến khi kiểm tra vết thương",
        frequency: "10 ngày",
        startDate: daysAgo(59, 11, 0),
        endDate: daysAgo(49, 11, 0),
        status: "completed",
        notes: "Đã cắt chỉ khi kiểm tra; sẹo lành tốt.",
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
        title: "Căng cơ gân kheo trái — trở lại tập vật",
        startDate: daysAgo(23, 10, 45),
        targetReturnDate: daysFromNow(18, 18, 0),
        status: "active",
        phases: phases("rp-lucas-hamstring", [
            {
                name: "Bảo vệ và kiểm soát đau",
                goal: "Giảm đau và bảo vệ cơ đang lành, đồng thời duy trì vận động cho các phần còn lại của cơ thể.",
                from: -23,
                to: -19,
                status: "completed",
                milestones: [
                    ["Đi bộ không đau", true],
                    ["Đã xem MRI và xác nhận mức độ căng cơ", true],
                ],
            },
            {
                name: "Tải sớm và phục hồi vận động",
                goal: "Phục hồi biên độ vận động và bắt đầu tải đẳng trường trong ngưỡng không đau.",
                from: -19,
                to: -10,
                status: "completed",
                milestones: [
                    ["Giữ đẳng trường ở 90°, 60° và 30° không đau", true],
                    ["Duỗi gối chủ động lệch không quá 10° so với bên phải", true],
                    ["Đạt đánh giá trở lại tập luyện", true],
                ],
            },
            {
                name: "Tăng sức mạnh dần",
                goal: "Xây dựng sức mạnh ly tâm của gân kheo và phục hồi kỹ thuật chạy.",
                from: -10,
                to: 4,
                status: "current",
                milestones: [
                    ["Nordic curl 3×6 không đau", true],
                    ["Chạy ở 70% tốc độ tối đa không đau", true],
                    ["Sức cơ gân kheo ≥ 90% bên phải", false],
                    ["Chạy nước rút ở 90% tốc độ tối đa không đau", false],
                ],
            },
            {
                name: "Tái thích nghi chuyên môn",
                goal: "Đưa dần trở lại các động tác vật bùng nổ và đòn đá.",
                from: 4,
                to: 12,
                status: "upcoming",
                milestones: [
                    ["Chạy nước rút hết tốc độ và đổi hướng", false],
                    ["Tập vật theo tình huống không có triệu chứng", false],
                    ["Đá đích ở 50% sức không có triệu chứng", false],
                ],
            },
            {
                name: "Trở lại tập luyện đầy đủ",
                goal: "Chịu được các tuần tập đầy đủ, kể cả hiệp thực chiến, trước khi bỏ hạn chế.",
                from: 12,
                to: 18,
                status: "upcoming",
                milestones: [
                    ["Vật thực chiến không có triệu chứng", false],
                    ["Sức cơ gân kheo ≥ 95% bên phải", false],
                    ["Đạt đánh giá trở lại tập luyện", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-lucas-hamstring",
            [
                [22, "Đau khi lên cầu thang và khi cúi người; đi bộ ngắn thì thoải mái. Băng ép và tập đẳng trường nhẹ."],
                [19, "Đi bộ không đau. Giữ đẳng trường ở 90° và 60° chịu tốt."],
                [17, "Bài cầu mông và đẳng trường ở 30° không đau; không đau lại sau bài tập giai đoạn 2. Đạp xe tại chỗ 20 phút.", 18, 10],
                [13, "Bắt đầu bài gập gối ly tâm với tấm trượt. Hơi căng vào sáng hôm sau, đến trưa thì hết."],
                [10, "Đạt đánh giá trở lại tập luyện, có hạn chế. Chạy nhẹ và chạy tăng tốc ở 60% không đau."],
                [7, "Bắt đầu Nordic curl 3×5. Chạy ở 70% sức không có triệu chứng."],
                [4, "Nordic curl 3×6 không đau. Tập kỹ thuật vật (không vật thực chiến) ở RPE 6."],
                [1, "Hơi căng sau khi chạy nước rút 80%, đến tối thì hết. Kiểm tra lại sức cơ khi đánh giá cuối giai đoạn.", 13, 42],
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
        title: "Phác đồ trở lại tập luyện theo từng bước",
        startDate: daysAgo(6, 20, 0),
        targetReturnDate: daysFromNow(10, 18, 0),
        status: "active",
        phases: phases("rp-diego-concussion", [
            {
                name: "Hoạt động trong ngưỡng triệu chứng",
                goal: "Nghỉ tương đối trong 24–48 giờ đầu, sau đó sinh hoạt hằng ngày ở mức không gây triệu chứng.",
                from: -6,
                to: -3,
                status: "completed",
                milestones: [
                    ["Hoàn thành 24–48 giờ nghỉ tương đối", true],
                    ["Sinh hoạt hằng ngày không làm triệu chứng nặng hơn", true],
                ],
            },
            {
                name: "Vận động ưa khí nhẹ",
                goal: "Đi bộ hoặc đạp xe tại chỗ ở tốc độ chậm đến vừa để tăng nhịp tim; không tập kháng lực.",
                from: -3,
                to: 1,
                status: "current",
                milestones: [
                    ["Đi bộ 30 phút không tăng triệu chứng", true],
                    ["Đạp xe tại chỗ 20 phút ở ≤ 55% nhịp tim tối đa", true],
                    ["Chịu được buổi ưa khí vừa (≤ 70% nhịp tim tối đa)", false],
                    ["Không có triệu chứng khi nghỉ", false],
                ],
            },
            {
                name: "Bài tập chuyên môn (không va chạm)",
                goal: "Tập cá nhân, không va chạm — chạy, nhảy dây và đánh bóng.",
                from: 1,
                to: 3,
                status: "upcoming",
                milestones: [
                    ["Chạy và nhảy dây không có triệu chứng", false],
                    ["Đánh bóng và tập di chuyển không có triệu chứng", false],
                ],
            },
            {
                name: "Bài tập không va chạm",
                goal: "Bài tập nặng hơn nhưng không có nguy cơ va chạm vùng đầu, kèm tập kháng lực. Phải hết triệu chứng.",
                from: 3,
                to: 6,
                status: "upcoming",
                milestones: [
                    ["Đấm đích và tập kỹ thuật vật (không thực chiến) không có triệu chứng", false],
                    ["Tập kháng lực trở lại", false],
                    ["SCAT6 trở về mức ban đầu", false],
                ],
            },
            {
                name: "Tập có va chạm đầy đủ (sau khi được cấp phép y tế)",
                goal: "Tập bình thường, kể cả va chạm có kiểm soát, chỉ sau khi bác sĩ cấp phép.",
                from: 6,
                to: 9,
                status: "upcoming",
                milestones: [
                    ["Được cấp phép y tế để tập có va chạm", false],
                    ["Đấu tập có kiểm soát và vật thực chiến không có triệu chứng", false],
                ],
            },
            {
                name: "Trở lại thi đấu",
                goal: "Tập không hạn chế và đủ điều kiện thi đấu.",
                from: 9,
                to: 10,
                status: "upcoming",
                milestones: [
                    ["Một tuần tập đầy đủ không có triệu chứng", false],
                    ["Cấp phép y tế được nâng lên mức đầy đủ", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-diego-concussion",
            [
                [5, "Đau đầu và sợ ánh sáng khi thức dậy; ngủ kém. Tiếp tục nghỉ tương đối."],
                [3, "Triệu chứng giảm; đi bộ 30 phút không nặng hơn. Chuyển sang bước vận động ưa khí nhẹ sau khi khám."],
                [1, "Đạp xe tại chỗ 20 phút ở ≤ 55% nhịp tim tối đa, chịu tốt. Chỉ đau đầu nhẹ về chiều."],
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
        title: "Gãy xương bàn tay thứ 5 bên phải — trở lại tập đánh",
        startDate: daysAgo(10, 9, 30),
        targetReturnDate: daysFromNow(31, 18, 0),
        status: "active",
        phases: phases("rp-marcus-hand", [
            {
                name: "Bảo vệ và bất động",
                goal: "Bảo vệ ổ gãy trong nẹp, đồng thời duy trì sức mạnh thân dưới và thể lực.",
                from: -10,
                to: 18,
                status: "current",
                milestones: [
                    ["Đã đeo nẹp và kiểm tra da", true],
                    ["X-quang sau 1 tuần giữ được trục", true],
                    ["Đau ≤ 2/10 khi sinh hoạt hằng ngày", true],
                    ["X-quang sau 4 tuần cho thấy xương đang liền", false],
                ],
            },
            {
                name: "Phục hồi vận động sớm",
                goal: "Phục hồi cử động ngón tay và cổ tay sau khi tháo nẹp.",
                from: 18,
                to: 23,
                status: "upcoming",
                milestones: [
                    ["Nắm chặt tay không đau", false],
                    ["Biên độ cổ tay và ngón tay ≥ 90% bên trái", false],
                ],
            },
            {
                name: "Sức mạnh và tăng dần va chạm",
                goal: "Phục hồi lực nắm và đưa trở lại các đòn đánh kỹ thuật nhẹ.",
                from: 23,
                to: 28,
                status: "upcoming",
                milestones: [
                    ["Lực nắm ≥ 80% bên trái", false],
                    ["Đánh bóng nhẹ và đấm đích kỹ thuật có quấn băng tay", false],
                ],
            },
            {
                name: "Trở lại tập đánh",
                goal: "Tăng dần lên đấm bao cát và đấm đích hết lực trước khi xét cấp phép.",
                from: 28,
                to: 31,
                status: "upcoming",
                milestones: [
                    ["Đấm bao cát hết lực không đau", false],
                    ["Đạt đánh giá trở lại tập luyện", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-marcus-hand",
            [
                [9, "Đã đeo nẹp từ hôm qua; đau nhức về đêm giảm khi kê cao tay. Ngón tay ấm, cảm giác bình thường."],
                [6, "Đỡ sưng. Tập sức mạnh thân dưới và đạp xe thể lực không đau tay."],
                [3, "X-quang sau 1 tuần: giữ được trục. Đau 2/10 khi sinh hoạt hằng ngày."],
                [1, "Đeo nẹp thoải mái. Tập di chuyển và chạy không có triệu chứng ở tay."],
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
        title: "Bong gân MCL gối trái — trở lại tập quyền anh",
        startDate: daysAgo(37, 12, 0),
        targetReturnDate: daysFromNow(6, 18, 0),
        status: "active",
        phases: phases("rp-tariq-knee", [
            {
                name: "Bảo vệ và kiểm soát sưng",
                goal: "Giảm sưng và bảo vệ dây chằng bằng nẹp gối có bản lề.",
                from: -37,
                to: -30,
                status: "completed",
                milestones: [
                    ["Hết sưng", true],
                    ["Đi không khập khiễng khi đeo nẹp", true],
                ],
            },
            {
                name: "Biên độ vận động và kích hoạt cơ",
                goal: "Phục hồi biên độ gối đầy đủ và kích hoạt cơ tứ đầu đùi.",
                from: -30,
                to: -21,
                status: "completed",
                milestones: [
                    ["Biên độ gối 0–135°", true],
                    ["Nâng chân thẳng không bị trễ", true],
                ],
            },
            {
                name: "Sức mạnh và kiểm soát thần kinh – cơ",
                goal: "Xây dựng lại sức mạnh chân và kiểm soát gối khi chịu tải.",
                from: -21,
                to: -10,
                status: "completed",
                milestones: [
                    ["Sức cơ tứ đầu đùi ≥ 85% bên phải", true],
                    ["Chạy thẳng không đau", true],
                    ["Đã bỏ nẹp", true],
                ],
            },
            {
                name: "Chạy và nhanh nhẹn",
                goal: "Chịu được di chuyển ngang, bật nhảy và xoay trụ.",
                from: -10,
                to: -5,
                status: "completed",
                milestones: [
                    ["Test bật nhảy ≥ 90% bên phải", true],
                    ["Bước trượt ngang và xoay trụ không đau", true],
                ],
            },
            {
                name: "Trở lại tập chuyên môn",
                goal: "Tập đầy đủ di chuyển, đấm đích và bao cát quyền anh ở cường độ tập luyện trước khi bỏ hạn chế.",
                from: -5,
                to: 6,
                status: "current",
                milestones: [
                    ["Buổi đấm đích và bao cát đầy đủ ở RPE 8 không có triệu chứng", true],
                    ["Tự tin đổi hướng gắt sang cả hai bên", false],
                    ["Đạt đánh giá cuối trước khi trở lại tập luyện", false],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-tariq-knee",
            [
                [36, "Đau nhẹ mặt trong gối khi lên cầu thang; đỡ sưng nhờ chườm lạnh và băng ép. Đang đeo nẹp."],
                [33, "Đi không khập khiễng khi đeo nẹp. Tập co cơ tứ đầu và nâng chân thẳng."],
                [30, "Đạp xe tại chỗ 15 phút không đau. Biên độ 0–120°."],
                [27, "Biên độ 0–135°. Thêm bài squat nông và bước bục."],
                [25, "Đạp chân trên máy và squat tách chân không đau. Vẫn tập kỹ thuật quyền anh thân trên.", 19, 5],
                [21, "Tái khám sau hai tuần: dây chằng không đau. Tuần này bỏ nẹp dần."],
                [18, "Tháo nẹp khi tập. Chạy thẳng nhẹ 10 phút."],
                [15, "Chạy biến tốc và tập thăng bằng một chân không có triệu chứng."],
                [12, "Bước trượt ngang và thang dây ở tốc độ vừa. Hơi mỏi sau buổi tập, đến sáng thì hết."],
                [9, "Test bật nhảy bằng 88% bên phải. Tập xoay trụ khi đấm đích không đau."],
                [6, "Không đau gối khi chạy nhẹ và bước trượt ngang; vẫn còn dè dặt khi đổi hướng gắt sang trái.", 9, 20],
                [3, "Buổi đấm đích và bao cát đầy đủ ở RPE 8 có xoay trụ, gối không có triệu chứng."],
                [1, "Di chuyển tốt dù đã mỏi. Đã đặt lịch đánh giá cuối."],
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
        title: "Bong gân cổ chân trái — trở lại tập kickboxing",
        startDate: daysAgo(209, 10, 30),
        targetReturnDate: daysAgo(172, 18, 0),
        status: "completed",
        phases: phases("rp-emma-ankle", [
            {
                name: "Bảo vệ và kiểm soát sưng",
                goal: "Kiểm soát sưng và đi lại bình thường.",
                from: -209,
                to: -204,
                status: "completed",
                milestones: [
                    ["Đã kiểm soát được sưng", true],
                    ["Chịu lực hoàn toàn, đi không khập khiễng", true],
                ],
            },
            {
                name: "Biên độ vận động và thăng bằng",
                goal: "Phục hồi biên độ cổ chân và thăng bằng một chân.",
                from: -204,
                to: -195,
                status: "completed",
                milestones: [
                    ["Gập mu bàn chân lệch không quá 5° so với bên phải", true],
                    ["Đứng một chân 30 giây, mở mắt", true],
                ],
            },
            {
                name: "Sức mạnh và cảm thụ bản thể",
                goal: "Xây dựng sức mạnh cơ bắp chân, cơ mác và khả năng kiểm soát cổ chân.",
                from: -195,
                to: -186,
                status: "completed",
                milestones: [
                    ["Nhón gót một chân 3×15", true],
                    ["Chạy nhẹ không đau", true],
                ],
            },
            {
                name: "Chạy và nhanh nhẹn",
                goal: "Chịu được đổi hướng, bật nhảy và tiếp đất.",
                from: -186,
                to: -179,
                status: "completed",
                milestones: [
                    ["Di chuyển ngang và bật nhảy không đau", true],
                    ["Test bật nhảy ≥ 90% bên phải", true],
                ],
            },
            {
                name: "Trở lại tập luyện đầy đủ",
                goal: "Đá hết sức và sẵn sàng đấu tập.",
                from: -179,
                to: -172,
                status: "completed",
                milestones: [
                    ["Đá đích hết sức", true],
                    ["Đạt đánh giá trở lại tập luyện", true],
                ],
            },
        ]),
        checkIns: checkIns(
            "rp-emma-ankle",
            [
                [208, "Sưng và bầm quanh mắt cá ngoài; đi lại có băng ép, hơi khập khiễng."],
                [205, "Đỡ sưng. Chịu lực hoàn toàn, hơi khập khiễng khi lên cầu thang."],
                [201, "Bắt đầu tập ván thăng bằng và bài xoay ngoài với dây kháng lực."],
                [197, "Gập mu bàn chân cải thiện; đạp xe tại chỗ và đấm đích thân trên."],
                [193, "Chạy nhẹ trên nền phẳng không đau. Đứng một chân 30 giây."],
                [189, "Nhón gót một chân 3×15. Chạy thẳng ở 70%."],
                [185, "Di chuyển ngang và nhảy dây không đau."],
                [181, "Đá đích ở 60% sức không có triệu chứng. Test bật nhảy bằng 90% bên phải."],
                [177, "Đấm đá đích hết sức và đá đổi chân không đau."],
                [173, "Tự tin đổi hướng và tiếp đất. Sẵn sàng đánh giá trở lại tập luyện."],
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

const BASELINE_REASON = "Khám thể lực ban đầu đạt yêu cầu. Được phép tập đối kháng toàn phần và thi đấu.";
const RENEWAL_REASON = "Khám định kỳ đạt yêu cầu. Gia hạn cấp phép, không có hạn chế.";

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
        reason: "Khám trước trận đạt yêu cầu. Được phép thi đấu và tập luyện không hạn chế.",
    }),
    clearance({
        id: "cl-minh-current",
        fighterId: "f-minh-tran",
        level: "full",
        status: "active",
        issuedAt: daysAgo(20, 16, 5),
        validUntil: endOfDay(120),
        examinationId: "ex-minh-routine-20d",
        reason: "Khám thể lực trước giai đoạn chuẩn bị thi đấu đạt yêu cầu. Được phép tập đầy đủ và thi đấu, không có hạn chế.",
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
        revokedReason: "Chấn thương gân kheo trái khi đấu tập. Thu hồi cấp phép đầy đủ trong khi chờ khám.",
    }),
    clearance({
        id: "cl-lucas-notcleared-23d",
        fighterId: "f-lucas-ferreira",
        level: "not_cleared",
        status: "superseded",
        issuedAt: daysAgo(23, 11, 0),
        validUntil: null,
        examinationId: "ex-lucas-injury-23d",
        reason: "Căng cơ gân kheo trái mức trung bình. Chưa được tập cho đến khi hoàn thành giai đoạn phục hồi đầu.",
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
            "Đang hồi phục sau căng cơ gân kheo trái, tiến triển tốt theo giáo án phục hồi. Được tập kỹ thuật và thể lực trong phạm vi các hạn chế dưới đây.",
        restrictions: [
            restriction("rst-lucas-current-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-lucas-current-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-lucas-current-max-rpe", "Cường độ buổi tập tối đa RPE 7", { maxRpe: 7 }),
            restriction("rst-lucas-current-hamstring", "Bảo vệ gân kheo trái — không duỗi hông bùng nổ", {
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
        reason: "Rách cung mày trái khi thi đấu, đã khâu. Hạn chế va chạm cho đến khi vết thương lành.",
        restrictions: [
            restriction("rst-aigerim-59d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-aigerim-59d-head", "Bảo vệ vết thương cung mày đang lành — không va chạm vùng đầu", { blockedRegions: ["head"] }),
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
        reason: "Vết rách cung mày đã lành hoàn toàn. Được phép tập đầy đủ và thi đấu, không có hạn chế.",
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
            "Khám thấy dấu hiệu chèn ép vai phải mức nhẹ; chưa xác định chấn thương. Được tập ở cường độ giảm, có bảo vệ vai cho đến lần tái khám.",
        restrictions: [
            restriction("rst-kenji-current-max-rpe", "Cường độ buổi tập tối đa RPE 8", { maxRpe: 8 }),
            restriction("rst-kenji-current-shoulder", "Bảo vệ vai phải — hạn chế đấm lực mạnh khối lượng lớn và tải qua đầu", {
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
        revokedReason: "Va chạm vùng đầu khi đấu tập, có triệu chứng chấn động não. Tạm dừng tập luyện trong khi chờ khám.",
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
            "Chấn động não do thể thao. Chưa được tập tại học viện; chỉ thực hiện các hoạt động của phác đồ trở lại tập luyện có giám sát cho đến khi khám lại.",
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
        reason: "Khám thể lực ban đầu khi gia nhập học viện đạt yêu cầu. Được phép tập đối kháng toàn phần và thi đấu.",
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
        revokedReason: "Nghi chấn thương bàn tay phải khi đấm bao cát. Thu hồi cấp phép đầy đủ trong khi chờ chụp X-quang.",
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
            "Gãy kín xương bàn tay thứ 5 bên phải, đang đeo nẹp. Chỉ được tập di chuyển, sức mạnh thân dưới và thể lực cho đến khi xem phim X-quang sau 4 tuần.",
        restrictions: [
            restriction("rst-marcus-current-impact", "Không bao cát, đấm đích hoặc đấu tập", {
                blockedTrainingTypes: ["heavy_bag", "pad_work", "sparring"],
            }),
            restriction("rst-marcus-current-punching", "Không tập đòn đấm (đòn thọc, đòn thẳng, đòn móc hoặc đòn tổ hợp)", {
                blockedTechniques: ["jab", "cross", "hook", "combination"],
            }),
            restriction("rst-marcus-current-right-hand", "Không đánh bằng tay phải", { blockedRegions: ["right_hand"] }),
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
        reason: "Bong gân MCL gối trái độ I. Được tập kỹ thuật thân trên và thể lực trong khi dây chằng đang lành.",
        restrictions: [
            restriction("rst-tariq-37d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-tariq-37d-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-tariq-37d-knee", "Bảo vệ đầu gối trái — không chạy, bật nhảy hoặc tập di chuyển", {
                blockedTechniques: ["footwork"],
                blockedRegions: ["left_knee"],
            }),
            restriction("rst-tariq-37d-max-rpe", "Cường độ buổi tập tối đa RPE 6", { maxRpe: 6 }),
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
            "Giai đoạn chuyên môn cuối sau bong gân MCL gối trái độ I. Đạt tiêu chí sức cơ và bật nhảy; được tập đấm đích, bao cát và di chuyển trong phạm vi các hạn chế dưới đây cho đến lần đánh giá cuối.",
        restrictions: [
            restriction("rst-tariq-current-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-tariq-current-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-tariq-current-knee", "Bảo vệ đầu gối trái — không tập đổi hướng gắt ở tốc độ tối đa", { blockedRegions: ["left_knee"] }),
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
        reason: "Bong gân cổ chân trái độ II. Được tập thân trên và thể lực ở tư thế ngồi trong khi dây chằng đang lành.",
        restrictions: [
            restriction("rst-emma-209d-no-sparring", "Không đấu tập", { blockedTrainingTypes: ["sparring"] }),
            restriction("rst-emma-209d-no-kicks", "Không đá", { blockedTechniques: ["kick"] }),
            restriction("rst-emma-209d-ankle", "Bảo vệ cổ chân trái — không bật nhảy hoặc tập đổi hướng", {
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
        reason: "Đạt tất cả tiêu chí trở lại tập luyện sau bong gân cổ chân trái. Được phép tập, không có hạn chế.",
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
        title: "SCAT6 ban đầu",
        kind: "report",
        date: clampPastToday(daysAgo(dayOffset, 9, 45)),
        authorName,
        summary: summary ?? "Đã ghi điểm triệu chứng, sàng lọc nhận thức (SAC) và thăng bằng (mBESS) ban đầu để so sánh sau mọi va chạm vùng đầu.",
    };
}

function bloodworkDocument(fighterId: string, dayOffset: number, authorName: string, summary?: string): MedicalDocument {
    return {
        id: `doc-${slug(fighterId)}-bloods-${dayOffset}d`,
        title: "Xét nghiệm máu — định kỳ",
        kind: "lab",
        date: clampPastToday(daysAgo(dayOffset, 8, 0)),
        authorName,
        summary: summary ?? "Công thức máu, ferritin, vitamin D, chức năng thận và gan trong giới hạn bình thường.",
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
        emergencyContact: { name: "Trần Thị Hoa", relation: "Mẹ", phone: "+84 903 418 227" },
        notes: "Võ sĩ Muay Thai chuyên nghiệp, đang trong giai đoạn chuẩn bị cho Lotus Fight Night 18. Đụng dập cẳng chân phải sau trận trước đây đã khỏi hoàn toàn. Hiện không có vấn đề sức khỏe nào.",
        documents: [
            scatBaselineDocument("f-minh-tran", 318, THU_LE_NAME),
            {
                id: "doc-minh-ecg-151d",
                title: "Điện tâm đồ lúc nghỉ — khám trước trận",
                kind: "report",
                date: daysAgo(151, 9, 30),
                authorName: THU_LE_NAME,
                summary: "Nhịp chậm xoang 51 lần/phút, điện thế đạt tiêu chuẩn tim vận động viên; không có dấu hiệu bệnh lý.",
            },
            { ...bloodworkDocument("f-minh-tran", 21, THU_LE_NAME), title: "Xét nghiệm máu — trước giai đoạn chuẩn bị thi đấu" },
        ],
        updatedAt: daysAgo(20, 16, 10),
    }),
    medicalRecord("f-lucas-ferreira", {
        bloodType: "A+",
        allergies: ["Penicillin"],
        chronicConditions: [],
        medications: ["Paracetamol 1 g khi cần, dùng khi đau mỏi sau buổi tập"],
        surgicalHistory: [{ year: 2017, procedure: "Nội soi khâu sụn viền vai trái" }],
        emergencyContact: { name: "Camila Ferreira", relation: "Vợ", phone: "+55 21 98765 4312" },
        notes: "Đang hồi phục sau căng cơ nhị đầu đùi trái độ II theo giáo án tăng tải do chuyên viên vật lý trị liệu phụ trách. Vai trái đã khâu sụn viền, ổn định. Dị ứng penicillin (nổi mẩn) — dùng thuốc thay thế.",
        documents: [
            scatBaselineDocument("f-lucas-ferreira", 300, THU_LE_NAME),
            bloodworkDocument("f-lucas-ferreira", 129, THU_LE_NAME, "Trong giới hạn bình thường; vitamin D 32 ng/mL."),
            {
                id: "doc-lucas-mri-22d",
                title: "MRI gân kheo trái — căng cơ độ II đầu dài cơ nhị đầu đùi",
                kind: "imaging",
                date: daysAgo(22, 16, 0),
                authorName: THU_LE_NAME,
                summary: "Phù nề dọc 6 cm đầu dài cơ nhị đầu đùi; gân trong cơ còn nguyên vẹn, không bong điểm bám.",
            },
            {
                id: "doc-lucas-referral-20d",
                title: "Giấy chuyển — vật lý trị liệu thể thao",
                kind: "referral",
                date: daysAgo(20, 9, 0),
                authorName: THU_LE_NAME,
                summary: "Chuyển Dr. Samuel Brooks để tăng tải gân kheo dần và thực hiện lộ trình chạy.",
            },
        ],
        updatedAt: daysAgo(10, 12, 0),
    }),
    medicalRecord("f-aigerim-sadykova", {
        bloodType: "B+",
        allergies: [],
        chronicConditions: ["Dự trữ sắt thấp, không thiếu máu — đang theo dõi"],
        medications: ["Sắt sulfat 200 mg, uống cách ngày"],
        surgicalHistory: [],
        emergencyContact: { name: "Dana Sadykova", relation: "Chị gái", phone: "+7 701 482 9163" },
        notes: "Dự trữ sắt đang cải thiện nhờ bổ sung cách ngày; xét nghiệm lại ferritin sau 8 tuần. Vết rách cung mày trái khi thi đấu đã lành tốt.",
        documents: [
            scatBaselineDocument("f-aigerim-sadykova", 290, SAMUEL_BROOKS_NAME),
            {
                id: "doc-aigerim-wound-49d",
                title: "Kiểm tra vết thương — rách cung mày trái",
                kind: "report",
                date: daysAgo(49, 11, 15),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Đã cắt chỉ; vết thương lành hoàn toàn, sẹo đẹp, không đau.",
            },
            {
                ...bloodworkDocument("f-aigerim-sadykova", 13, SAMUEL_BROOKS_NAME, "Ferritin 46 µg/L (trước đó 28 µg/L); huyết sắc tố 13,6 g/dL."),
                title: "Xét nghiệm máu — kiểm tra lại ferritin",
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
        emergencyContact: { name: "Yuki Morita", relation: "Anh trai", phone: "+81 90 3827 1164" },
        notes: "Đang theo dõi dấu hiệu chèn ép vai phải mức nhẹ, phát hiện khi khám sau ghi nhận vận động của AI. Chưa xác định chấn thương. Đã đặt lịch tái khám.",
        documents: [
            scatBaselineDocument("f-kenji-morita", 276, THU_LE_NAME),
            bloodworkDocument("f-kenji-morita", 102, THU_LE_NAME),
            {
                id: "doc-kenji-shoulder-7d",
                title: "Kết quả khám vai — vai phải",
                kind: "report",
                date: daysAgo(7, 12, 0),
                authorName: THU_LE_NAME,
                summary: "Nghiệm pháp Hawkins–Kennedy dương tính và cung đau nhẹ bên phải, sức cơ được bảo tồn. Phù hợp với hội chứng chèn ép dưới mỏm cùng vai mức nhẹ.",
            },
        ],
        updatedAt: daysAgo(7, 12, 0),
    }),
    medicalRecord("f-diego-alvarez", {
        bloodType: "O+",
        allergies: [],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [{ year: 2015, procedure: "Nội soi cắt một phần sụn chêm gối phải" }],
        emergencyContact: { name: "María Alvarez", relation: "Vợ", phone: "+52 55 4127 8839" },
        notes: "Một lần chấn động não trước đây (2021), hồi phục hoàn toàn sau 12 ngày. Hiện đang theo phác đồ trở lại tập luyện theo từng bước sau chấn động não khi đấu tập.",
        documents: [
            scatBaselineDocument("f-diego-alvarez", 265, THU_LE_NAME, "Điểm triệu chứng 1/22, SAC 43/50, mBESS 2 lỗi."),
            bloodworkDocument("f-diego-alvarez", 94, THU_LE_NAME),
            {
                id: "doc-diego-scat6-6d",
                title: "SCAT6 — đánh giá sau chấn thương",
                kind: "report",
                date: daysAgo(6, 20, 0),
                authorName: THU_LE_NAME,
                summary: "Điểm triệu chứng 9/22 (mức độ 21), SAC 36/50, mBESS 8 lỗi. Không có dấu hiệu nguy hiểm.",
            },
            {
                id: "doc-diego-scat6-3d",
                title: "SCAT6 — tái khám ngày thứ 3",
                kind: "report",
                date: daysAgo(3, 10, 45),
                authorName: THU_LE_NAME,
                summary: "Điểm triệu chứng 3/22 (mức độ 5), SAC 42/50, mBESS 4 lỗi. Chuyển sang bước 2 của phác đồ.",
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
        emergencyContact: { name: "Phạm Văn Tuấn", relation: "Bố", phone: "+84 912 305 781" },
        notes: "Võ sĩ kickboxing nghiệp dư, không có tiền sử bệnh đáng kể. Đã xem xét ghi nhận vận động gối của AI và bỏ qua — cơ chế tiếp đất trong giới hạn bình thường.",
        documents: [scatBaselineDocument("f-linh-pham", 298, THU_LE_NAME), bloodworkDocument("f-linh-pham", 114, THU_LE_NAME)],
        updatedAt: daysAgo(5, 15, 0),
    }),
    medicalRecord("f-marcus-hale", {
        bloodType: "A-",
        allergies: [],
        chronicConditions: [],
        medications: ["Paracetamol 1 g khi cần"],
        surgicalHistory: [{ year: 2018, procedure: "Phẫu thuật chỉnh hình vách ngăn mũi" }],
        emergencyContact: { name: "Olivia Hale", relation: "Bạn đời", phone: "+44 7700 900481" },
        notes: "Gãy kín cổ xương bàn tay thứ 5 bên phải, điều trị bảo tồn bằng nẹp máng trụ. Đã lên kế hoạch chụp X-quang sau 4 tuần và phục hồi chức năng bàn tay.",
        documents: [
            scatBaselineDocument("f-marcus-hale", 255, THU_LE_NAME),
            {
                id: "doc-marcus-xray-11d",
                title: "X-quang bàn tay phải — gãy cổ xương bàn tay thứ 5, gập góc 15°",
                kind: "imaging",
                date: daysAgo(11, 19, 0),
                authorName: THU_LE_NAME,
                summary: "Gãy kín cổ xương bàn tay thứ 5, ngoài khớp, gập góc về phía lòng 15°; không biến dạng xoay.",
            },
            {
                id: "doc-marcus-xray-3d",
                title: "X-quang bàn tay phải — theo dõi sau 1 tuần",
                kind: "imaging",
                date: daysAgo(3, 10, 0),
                authorName: THU_LE_NAME,
                summary: "Giữ được trục; góc gập không đổi ở 15°.",
            },
            {
                id: "doc-marcus-referral-3d",
                title: "Giấy chuyển — phục hồi chức năng bàn tay",
                kind: "referral",
                date: daysAgo(3, 11, 0),
                authorName: THU_LE_NAME,
                summary: "Chuyển Dr. Samuel Brooks để phục hồi vận động và tăng lực nắm sau khi tháo nẹp.",
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
        emergencyContact: { name: "Katarzyna Kowalska", relation: "Mẹ", phone: "+48 601 237 845" },
        notes: "Khỏe mạnh. Cần khám trước trận và gia hạn cấp phép y tế trước Lotus Fight Night 17. Đụng dập xương sườn trái trước đây đã khỏi.",
        documents: [
            scatBaselineDocument("f-sofia-kowalski", 359, SAMUEL_BROOKS_NAME),
            {
                id: "doc-sofia-ecg-359d",
                title: "Điện tâm đồ lúc nghỉ — tầm soát hằng năm",
                kind: "report",
                date: daysAgo(359, 9, 30),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Nhịp xoang bình thường; không có dấu hiệu bệnh lý.",
            },
            bloodworkDocument("f-sofia-kowalski", 178, SAMUEL_BROOKS_NAME),
        ],
        updatedAt: daysAgo(35, 11, 0),
    }),
    medicalRecord("f-hoang-long", {
        bloodType: "B+",
        allergies: [],
        chronicConditions: [],
        medications: ["Oresol (bù nước và điện giải) trong giai đoạn giảm cân"],
        surgicalHistory: [],
        emergencyContact: { name: "Hoàng Thị Mai", relation: "Mẹ", phone: "+84 938 612 054" },
        notes: "Theo dõi căng lưng dưới và tình trạng bù nước trong giai đoạn giảm cân cho Lotus Fight Night 17. Không có triệu chứng chèn ép rễ thần kinh. Đã đặt lịch kiểm tra cân nặng và bù nước.",
        documents: [
            scatBaselineDocument("f-hoang-long", 324, THU_LE_NAME),
            bloodworkDocument("f-hoang-long", 143, THU_LE_NAME),
            {
                id: "doc-hoang-urinalysis-12d",
                title: "Tổng phân tích nước tiểu và điện giải — theo dõi giảm cân",
                kind: "lab",
                date: daysAgo(12, 9, 0),
                authorName: THU_LE_NAME,
                summary: "Tỷ trọng nước tiểu 1,026 (bù nước mức trung bình). Natri và kali trong giới hạn; creatinin ở mức cao của bình thường.",
            },
        ],
        updatedAt: daysAgo(12, 11, 0),
    }),
    medicalRecord("f-tariq-haddad", {
        bloodType: "B+",
        allergies: ["Kháng sinh nhóm sulfonamide"],
        chronicConditions: [],
        medications: [],
        surgicalHistory: [{ year: 2019, procedure: "Tái tạo dây chằng chéo trước (ACL) gối phải (mảnh ghép gân kheo tự thân)" }],
        emergencyContact: { name: "Omar Haddad", relation: "Anh trai", phone: "+962 79 552 3806" },
        notes: "Đang ở giai đoạn chuyên môn cuối sau bong gân MCL gối trái độ I. Gối phải tái tạo ACL (2019) vẫn ổn định.",
        documents: [
            scatBaselineDocument("f-tariq-haddad", 310, SAMUEL_BROOKS_NAME),
            {
                id: "doc-tariq-ultrasound-36d",
                title: "Siêu âm gối trái — bong gân MCL độ I",
                kind: "imaging",
                date: daysAgo(36, 14, 30),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Sợi MCL đoạn gần dày lên, giảm âm; không rách toàn bộ bề dày, không tràn dịch khớp.",
            },
            {
                id: "doc-tariq-rtp-5d",
                title: "Kết quả đánh giá trở lại tập luyện",
                kind: "report",
                date: daysAgo(5, 10, 50),
                authorName: SAMUEL_BROOKS_NAME,
                summary: "Cơ tứ đầu đùi 93%, gân kheo 95% và bật xa một chân 91% so với bên phải. Hạn chế: không đấu tập, không đá, RPE ≤ 8.",
            },
        ],
        updatedAt: daysAgo(5, 10, 55),
    }),
    medicalRecord("f-emma-lindqvist", {
        bloodType: "O-",
        allergies: [],
        chronicConditions: ["Hen nhẹ do gắng sức"],
        medications: ["Bình xịt salbutamol 100 mcg — xịt 2 nhát khi cần, trước các buổi tập cường độ cao"],
        surgicalHistory: [],
        emergencyContact: { name: "Erik Lindqvist", relation: "Bố", phone: "+46 70 318 2254" },
        notes: "Hen được kiểm soát tốt; chỉ dùng thuốc cắt cơn trước những ngày đấu tập. Bong gân cổ chân trái đã phục hồi hoàn toàn.",
        documents: [
            scatBaselineDocument("f-emma-lindqvist", 335, THU_LE_NAME),
            {
                id: "doc-emma-spirometry-335d",
                title: "Đo chức năng hô hấp — nghiệm pháp gắng sức",
                kind: "report",
                date: daysAgo(335, 10, 30),
                authorName: THU_LE_NAME,
                summary: "FEV1 giảm 12% sau gắng sức, hồi phục với salbutamol. Phù hợp với co thắt phế quản nhẹ do gắng sức.",
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
        emergencyContact: { name: "Nguyễn Văn Hùng", relation: "Bố", phone: "+84 987 204 613" },
        lastPhysicalAt: daysAgo(160, 9, 0),
        notes: `Hồ sơ mở khi đăng ký, dựa trên phiếu khai sức khỏe trước khi tham gia; không khai báo bệnh lý nào. Lần khám gần nhất là khám sức khỏe cấp giấy phép nghiệp dư bên ngoài. Đã đặt lịch khám thể lực ban đầu ngày ${formatDate(BAO_BASELINE_EXAM_DATE, "vi")}.`,
        documents: [
            {
                id: "doc-bao-licence-medical",
                title: "Khám sức khỏe cấp giấy phép nghiệp dư (bên ngoài)",
                kind: "report",
                date: daysAgo(160, 9, 0),
                authorName: "Bác sĩ khám cấp phép bên ngoài",
                summary: "Đủ điều kiện thi đấu nghiệp dư. Võ sĩ nộp khi đăng ký; sẽ được xác nhận khi khám thể lực ban đầu.",
            },
        ],
        updatedAt: daysAgo(12, 10, 0),
    }),
];
