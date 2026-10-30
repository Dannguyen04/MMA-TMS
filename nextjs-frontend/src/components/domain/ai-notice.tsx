import { Info, Sparkles, type LucideIcon } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Callout } from "@/components/training/callout";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";

export type AINoticeAudience = "coach" | "fighter" | "doctor" | "admin";

const NOTICES: Record<AINoticeAudience, { title: string; body: string; icon: LucideIcon }> = {
    coach: {
        title: "AI suggestions",
        body: "AI findings are suggestions from computer vision. Confirm or correct them before sharing with fighters.",
        icon: Sparkles,
    },
    fighter: {
        title: "AI estimates",
        body: "These results are AI estimates from your video. Your coach reviews them — treat unreviewed items as a guide, not a verdict.",
        icon: Sparkles,
    },
    doctor: {
        title: "AI movement observations",
        body: "AI observations are supporting information only. They are not a medical diagnosis and do not replace clinical examination or professional judgement.",
        icon: Info,
    },
    admin: {
        title: "Assistive model outputs",
        body: "Model outputs are assistive. Threshold changes affect what coaches and doctors see as low confidence.",
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
