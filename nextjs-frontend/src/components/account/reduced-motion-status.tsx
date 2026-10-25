"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "./use-media-query";

/** Shows whether the operating system currently asks for reduced motion. */
export function ReducedMotionStatus() {
    const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
    const t = useT();

    if (reduce === null) {
        return (
            <Badge tone="neutral" variant="outline">
                {t("account.a11y.checking")}
            </Badge>
        );
    }
    return (
        <Badge tone={reduce ? "success" : "neutral"} dot>
            {reduce ? t("account.a11y.motionReduced") : t("account.a11y.motionStandard")}
        </Badge>
    );
}
