import { Activity, CircleCheck, Droplets, HeartPulse, Scale, Thermometer, TriangleAlert, Wind, type LucideIcon } from "lucide-react";

import type { Vitals } from "@/lib/domain/types";
import { assessVitals, vitalAssessmentMessage, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

interface VitalReading {
    key: VitalKey;
    label: string;
    icon: LucideIcon;
    value: string;
    unit: string;
}

export interface VitalsGridProps {
    vitals: Vitals;
    /** Weight-class limit in kg; enables the weight check against a sensible walk-around margin. */
    weightLimitKg?: number;
    locale?: Locale;
    className?: string;
}

/** Examination vitals with a "Normal" / "Check" indicator per reading against athlete reference ranges. */
export function VitalsGrid({ vitals, weightLimitKg, locale = "en", className }: VitalsGridProps) {
    const t = createTranslator(locale);
    const assessments = assessVitals(vitals, weightLimitKg);

    return (
        <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
            {readings(vitals, t).map((reading) => {
                const Icon = reading.icon;
                const assessment = assessments[reading.key];
                return (
                    <div key={reading.key} className="min-w-0 rounded-lg bg-surface-muted px-3 py-2.5">
                        <dt className="flex items-center gap-1.5 text-xs text-fg-muted">
                            <Icon aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                            <span className="truncate">{reading.label}</span>
                        </dt>
                        <dd className="mt-1 flex items-baseline gap-1 text-lg leading-tight font-semibold text-fg">
                            {reading.value}
                            {reading.unit && <span className="text-xs font-medium text-fg-muted">{reading.unit}</span>}
                        </dd>
                        <dd className="mt-1 flex flex-col gap-0.5 text-xs">
                            <Assessment assessment={assessment} t={t} />
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

function Assessment({ assessment, t }: { assessment: VitalAssessment | null; t: Translator }) {
    if (!assessment) return <span className="text-fg-subtle">{t("vitals.noWeightClassReference")}</span>;
    return (
        <>
            {assessment.status === "normal" ? (
                <span className="inline-flex items-center gap-1 font-medium text-success-fg">
                    <CircleCheck aria-hidden className="size-3.5" />
                    {t("vitals.normal")}
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    {t("vitals.check")}
                </span>
            )}
            <span className="text-fg-subtle">{vitalAssessmentMessage(t, assessment)}</span>
        </>
    );
}

function readings(vitals: Vitals, t: Translator): VitalReading[] {
    return [
        { key: "weightKg", label: t("vitals.weight"), icon: Scale, value: formatNumber(vitals.weightKg, 1), unit: "kg" },
        { key: "restingHeartRate", label: t("vitals.restingHeartRate"), icon: HeartPulse, value: formatNumber(vitals.restingHeartRate), unit: "bpm" },
        {
            key: "bloodPressure",
            label: t("vitals.bloodPressure"),
            icon: Activity,
            value: `${formatNumber(vitals.bloodPressureSystolic)}/${formatNumber(vitals.bloodPressureDiastolic)}`,
            unit: "mmHg",
        },
        { key: "temperatureC", label: t("vitals.temperature"), icon: Thermometer, value: formatNumber(vitals.temperatureC, 1), unit: "°C" },
        { key: "spo2Pct", label: t("vitals.spo2"), icon: Wind, value: formatNumber(vitals.spo2Pct), unit: "%" },
        { key: "hydration", label: t("vitals.hydration"), icon: Droplets, value: t(`hydration.${vitals.hydration}`), unit: "" },
    ];
}
