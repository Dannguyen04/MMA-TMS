"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import type { CompetitionRuleset } from "@/lib/domain/types";
import { routes } from "@/lib/routes";

export interface ReadinessFilterBarProps {
    rulesets: CompetitionRuleset[];
    initialRulesetId?: string;
    initialWeightLimitKg?: number;
    initialBoutOn?: string;
    labels: {
        ruleset: string;
        selectRuleset: string;
        weightClass: string;
        allWeightClasses: string;
        boutOn: string;
        apply: string;
        clear: string;
    };
}

export function ReadinessFilterBar({
    rulesets,
    initialRulesetId,
    initialWeightLimitKg,
    initialBoutOn,
    labels,
}: ReadinessFilterBarProps) {
    const [selectedRulesetId, setSelectedRulesetId] = useState<string>(
        initialRulesetId ?? "",
    );

    const activeRuleset = rulesets.find((r) => r.id === selectedRulesetId);
    const weightClasses = activeRuleset?.weightClasses ?? [];

    return (
        <form
            method="GET"
            action={routes.coach.readiness}
            className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-card"
        >
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                {/* Ruleset selector */}
                <div className="w-full sm:w-56">
                    <Field label={labels.ruleset} htmlFor="filter-rulesetId">
                        <Select
                            id="filter-rulesetId"
                            name="rulesetId"
                            value={selectedRulesetId}
                            onChange={(e) => setSelectedRulesetId(e.target.value)}
                        >
                            <option value="">{labels.selectRuleset}</option>
                            {rulesets.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                {/* Weight class selector */}
                <div className="w-full sm:w-52">
                    <Field label={labels.weightClass} htmlFor="filter-weightLimitKg">
                        <Select
                            id="filter-weightLimitKg"
                            name="weightLimitKg"
                            defaultValue={initialWeightLimitKg !== undefined ? String(initialWeightLimitKg) : ""}
                            disabled={!selectedRulesetId || weightClasses.length === 0}
                        >
                            <option value="">{labels.allWeightClasses}</option>
                            {weightClasses.map((wc) => (
                                <option key={wc.code} value={wc.limitKg}>
                                    {wc.label} ({wc.limitKg} kg)
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                {/* Expected bout date */}
                <div className="w-full sm:w-44">
                    <Field label={labels.boutOn} htmlFor="filter-boutOn">
                        <Input
                            id="filter-boutOn"
                            type="date"
                            name="boutOn"
                            defaultValue={initialBoutOn ?? ""}
                        />
                    </Field>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                    <Button type="submit">
                        <Filter aria-hidden className="size-4" />
                        {labels.apply}
                    </Button>
                    <Link
                        href={routes.coach.readiness}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted hover:border-fg-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40"
                    >
                        <RotateCcw aria-hidden className="size-3.5 text-fg-subtle" />
                        {labels.clear}
                    </Link>
                </div>
            </div>
        </form>
    );
}
