import type { GlossaryEntry } from "./types";

/** Clinical terms on the doctor's forms and the fighter's health pages. */
export const MEDICAL_TERMS = {
    restingHeartRate: {
        term: "Mạch nghỉ",
        definition: "Số nhịp tim mỗi phút sau khi ngồi yên khoảng 5 phút. Võ sĩ được tập luyện thường ở mức 40–60 lần/phút.",
    },
    systolicPressure: {
        term: "Huyết áp tâm thu",
        definition: "Chỉ số huyết áp trên: áp lực động mạch khi tim co bóp, đơn vị mmHg. Dưới 120 là bình thường khi nghỉ.",
    },
    diastolicPressure: {
        term: "Huyết áp tâm trương",
        definition: "Chỉ số huyết áp dưới: áp lực động mạch giữa hai nhịp, đơn vị mmHg. Dưới 80 là bình thường khi nghỉ.",
    },
    bodyTemperature: {
        term: "Nhiệt độ cơ thể",
        definition: "Đo bằng °C. Khoảng 36,1–37,2 °C là bình thường khi nghỉ; từ 38 °C trở lên là sốt.",
    },
    spo2: {
        term: "SpO2",
        definition: "Độ bão hòa oxy máu: tỉ lệ hồng cầu mang oxy, đo bằng kẹp ngón tay (máy đo SpO2). 95–100% là bình thường khi nghỉ.",
    },
    hydration: {
        term: "Tình trạng nước",
        definition: "Mức đủ nước của võ sĩ, thường đánh giá qua màu nước tiểu hoặc xét nghiệm nước tiểu. Quan trọng nhất khi giảm cân.",
    },
    baselineExam: {
        term: "Khám nền",
        definition: "Lần khám tổng quát đầu tiên khi võ sĩ khỏe mạnh. Các lần khám sau được so sánh với lần này, và không thể bắt đầu tập nếu thiếu nó.",
    },
    examinationScope: {
        term: "Phạm vi",
        definition: "Phạm vi quyết định: võ sĩ được tập luyện, hay được thi đấu một trận.",
    },
    eligibleWithRestrictions: {
        term: "Đủ điều kiện có hạn chế",
        definition: "Võ sĩ được tập nhưng chỉ trong giới hạn bác sĩ đặt, ví dụ không va chạm đầu.",
    },
    restrictions: {
        term: "Hạn chế",
        definition: "Giới hạn đi kèm quyết định, như không đấu tập hoặc không va chạm đầu, cho đến khi bác sĩ gỡ bỏ.",
    },
    validUntil: {
        term: "Hiệu lực đến",
        definition: "Ngày quyết định hết hiệu lực. Giấy phép cấp từ phiếu khám này có thể kết thúc sớm hơn, không thể muộn hơn.",
    },
    followUpDate: {
        term: "Theo dõi",
        definition: "Khi bác sĩ muốn gặp lại võ sĩ. Chỉ là lời nhắc; không làm giấy phép hết hạn.",
    },
    medicalClearance: {
        term: "Giấy phép y tế",
        definition: "Xác nhận chính thức của bác sĩ rằng võ sĩ được tập hoặc thi đấu, cấp từ phiếu khám đã hoàn tất. Có thể kèm hạn chế và ngày hết hạn.",
    },
    returnFromInjury: {
        term: "Trở lại sau chấn thương",
        definition: "Giấy phép cho võ sĩ tập lại sau chấn thương, thường kèm hạn chế được nới dần.",
    },
    scat6: {
        term: "SCAT6",
        definition: "Công cụ đánh giá chấn động não trong thể thao, phiên bản 6: bài kiểm tra chuẩn về triệu chứng, trí nhớ, tập trung và thăng bằng.",
    },
    gcs: {
        term: "Thang điểm hôn mê Glasgow (GCS)",
        definition: "Chấm đáp ứng mắt, lời nói và vận động từ 3 đến 15. Điểm 15 là hoàn toàn tỉnh táo.",
    },
    maddocks: {
        term: "Câu hỏi Maddocks",
        definition: "Năm câu hỏi nhanh về trận đấu và địa điểm giúp phát hiện lú lẫn ngay sau va chạm đầu.",
    },
    observableSigns: {
        term: "Dấu hiệu quan sát được",
        definition: "Dấu hiệu thấy được sau va chạm, như nằm bất động, mất thăng bằng hoặc ánh mắt vô hồn, do người chứng kiến hoặc qua Video.",
    },
    immediateAssessment: {
        term: "Đánh giá tức thời",
        definition: "Sàng lọc tại chỗ ngay sau nghi chấn thương đầu. Khám nền khi khỏe mạnh thường ghi là không thực hiện.",
    },
    symptomEvaluation: {
        term: "Đánh giá triệu chứng",
        definition: "Võ sĩ chấm 22 triệu chứng từ 0 (không có) đến 6 (nặng). Dịch vụ y tế tính số triệu chứng và điểm mức độ.",
    },
    percentOfNormal: {
        term: "Phần trăm so với bình thường",
        definition: "Cảm nhận chung của võ sĩ so với bình thường, từ 0 đến 100%.",
    },
    orientation: {
        term: "Định hướng",
        definition: "Câu hỏi đơn giản về ngày giờ để kiểm tra định hướng thời gian của võ sĩ.",
    },
    immediateMemory: {
        term: "Trí nhớ tức thời",
        definition: "Người khám đọc danh sách từ và võ sĩ nhắc lại, qua ba lượt. Kiểm tra trí nhớ ngắn hạn.",
    },
    digitsBackward: {
        term: "Đọc ngược dãy số",
        definition: "Võ sĩ đọc ngược các dãy số. Kiểm tra khả năng tập trung.",
    },
    monthsReverse: {
        term: "Đọc ngược các tháng",
        definition: "Võ sĩ đọc ngược các tháng từ tháng 12 về tháng 1, nhanh và chính xác nhất có thể.",
    },
    mbess: {
        term: "mBESS",
        definition: "Hệ thống chấm lỗi thăng bằng cải tiến: người khám đếm lỗi trong ba tư thế 20 giây nhắm mắt.",
    },
    tandemGait: {
        term: "Đi nối gót",
        definition: "Đi nối gót theo vạch 3 m rồi quay lại, có tính giờ. Đi chậm hoặc loạng choạng có thể gợi ý chấn động não.",
    },
    dualTaskGait: {
        term: "Đi kết hợp nhiệm vụ kép",
        definition: "Lặp lại đi nối gót trong khi đếm ngược, để kiểm tra thăng bằng khi có tải trí óc.",
    },
    delayedRecall: {
        term: "Nhớ lại có trì hoãn",
        definition: "Ít nhất 5 phút sau các lượt trí nhớ, võ sĩ nhớ lại danh sách từ mà không được nghe lại.",
    },
    examinerAttestation: {
        term: "Xác nhận của người khám",
        definition: "Bác sĩ xác nhận đã trực tiếp thực hiện hoặc giám sát lần đánh giá này theo hướng dẫn SCAT6 chính thức.",
    },
    recoveryPlan: {
        term: "Kế hoạch phục hồi",
        definition: "Các bước võ sĩ thực hiện để trở lại sau chấn thương, mỗi bước có ngày mục tiêu do bác sĩ xác nhận.",
    },
    milestone: {
        term: "Mốc",
        definition: "Mốc kiểm tra trong kế hoạch phục hồi, ví dụ đủ biên độ vận động không đau, do bác sĩ đánh dấu khi đạt.",
    },
    trainingClearance: {
        term: "Giấy phép tập luyện",
        definition: "Cho võ sĩ khỏe mạnh tập trong phạm vi quyết định của phiếu khám. Thường cấp sau khám nền hoặc khám định kỳ khi không có chấn thương.",
    },
    competitionClearance: {
        term: "Giấy phép thi đấu",
        definition: "Cho võ sĩ thi đấu một trận. Chỉ phiếu khám thi đấu mới làm căn cứ được.",
    },
    examinationCorrection: {
        term: "Đính chính",
        definition: "Thay phiếu khám hiện hành cùng phạm vi vì ghi sai. Lần khám mới là phiếu khám mới, không phải đính chính.",
    },
    reviewRequest: {
        term: "Yêu cầu xem xét",
        definition: "Võ sĩ, HLV hoặc bác sĩ yêu cầu xem xét y tế. Việc tập tạm dừng cho đến khi có phiếu khám trả lời.",
    },
    assessedArea: {
        term: "Vùng được đánh giá",
        definition: "Một phần của khám thực thể, như tim, phổi hoặc một khớp, kèm kết quả: bình thường, bất thường hoặc chưa kết luận.",
    },
    athleteBackground: {
        term: "Thông tin vận động viên",
        definition: "Tiền sử chấn động não và các tình trạng như đau nửa đầu, ADHD, khó khăn học tập hoặc rối loạn cảm xúc. Chúng có thể ảnh hưởng kết quả SCAT6 nên các lần sau được đối chiếu.",
    },
    cognitiveScreening: {
        term: "Sàng lọc nhận thức",
        definition: "Các bài SCAT6 về định hướng, trí nhớ tức thời và tập trung (đọc ngược dãy số và các tháng).",
    },
    cervicalSpine: {
        term: "Kiểm tra cột sống cổ",
        definition: "Đau cổ, đau khi ấn, biên độ vận động và sức cơ chi sau va chạm. Có bất kỳ dấu hiệu cổ nào thì phải bảo vệ cổ trước khi di chuyển vận động viên.",
    },
    findingsAndReasoning: {
        term: "Kết quả và lập luận",
        definition: "Lý do bạn đưa ra quyết định, bằng lời dễ hiểu. Võ sĩ đọc được trên trang Sức khỏe; HLV không xem được.",
    },
    coordinationBalance: {
        term: "Phối hợp và thăng bằng",
        definition: "Các bài thăng bằng SCAT6: tư thế mBESS, đi nối gót tính giờ và (không bắt buộc) đi kết hợp nhiệm vụ kép.",
    },
} as const satisfies Record<string, GlossaryEntry>;
