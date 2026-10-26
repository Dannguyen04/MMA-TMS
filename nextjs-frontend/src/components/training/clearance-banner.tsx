import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { ShieldAlert, ShieldQuestion, ShieldX } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { Callout } from "./callout";
import type { ClearanceSummary } from "./training-utils";

export interface ClearanceBannerProps {
    locale?: Locale;
    summary: ClearanceSummary;
    /** Where the full clearance lives, e.g. the fighter's health page. */
    href: string;
}

/** Fighter-facing summary of what the current Medical Clearance means for training. Renders nothing when fully cleared. */
export function ClearanceBanner({ summary, href, locale = "en" }: ClearanceBannerProps) {
    const t = createTranslator(locale);
    const { clearance, state } = summary;
    if (state === "full") return null;

    const action = (
        <ButtonLink href={href} variant="secondary" size="sm">
            {t("training.clearanceBanner.viewAction")}
        </ButtonLink>
    );

    if (state === "restricted" && clearance) {
        const labels = clearance.restrictions.map((r) => r.label);
        return (
            <Callout
                tone="warning"
                icon={ShieldAlert}
                title={labels.length > 0 ? t("training.clearanceBanner.restrictsTitle", { labels: labels.join(" · ") }) : t("training.clearanceBanner.restrictedTitle")}
                action={action}
            >
                {t("training.clearanceBanner.restrictedDesc")}
                {clearance.validUntil ? t("training.clearanceBanner.validUntilSuffix", { date: formatDate(clearance.validUntil, locale) }) : null}
            </Callout>
        );
    }
    if (state === "not_cleared") {
        return (
            <Callout tone="danger" icon={ShieldX} title={t("training.clearanceBanner.notClearedTitle")} action={action}>
                {t("training.clearanceBanner.notClearedDesc")}
            </Callout>
        );
    }
    if (state === "expired") {
        return (
            <Callout tone="danger" icon={ShieldX} title={t("training.clearanceBanner.expiredTitle")} action={action}>
                {t("training.clearanceBanner.expiredDesc")}
            </Callout>
        );
    }
    return (
        <Callout tone="info" icon={ShieldQuestion} title={t("training.clearanceBanner.noneTitle")} action={action}>
            {t("training.clearanceBanner.noneDesc")}
        </Callout>
    );
}
