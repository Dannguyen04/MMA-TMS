import type { enBoutFighter } from "./bout-fighter.en";

/** Vietnamese text for the fighter's bout and weigh-in pages and the shared weight components; must define every key of `enBoutFighter`. */
export const viBoutFighter = {
    /* Fighter bout page */
    "boutFighter.page.title": "Trận đấu",
    "boutFighter.page.noBout": "Chưa có trận sắp tới",
    "boutFighter.page.noBoutText": "Bạn vẫn có thể ghi cân hôm nay.",
    "boutFighter.page.opponentTba": "Chưa có đối thủ",
    "boutFighter.page.limit": "Giới hạn cân",
    "boutFighter.page.catchweight": "Mức cân thỏa thuận",
    "boutFighter.page.noUpperLimit": "Không giới hạn trên",
    "boutFighter.page.weighIn": "Buổi cân",
    "boutFighter.page.bout": "Trận đấu",
    "boutFighter.page.countdown": "Đếm ngược",
    "boutFighter.page.noPlan": "Chưa có kế hoạch ăn cho giai đoạn này.",
    "boutFighter.page.medicalFile": "Hồ sơ y tế",
    "boutFighter.page.noDocuments": "HLV chưa liệt kê hồ sơ nào cho trận này.",
    "boutFighter.page.optional": "Không bắt buộc",
    "boutFighter.page.validUntil": "Hiệu lực đến {date}",
    "boutFighter.page.validUntilLate": "Hiệu lực đến {date} (trước ngày thi đấu)",

    /* Loading states */
    "boutFighter.loading.bout": "Đang tải trận đấu",
    "boutFighter.loading.weighIn": "Đang tải trang ghi cân",

    /* Today's weight page */
    "boutFighter.weighIn.title": "Cân nặng hôm nay",
    "boutFighter.weighIn.description": "Ghi cân nặng sáng nay. Lưu lại trong hôm nay sẽ thay số đã ghi trước đó.",
    "boutFighter.weighIn.back": "Trận đấu",

    /* Weigh-in form */
    "boutFighter.form.weight": "Cân nặng",
    "boutFighter.form.weightHint": "Tính bằng kg, ví dụ 66.5. Số ghi hôm nay sẽ thay số đã ghi trước đó.",
    "boutFighter.form.adherenceQuestion": "Hôm qua bạn có theo đúng kế hoạch ăn không?",
    "boutFighter.form.optional": "(không bắt buộc)",
    "boutFighter.form.adherenceHint": "Bỏ qua câu này thì cân nặng hôm nay vẫn được lưu.",
    "boutFighter.form.note": "Ghi chú",
    "boutFighter.form.noteHint": "Tối đa 200 ký tự.",
    "boutFighter.form.saving": "Đang lưu",
    "boutFighter.form.save": "Lưu",

    /* Nutrition plan form (coach) */
    "boutFighter.plan.currentPhase": "Đang áp dụng",
    "boutFighter.plan.intro": "Viết những gì võ sĩ nên ăn trong từng giai đoạn. Ứng dụng lưu đúng những gì bạn nhập.",
    "boutFighter.plan.lastEdited": "Sửa lần cuối: {name}, {date}",
    "boutFighter.plan.writtenBy": "Người viết",
    "boutFighter.plan.writtenByHint": "Tên bạn, hoặc tên chuyên gia mà bạn chép lại.",
    "boutFighter.plan.saving": "Đang lưu",
    "boutFighter.plan.save": "Lưu kế hoạch",

    /* Camp weight chart */
    "boutFighter.chart.empty": "Chưa có ngày nào trong camp để vẽ biểu đồ.",
    "boutFighter.chart.tableCaption": "Cân nặng trong camp theo ngày",
    "boutFighter.chart.day": "Ngày",
    "boutFighter.chart.weight": "Cân nặng",
    "boutFighter.chart.reference": "Lộ trình",
    "boutFighter.chart.planAnswer": "Kế hoạch ăn",
    "boutFighter.chart.limit": "Giới hạn",
    "boutFighter.chart.legend": "Chú thích màu điểm theo kế hoạch ăn",
    "boutFighter.chart.aria": "Cân nặng so với giới hạn {limit} kg. {latest}, trạng thái {status}.",
    "boutFighter.chart.ariaNoLimit": "Cân nặng, chưa đặt giới hạn. {latest}, trạng thái {status}.",
    "boutFighter.chart.ariaLatest": "Gần nhất {kg} kg",
    "boutFighter.chart.ariaNoWeight": "Chưa ghi cân",

    /* Weight cards */
    "boutFighter.weight.title": "Cân nặng",
    "boutFighter.weight.noWeight": "Chưa ghi cân",
    "boutFighter.weight.remaining": "Còn {pct}% cần giảm",
    "boutFighter.weight.noWeightsInCamp": "Chưa ghi cân lần nào trong camp này.",
    "boutFighter.weight.logWeight": "Ghi cân",
    "boutFighter.weight.noBout": "Chưa có trận sắp tới",
    "boutFighter.weight.noWeightYet": "Chưa ghi cân",
    "boutFighter.weight.todayTitle": "Cân nặng hôm nay",
    "boutFighter.weight.logToday": "Ghi cân hôm nay",
} satisfies Record<keyof typeof enBoutFighter, string>;
