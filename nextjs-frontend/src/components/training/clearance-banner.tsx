import { ShieldAlert, ShieldQuestion, ShieldX } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { Callout } from "./callout";
import type { ClearanceSummary } from "./training-utils";

export interface ClearanceBannerProps {
    summary: ClearanceSummary;
    /** Where the full clearance lives, e.g. the fighter's health page. */
    href: string;
}

/** Fighter-facing summary of what the current Medical Clearance means for training. Renders nothing when fully cleared. */
export function ClearanceBanner({ summary, href }: ClearanceBannerProps) {
    const { clearance, state } = summary;
    if (state === "full") return null;

    const action = (
        <ButtonLink href={href} variant="secondary" size="sm">
            View Health &amp; Clearance
        </ButtonLink>
    );

    if (state === "restricted" && clearance) {
        const labels = clearance.restrictions.map((r) => r.label);
        return (
            <Callout
                tone="warning"
                icon={ShieldAlert}
                title={labels.length > 0 ? `Your Medical Clearance restricts: ${labels.join(" · ")}` : "You're cleared with restrictions"}
                action={action}
            >
                Your coach plans sessions around these restrictions.
                {clearance.validUntil ? ` They apply until ${formatDate(clearance.validUntil)} unless your doctor updates them.` : null}
            </Callout>
        );
    }
    if (state === "not_cleared") {
        return (
            <Callout tone="danger" icon={ShieldX} title="You're not cleared to train right now" action={action}>
                Rest and follow your recovery guidance. Your sports doctor will update your clearance after your next assessment.
            </Callout>
        );
    }
    if (state === "expired") {
        return (
            <Callout tone="danger" icon={ShieldX} title="Your Medical Clearance has expired" action={action}>
                A sports doctor needs to renew it before training continues. Ask your coach to book the check.
            </Callout>
        );
    }
    return (
        <Callout tone="info" icon={ShieldQuestion} title="No Medical Clearance on file yet" action={action}>
            Your sports doctor issues one after your baseline examination. Until then, tell your coach straight away if anything hurts.
        </Callout>
    );
}
