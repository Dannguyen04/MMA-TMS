import { Activity, CircleCheck, Droplets, HeartPulse, Scale, Thermometer, TriangleAlert, Wind, type LucideIcon } from "lucide-react";

import type { Vitals } from "@/lib/domain/types";
import { assessVitals, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const HYDRATION_LABELS: Record<Vitals["hydration"], string> = {
    good: "Good",
    fair: "Fair",
    poor: "Poor",
};

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
    className?: string;
}

/** Examination vitals with a "Normal" / "Check" indicator per reading against athlete reference ranges. */
export function VitalsGrid({ vitals, weightLimitKg, className }: VitalsGridProps) {
    const assessments = assessVitals(vitals, weightLimitKg);

    return (
        <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
            {readings(vitals).map((reading) => {
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
                            <Assessment assessment={assessment} />
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

function Assessment({ assessment }: { assessment: VitalAssessment | null }) {
    if (!assessment) return <span className="text-fg-subtle">No weight-class reference</span>;
    return (
        <>
            {assessment.status === "normal" ? (
                <span className="inline-flex items-center gap-1 font-medium text-success-fg">
                    <CircleCheck aria-hidden className="size-3.5" />
                    Normal
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    Check
                </span>
            )}
            <span className="text-fg-subtle">{assessment.advice ?? assessment.reference}</span>
        </>
    );
}

function readings(vitals: Vitals): VitalReading[] {
    return [
        { key: "weightKg", label: "Weight", icon: Scale, value: formatNumber(vitals.weightKg, 1), unit: "kg" },
        { key: "restingHeartRate", label: "Resting heart rate", icon: HeartPulse, value: formatNumber(vitals.restingHeartRate), unit: "bpm" },
        {
            key: "bloodPressure",
            label: "Blood pressure",
            icon: Activity,
            value: `${formatNumber(vitals.bloodPressureSystolic)}/${formatNumber(vitals.bloodPressureDiastolic)}`,
            unit: "mmHg",
        },
        { key: "temperatureC", label: "Temperature", icon: Thermometer, value: formatNumber(vitals.temperatureC, 1), unit: "°C" },
        { key: "spo2Pct", label: "SpO₂", icon: Wind, value: formatNumber(vitals.spo2Pct), unit: "%" },
        { key: "hydration", label: "Hydration", icon: Droplets, value: HYDRATION_LABELS[vitals.hydration], unit: "" },
    ];
}
