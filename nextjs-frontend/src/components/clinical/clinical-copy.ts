import { formatMeasure } from "@/components/domain/domain-format";
import { BODY_REGION_LABELS, bodyRegionLabel, injuryTypeName } from "@/lib/domain/labels";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import type { AbnormalMovementAlert, BodyRegion, DoctorDecision, Injury, InjurySeverity, InjuryStatus } from "@/lib/domain/types";

/** Plain-language clinical copy shared by the injury, recovery and AI observation screens. */

export const BODY_REGION_GROUPS: { label: string; regions: BodyRegion[] }[] = [
    { label: "Đầu & cổ", regions: ["head", "neck"] },
    { label: "Chi trên", regions: ["right_shoulder", "left_shoulder", "right_elbow", "left_elbow", "right_hand", "left_hand"] },
    { label: "Thân", regions: ["chest", "ribs", "lower_back"] },
    {
        label: "Chi dưới",
        regions: [
            "right_hip",
            "left_hip",
            "right_hamstring",
            "left_hamstring",
            "right_knee",
            "left_knee",
            "right_shin",
            "left_shin",
            "right_ankle",
            "left_ankle",
        ],
    },
];

export const INJURY_SEVERITY_DESCRIPTIONS: Record<InjurySeverity, string> = {
    minor: "Ít hoặc không mất thời gian tập. Triệu chứng thường hết trong khoảng một tuần với tập điều chỉnh.",
    moderate: "Mất thời gian tập, thường từ một đến bốn tuần. Cần điều trị bài bản và kế hoạch phục hồi.",
    severe: "Tổn thương cấu trúc đáng kể hoặc nghỉ trên bốn tuần. Có thể cần chẩn đoán hình ảnh, chuyển chuyên khoa hoặc phẫu thuật.",
    critical: "Cần chuyên khoa xử trí khẩn. Không tập cho đến khi bác sĩ thể thao cho phép.",
};

export const OPEN_INJURY_STATUS_DESCRIPTIONS: Record<Exclude<InjuryStatus, "resolved">, string> = {
    active: "Giai đoạn cấp — đang điều trị, chưa trở lại tập.",
    recovering: "Đã qua giai đoạn cấp, đang theo kế hoạch trở lại tập.",
};

export function injuryTitle(injury: Pick<Injury, "type" | "typeLabel" | "bodyRegion">, locale?: Locale): string {
    return `${injuryTypeName(injury, locale)} — ${bodyRegionLabel(injury.bodyRegion, locale)}`;
}

/** Lower-case "muscle strain, left hamstring" for use inside sentences and option labels. */
export function injuryPhrase(injury: Pick<Injury, "type" | "bodyRegion">): string {
    return `${injuryTypeName(injury).toLowerCase()}, ${BODY_REGION_LABELS[injury.bodyRegion].toLowerCase()}`;
}

export function painLabel(level: number, locale?: Locale): string {
    if (locale) {
        const t = createTranslator(locale);
        if (level <= 0) return t("painLabel.none");
        if (level <= 3) return t("painLabel.mild");
        if (level <= 6) return t("painLabel.moderate");
        if (level <= 9) return t("painLabel.severe");
        return t("painLabel.worstPossible");
    }
    if (level <= 0) return "Không đau";
    if (level <= 3) return "Nhẹ";
    if (level <= 6) return "Trung bình";
    if (level <= 9) return "Nặng";
    return "Đau tột độ";
}

const RELATIVE_UNIT = "% mức nền";

/** "14° vs 6° baseline", or "81% of baseline" when the metric is already relative. */
export function describeMetricComparison(metric: AbnormalMovementAlert["metric"]): string {
    if (metric.unit === RELATIVE_UNIT) return `${formatMeasure(metric.observed, "%")} so với mức nền`;
    return `${formatMeasure(metric.observed, metric.unit)} so với mức nền ${formatMeasure(metric.baseline, metric.unit)}`;
}

/** Unit to show next to the observed and baseline values on their own. */
export function metricUnit(metric: AbnormalMovementAlert["metric"]): string {
    return metric.unit === RELATIVE_UNIT ? "%" : metric.unit;
}

export const DOCTOR_DECISION_COPY: Record<DoctorDecision, { title: string; description: string; past: string }> = {
    acknowledged: {
        title: "Xác nhận",
        description: "Ghi nhận là có ý nghĩa lâm sàng. Chỉ cần theo dõi thường quy ở lần gặp tiếp theo.",
        past: "Đã xác nhận",
    },
    follow_up: {
        title: "Hẹn theo dõi",
        description: "Cần theo dõi lâm sàng. HLV được báo đã hẹn theo dõi và cần kiểm tra giấy phép — không kèm chi tiết lâm sàng.",
        past: "Đã hẹn theo dõi",
    },
    dismissed: {
        title: "Bỏ qua",
        description: "Không có ý nghĩa lâm sàng, ví dụ do lựa chọn kỹ thuật, góc máy hoặc lỗi nhận dạng. Quan sát được đóng.",
        past: "Đã bỏ qua",
    },
};
