import { Info, Sparkles, type LucideIcon } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Callout } from "@/components/training/callout";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate-client";

export type AINoticeAudience = "coach" | "fighter" | "doctor" | "admin";

const NOTICES: Record<AINoticeAudience, { title: string; body: string; icon: LucideIcon }> = {
    coach: {
        title: "Gợi ý của AI",
        body: "Kết quả AI là gợi ý. Hãy xác nhận hoặc sửa trước khi chia sẻ.",
        icon: Sparkles,
    },
    fighter: {
        title: "Ước tính của AI",
        body: "Kết quả AI ước tính từ video của bạn. HLV sẽ duyệt lại.",
        icon: Sparkles,
    },
    doctor: {
        title: "Quan sát AI",
        body: "Quan sát của AI không phải chẩn đoán và không thay thế khám lâm sàng.",
        icon: Info,
    },
    admin: {
        title: "Kết quả mô hình hỗ trợ",
        body: "Kết quả mô hình chỉ mang tính hỗ trợ. Thay đổi ngưỡng ảnh hưởng đến mục mà HLV và bác sĩ thấy là độ tin cậy thấp.",
        icon: Sparkles,
    },
};

export interface AINoticeProps {
    audience: AINoticeAudience;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
    /** Single-line variant without the title, for tight panels. */
    compact?: boolean;
    className?: string;
}

/** Standing reminder that AI output is assistive, worded for each audience. */
export function AINotice({ audience, compact = false, locale, className }: AINoticeProps) {
    const t = locale ? createTranslator(locale) : null;
    const notice = !t
        ? NOTICES[audience]
        : audience === "fighter"
          ? { ...NOTICES.fighter, title: t("aiNotice.fighterTitle"), body: t("aiNotice.fighter") }
          : {
                ...NOTICES[audience],
                title: t(`screens.training.aiNotice.${audience}.title` as MessageKey),
                body: t(`screens.training.aiNotice.${audience}.body` as MessageKey),
            };

    if (compact) {
        return (
            <InlineNote icon={notice.icon} tone="ai" className={className}>
                {notice.body}
            </InlineNote>
        );
    }
    return (
        <Callout tone="ai" icon={notice.icon} title={notice.title} className={className}>
            {notice.body}
        </Callout>
    );
}
