import { createDemoCopy } from "@/lib/i18n/demo-copy";
import type { Locale } from "@/lib/i18n/config";
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
    const copy = createDemoCopy(locale);
    const { clearance, state } = summary;
    if (state === "full") return null;

    const action = (
        <ButtonLink href={href} variant="secondary" size="sm">
            {copy("View Health & Clearance")}
        </ButtonLink>
    );

    if (state === "restricted" && clearance) {
        const labels = clearance.restrictions.map((r) => r.label);
        return (
            <Callout
                tone="warning"
                icon={ShieldAlert}
                title={labels.length > 0 ? copy("Your Medical Clearance restricts: {labels}", { labels: labels.join(" · ") }) : copy("You're cleared with restrictions")}
                action={action}
            >
                {copy("Your coach plans sessions around these restrictions.")}
                {clearance.validUntil ? " " + copy("They apply until {date} unless your doctor updates them.", { date: formatDate(clearance.validUntil, locale) }) : null}
            </Callout>
        );
    }
    if (state === "not_cleared") {
        return (
            <Callout tone="danger" icon={ShieldX} title={copy("You're not cleared to train right now")} action={action}>
                {copy("Rest and follow your recovery guidance. Your sports doctor will update your clearance after your next assessment.")}
            </Callout>
        );
    }
    if (state === "expired") {
        return (
            <Callout tone="danger" icon={ShieldX} title={copy("Your Medical Clearance has expired")} action={action}>
                {copy("A sports doctor needs to renew it before training continues. Ask your coach to book the check.")}
            </Callout>
        );
    }
    return (
        <Callout tone="info" icon={ShieldQuestion} title={copy("No Medical Clearance on file yet")} action={action}>
            Your sports doctor issues one after your baseline examination. Until then, tell your coach straight away if anything hurts.
        </Callout>
    );
}
