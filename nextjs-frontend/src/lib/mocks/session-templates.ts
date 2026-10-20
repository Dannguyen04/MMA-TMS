import type { Locale } from "@/lib/i18n/config";
import type { SessionTemplate } from "@/lib/domain/session-templates";

/**
 * The four system templates, as migration 029 seeds them (nestjs-api/migrations/029_session_templates.sql).
 * Kept in step by hand; the API mode reads them from `GET /training-session-templates` instead.
 */
type Text = Pick<SessionTemplate, "name" | "purpose" | "rationale" | "steps">;
type Entry = Omit<SessionTemplate, "name" | "purpose" | "rationale" | "steps"> & Record<Locale, Text>;

const ENTRIES: Entry[] = [
    {
        id: "demo-session-template-distance",
        code: "distance",
        category: "TECHNIQUE",
        type: "pad_work",
        durationMin: 45,
        targetRpe: 5,
        vi: {
            name: "Jab – cross – thoát góc",
            purpose: "Thoát khỏi đường phản công sau tổ hợp hai đòn.",
            rationale: "Phù hợp điểm yếu đang theo dõi: còn đứng trong tầm đối thủ sau khi ra đòn.",
            steps: [
                { name: "Chuẩn bị", detail: "HLV kiểm tra tư thế, thống nhất tín hiệu và đánh dấu vùng di chuyển." },
                { name: "Bài tập chính", detail: "Jab – cross trên đích, thoát góc theo tín hiệu; HLV quan sát vị trí kết thúc." },
                { name: "Kiểm tra cuối buổi", detail: "Ghi số lần đạt trên tổng số tình huống: thoát đúng vùng và giữ tư thế bảo vệ." },
            ],
        },
        en: {
            name: "Jab – cross – angle exit",
            purpose: "Leave the counter-punch line after a two-punch combination.",
            rationale: "Fits the weakness being tracked: still standing in the opponent's range after punching.",
            steps: [
                { name: "Preparation", detail: "The coach checks posture, agrees on the signals and marks the movement zone." },
                { name: "Main drill", detail: "Jab – cross on the target, exit at an angle on the signal; the coach watches the finishing position." },
                { name: "End-of-session check", detail: "Record successes out of total situations: exited to the right zone and kept guard." },
            ],
        },
    },
    {
        id: "demo-session-template-counter",
        code: "counter",
        category: "SPARRING",
        type: "sparring",
        durationMin: 45,
        targetRpe: 7,
        vi: {
            name: "Phòng thủ → phản đòn tình huống",
            purpose: "Đưa kỹ năng phòng thủ vào tình huống có đối thủ.",
            rationale: "Dùng khi HLV muốn kiểm tra khả năng chuyển kỹ thuật sang đối luyện; có tiếp xúc.",
            steps: [
                { name: "Thống nhất tình huống", detail: "HLV quy định vai trò, tín hiệu dừng và phạm vi đối luyện." },
                { name: "Đối luyện có kiểm soát", detail: "Đối thủ đưa tín hiệu tấn công; võ sĩ chọn phương án phòng thủ và phản công." },
                { name: "Đánh giá", detail: "HLV ghi nhận chất lượng phòng thủ và vị trí sau phản công." },
            ],
        },
        en: {
            name: "Defence → situational counter",
            purpose: "Bring defensive skills into situations with an opponent.",
            rationale: "Use when the coach wants to check that technique carries over to live drilling; involves contact.",
            steps: [
                { name: "Agree the situations", detail: "The coach sets the roles, the stop signal and the scope of the drill." },
                { name: "Controlled drilling", detail: "The partner gives an attack signal; the fighter picks a defence and counters." },
                { name: "Assessment", detail: "The coach records the quality of the defence and the position after the counter." },
            ],
        },
    },
    {
        id: "demo-session-template-strength",
        code: "strength",
        category: "CONDITIONING",
        type: "strength_conditioning",
        durationMin: 60,
        targetRpe: 6,
        vi: {
            name: "Sức mạnh thân trên",
            purpose: "Theo dõi chất lượng vận động trong giáo án thể lực do HLV phụ trách.",
            rationale: "Có tải thân trên; phải rà soát khi bác sĩ ghi hạn chế vùng này.",
            steps: [
                { name: "Kiểm tra trước buổi", detail: "HLV xem trạng thái sức khỏe và kế hoạch thể lực đã thống nhất." },
                { name: "Thực hiện giáo án", detail: "HLV chọn bài và tải cụ thể tại buổi tập theo đánh giá chuyên môn." },
                { name: "Ghi nhận", detail: "Ghi mức hoàn thành, cảm nhận gắng sức và phản hồi khó chịu." },
            ],
        },
        en: {
            name: "Upper-body strength",
            purpose: "Track movement quality in the conditioning plan the coach is responsible for.",
            rationale: "Loads the upper body; review it when the doctor records a restriction for this area.",
            steps: [
                { name: "Pre-session check", detail: "The coach reviews the fighter's health status and the agreed conditioning plan." },
                { name: "Carry out the plan", detail: "The coach picks the exercises and loads in the session based on professional judgement." },
                { name: "Record", detail: "Record completion, perceived effort and any discomfort reported." },
            ],
        },
    },
    {
        id: "demo-session-template-tactics",
        code: "tactics",
        category: "TACTICS",
        type: "tactical_analysis",
        durationMin: 40,
        targetRpe: 2,
        vi: {
            name: "Đọc trận & phân tích đối thủ",
            purpose: "Nhận diện tình huống và lựa chọn phương án trước khi thực hành.",
            rationale: "Không có bài tập thể chất; có thể được HLV xem xét thay thế khi cần hạn chế vận động.",
            steps: [
                { name: "Xem tình huống", detail: "Chọn các đoạn video có tình huống ra đòn và bị phản công." },
                { name: "Phân tích lựa chọn", detail: "Võ sĩ chỉ ra thời điểm và hướng thoát phù hợp, HLV phản biện." },
                { name: "Kiểm tra hiểu bài", detail: "Chấm số tình huống nhận diện đúng trên tổng tình huống đã xem." },
            ],
        },
        en: {
            name: "Fight reading & opponent analysis",
            purpose: "Recognise situations and choose an option before practising.",
            rationale: "No physical exercise; the coach can consider it as a substitute when movement has to be limited.",
            steps: [
                { name: "Watch situations", detail: "Pick video clips showing a strike followed by a counter." },
                { name: "Analyse the options", detail: "The fighter points out the right timing and exit direction; the coach challenges the choice." },
                { name: "Comprehension check", detail: "Score the situations recognised correctly out of all situations watched." },
            ],
        },
    },
];

/** The templates with their text in `locale`, in display order. */
export function demoSessionTemplates(locale: Locale): SessionTemplate[] {
    return ENTRIES.map(({ vi, en, ...rest }) => ({ ...rest, ...(locale === "en" ? en : vi) }));
}
