import { Check, ChevronRight } from "lucide-react";

import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const STEPS: readonly MessageKey[] = ["doctorMedical.steps.examination", "doctorMedical.steps.clearance"];

/**
 * Where the doctor is in the two writes that clear a fighter: the examination first, then the clearance issued from it.
 * Shown in the page header of both forms.
 */
export async function ExamClearanceSteps({ current }: { current: 1 | 2 }) {
    const { t } = await getTranslator();
    return (
        <ol aria-label={t("doctorMedical.steps.label")} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {STEPS.map((label, index) => {
                const step = index + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
                        {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-fg-subtle" />}
                        <span className={cn("inline-flex items-center gap-1.5", active ? "font-semibold text-fg" : "text-fg-muted")}>
                            {done && <Check aria-hidden className="size-3.5 text-success-fg" />}
                            {t("doctorMedical.steps.step", { n: step, total: STEPS.length, label: t(label) })}
                            {done && <span className="sr-only">{t("doctorMedical.steps.done")}</span>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
