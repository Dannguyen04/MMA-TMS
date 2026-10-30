import type { enBoutLabels } from "./bout-labels.en";

/** Vietnamese labels for the bout vocabulary; must define every key of `enBoutLabels`. */
export const viBoutLabels = {
    "boutLabel.weightStatus.ON_TRACK": "Đúng lộ trình",
    "boutLabel.weightStatus.ABOVE_TARGET": "Vượt đường mục tiêu",
    "boutLabel.weightStatus.OVER_LIMIT": "Vượt giới hạn giảm cân",
    "boutLabel.weightStatus.NOT_WEIGHED": "Chưa cân gần đây",
    "boutLabel.weightStatus.NEUTRAL": "Không đánh giá",

    "boutLabel.adherence.ON_PLAN": "Đúng kế hoạch",
    "boutLabel.adherence.SLIGHTLY_OFF": "Lệch một chút",
    "boutLabel.adherence.WAY_OFF": "Lệch nhiều",

    "boutLabel.nutritionPhase.camp": "Trong camp",
    "boutLabel.nutritionPhase.fightWeek": "Tuần thi đấu",
    "boutLabel.nutritionPhase.postWeighIn": "Từ lúc cân đến giờ thi",

    "boutLabel.phase.SCHEDULED": "Đã lên lịch",
    "boutLabel.phase.CAMP": "Đang chuẩn bị thi đấu",
    "boutLabel.phase.FIGHT_WEEK": "Tuần thi đấu",
    "boutLabel.phase.WEIGHED_IN": "Đã cân",
    "boutLabel.phase.COMPLETED": "Đã thi đấu",
    "boutLabel.phase.CANCELLED": "Đã huỷ",

    "boutLabel.sport.BOXING": "Quyền anh",
    "boutLabel.sport.MUAY_THAI": "Muay Thái",
    "boutLabel.sport.KICKBOXING": "Kickboxing",
    "boutLabel.sport.MMA": "MMA",

    "boutLabel.requirement.MISSING": "Còn thiếu",
    "boutLabel.requirement.PROVIDED": "Đã nộp",
    "boutLabel.requirement.CONFIRMED": "Đã xác nhận",
    "boutLabel.requirement.REJECTED": "Bị từ chối",

    "boutLabel.gate1Reason.MISSING": "còn thiếu",
    "boutLabel.gate1Reason.EXPIRED": "hết hạn trước ngày thi đấu",
    "boutLabel.gate1Reason.REJECTED": "bị từ chối",

    "boutLabel.cancelReason.OPPONENT_WITHDREW": "Đối thủ rút lui",
    "boutLabel.cancelReason.INJURY": "Chấn thương",
    "boutLabel.cancelReason.MISSED_WEIGHT": "Không đạt cân",
    "boutLabel.cancelReason.DOCUMENTS": "Hồ sơ",
    "boutLabel.cancelReason.ORGANISER_CANCELLED": "Ban tổ chức huỷ",
    "boutLabel.cancelReason.OTHER": "Khác",

    "boutLabel.hydration.NOT_APPLICABLE": "Không áp dụng",
    "boutLabel.hydration.PASSED": "Đạt",
    "boutLabel.hydration.FAILED": "Không đạt",

    "boutLabel.result.WIN": "Thắng",
    "boutLabel.result.LOSS": "Thua",
    "boutLabel.result.DRAW": "Hoà",
    "boutLabel.result.NO_CONTEST": "Không có kết quả",

    "boutLabel.method.KO": "KO",
    "boutLabel.method.TKO": "TKO",
    "boutLabel.method.DECISION": "Tính điểm",
    "boutLabel.method.SUBMISSION": "Khoá siết",
    "boutLabel.method.DQ": "Truất quyền",
    "boutLabel.method.OTHER": "Khác",

    "boutLabel.loc.NONE": "Không",
    "boutLabel.loc.UNDER_1_MIN": "Dưới 1 phút",
    "boutLabel.loc.OVER_1_MIN": "Trên 1 phút",
    "boutLabel.loc.UNKNOWN": "Không rõ",

    "boutLabel.suspensionReason.KO": "KO",
    "boutLabel.suspensionReason.TKO": "TKO",
    "boutLabel.suspensionReason.DQ": "Truất quyền",
    "boutLabel.suspensionReason.MANDATORY_REST": "Nghỉ bắt buộc",
    "boutLabel.suspensionReason.MEDICAL": "Y tế",
    "boutLabel.suspensionReason.OTHER": "Khác",

    "boutLabel.suspensionState.UPCOMING": "Chưa bắt đầu",
    "boutLabel.suspensionState.ACTIVE": "Đang đình chỉ",
    "boutLabel.suspensionState.AWAITING_CLEARANCE": "Chờ cấp phép",
    "boutLabel.suspensionState.ENDED": "Đã hết hạn",
    "boutLabel.suspensionState.CLEARED": "Được tập lại",

    /* Gate 1 badge */
    "boutLabel.gate1.ready": "Đủ hồ sơ",
    "boutLabel.gate1.missing": "Thiếu {n}",
    "boutLabel.gate1.missingOverdue": "Thiếu {n} · quá hạn",
} satisfies Record<keyof typeof enBoutLabels, string>;
