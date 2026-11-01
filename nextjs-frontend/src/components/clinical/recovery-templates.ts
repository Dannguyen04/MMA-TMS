import type { InjuryType } from "@/lib/domain/types";

/**
 * Starting points for recovery plans. Durations are typical, not prescriptive — the doctor
 * adjusts phases, dates and milestones to the athlete before saving.
 */

export interface RecoveryTemplatePhase {
    name: string;
    goal: string;
    durationDays: number;
    milestones: string[];
}

export interface RecoveryTemplate {
    id: "muscle_strain" | "ligament_sprain" | "fracture" | "concussion" | "general";
    label: string;
    summary: string;
    phases: RecoveryTemplatePhase[];
}

export const RECOVERY_TEMPLATES: RecoveryTemplate[] = [
    {
        id: "muscle_strain",
        label: "Căng cơ",
        summary: "5 giai đoạn · khoảng 6 tuần",
        phases: [
            {
                name: "Bảo vệ & kiểm soát đau",
                goal: "Giảm đau và bảo vệ cơ đang lành, đồng thời duy trì vận động phần còn lại của cơ thể.",
                durationDays: 5,
                milestones: ["Đi bộ không đau", "Đã xác định độ căng cơ"],
            },
            {
                name: "Tải sớm & vận động",
                goal: "Phục hồi biên độ vận động và bắt đầu tải đẳng trường không đau.",
                durationDays: 9,
                milestones: ["Giữ đẳng trường không đau ở ba góc khớp", "Biên độ vận động chênh không quá 10° so với bên lành"],
            },
            {
                name: "Tăng sức mạnh dần",
                goal: "Xây sức mạnh lệch tâm và phục hồi cơ học chạy.",
                durationDays: 14,
                milestones: [
                    "Bài lệch tâm 3×6 không đau",
                    "Chạy 70% tốc độ tối đa không đau",
                    "Sức mạnh ≥ 90% bên lành",
                ],
            },
            {
                name: "Tái điều kiện chuyên môn",
                goal: "Đưa lại dần động tác bùng nổ, đá và vật.",
                durationDays: 8,
                milestones: ["Chạy nước rút và đổi hướng tốc độ tối đa", "Bài kỹ thuật hết sức không triệu chứng"],
            },
            {
                name: "Trở lại tập đầy đủ",
                goal: "Chịu được các tuần tập đầy đủ, kể cả hiệp đấu thật, trước khi bỏ hạn chế.",
                durationDays: 6,
                milestones: ["Hiệp đấu thật không triệu chứng", "Đạt đánh giá trở lại tập"],
            },
        ],
    },
    {
        id: "ligament_sprain",
        label: "Bong gân dây chằng",
        summary: "4 giai đoạn · khoảng 6 tuần",
        phases: [
            {
                name: "Bảo vệ & kiểm soát sưng",
                goal: "Bảo vệ dây chằng, kiểm soát sưng và duy trì vận động không đau.",
                durationDays: 7,
                milestones: ["Sưng giảm dần", "Chịu lực hoàn toàn, không đi khập khiễng"],
            },
            {
                name: "Biên độ vận động & sức mạnh ban đầu",
                goal: "Phục hồi đủ biên độ vận động và bắt đầu tập sức mạnh chuỗi đóng.",
                durationDays: 10,
                milestones: ["Biên độ vận động đầy đủ", "Đứng thăng bằng một chân 30 giây"],
            },
            {
                name: "Sức mạnh & cảm thụ bản thể",
                goal: "Xây sức mạnh, độ vững và kiểm soát dưới tải tăng dần.",
                durationDays: 14,
                milestones: ["Sức mạnh ≥ 90% bên lành", "Bài bật nhảy chênh không quá 10% so với bên lành", "Vững khi chịu tải ngang"],
            },
            {
                name: "Trở lại chuyên môn",
                goal: "Trở lại bộ pháp, đòn đá và tập thật, bảo vệ khớp khi cần.",
                durationDays: 10,
                milestones: [
                    "Đánh đích có đá không triệu chứng",
                    "Đấu tập có kiểm soát, khớp không lỏng",
                    "Đạt đánh giá trở lại tập",
                ],
            },
        ],
    },
    {
        id: "fracture",
        label: "Gãy xương",
        summary: "4 giai đoạn · khoảng 10 tuần",
        phases: [
            {
                name: "Bất động & bảo vệ",
                goal: "Bảo vệ ổ gãy, đồng thời duy trì thể lực các vùng lành.",
                durationDays: 28,
                milestones: ["Phim chụp lại xác nhận xương thẳng trục", "Duy trì thể lực mà không tải lên ổ gãy"],
            },
            {
                name: "Vận động lại",
                goal: "Phục hồi biên độ vận động sau bất động và bắt đầu tải nhẹ.",
                durationDays: 14,
                milestones: ["Bác sĩ điều trị xác nhận đã liền", "Biên độ vận động chênh không quá 10% so với bên lành"],
            },
            {
                name: "Sức mạnh & chịu tải",
                goal: "Xây lại sức mạnh và khả năng chịu tải tăng dần.",
                durationDays: 14,
                milestones: ["Lực nắm hoặc lực tải ≥ 85% bên lành", "Tải qua xương đã liền không đau"],
            },
            {
                name: "Trở lại va chạm theo bậc",
                goal: "Đưa lại va chạm dần — bao cát và đích trước khi đấu thật.",
                durationDays: 14,
                milestones: ["Đánh bao và đích nhẹ không đau", "Ra đòn hết lực không đau", "Đạt đánh giá trở lại tập"],
            },
        ],
    },
    {
        id: "concussion",
        label: "Chấn động não — trở lại theo bậc",
        summary: "6 bậc · mỗi bậc ít nhất 24 giờ",
        phases: [
            {
                name: "Hoạt động giới hạn theo triệu chứng",
                goal: "Nghỉ tương đối 24–48 giờ đầu, sau đó sinh hoạt hằng ngày không gây triệu chứng.",
                durationDays: 2,
                milestones: ["Hoàn tất 24–48 giờ nghỉ tương đối", "Sinh hoạt hằng ngày không làm nặng triệu chứng"],
            },
            {
                name: "Tập aerobic nhẹ",
                goal: "Đi bộ hoặc đạp xe tại chỗ nhịp chậm đến vừa; không tập kháng lực.",
                durationDays: 2,
                milestones: ["Buổi aerobic nhẹ không tăng triệu chứng", "Không triệu chứng khi nghỉ"],
            },
            {
                name: "Bài tập chuyên môn (không va chạm)",
                goal: "Bài tập cá nhân không va chạm — chạy, nhảy dây và đánh gió.",
                durationDays: 2,
                milestones: ["Chạy và nhảy dây không triệu chứng", "Đánh gió không triệu chứng"],
            },
            {
                name: "Bài tập không va chạm",
                goal: "Bài tập nặng hơn không có nguy cơ va chạm đầu, kèm tập kháng lực. Phải hết triệu chứng.",
                durationDays: 3,
                milestones: ["Đánh đích không triệu chứng", "Đã tập lại kháng lực", "Tầm soát chấn động trở về mức nền"],
            },
            {
                name: "Tập va chạm toàn phần (sau khi có giấy phép)",
                goal: "Tập bình thường kể cả va chạm có kiểm soát, chỉ sau khi bác sĩ cấp phép.",
                durationDays: 3,
                milestones: ["Giấy phép tập va chạm", "Đấu tập có kiểm soát không triệu chứng"],
            },
            {
                name: "Trở lại thi đấu",
                goal: "Tập không hạn chế và đủ điều kiện thi đấu.",
                durationDays: 2,
                milestones: ["Một tuần tập đầy đủ không triệu chứng", "Giấy phép được nâng lên đầy đủ"],
            },
        ],
    },
    {
        id: "general",
        label: "Trở lại tập luyện chung",
        summary: "3 giai đoạn · khoảng 3 tuần",
        phases: [
            {
                name: "Giảm triệu chứng",
                goal: "Giảm đau và viêm, đồng thời bảo vệ vùng bị thương.",
                durationDays: 5,
                milestones: ["Hết đau khi nghỉ", "Sinh hoạt hằng ngày không đau"],
            },
            {
                name: "Phục hồi chức năng",
                goal: "Phục hồi biên độ vận động và sức mạnh bằng bài tập tăng dần.",
                durationDays: 10,
                milestones: ["Biên độ vận động đầy đủ", "Sức mạnh gần bằng bên lành"],
            },
            {
                name: "Trở lại tập luyện",
                goal: "Trở lại tập đầy đủ dần, bảo vệ vùng bị thương khi cần.",
                durationDays: 7,
                milestones: ["Tập kỹ thuật không triệu chứng", "Đạt đánh giá trở lại tập"],
            },
        ],
    },
];

const TEMPLATE_FOR_TYPE: Record<InjuryType, RecoveryTemplate["id"]> = {
    strain: "muscle_strain",
    sprain: "ligament_sprain",
    fracture: "fracture",
    concussion: "concussion",
    contusion: "general",
    laceration: "general",
    tendinopathy: "general",
    impingement: "general",
};

export function recommendedTemplate(type: InjuryType | null): RecoveryTemplate {
    const id = type ? TEMPLATE_FOR_TYPE[type] : undefined;
    return RECOVERY_TEMPLATES.find((template) => template.id === id) ?? RECOVERY_TEMPLATES[RECOVERY_TEMPLATES.length - 1];
}
