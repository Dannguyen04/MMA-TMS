"use client";

import { Ban, Check } from "lucide-react";

import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionTemplate } from "@/lib/domain/session-templates";
import type { TrainingType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface SessionTemplatePickerProps {
    templates: SessionTemplate[];
    /** `code` of the template the form was filled from, or null. */
    selectedCode: string | null;
    onSelect: (template: SessionTemplate) => void;
    onClear: () => void;
    /** Training types the chosen fighter's Medical Clearance restricts; their templates get a "Restricted" badge. */
    restrictedTypes: TrainingType[];
}

/** Lesson-plan templates as selectable cards, with the reason and steps of the chosen one. */
export function SessionTemplatePicker({ templates, selectedCode, onSelect, onClear, restrictedTypes }: SessionTemplatePickerProps) {
    const t = useT();
    const selected = templates.find((template) => template.code === selectedCode) ?? null;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div role="group" aria-label={t("sessionTemplates.groupLabel")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {templates.map((template) => {
                    const Icon = TRAINING_TYPE_ICONS[template.type];
                    const isSelected = template.code === selectedCode;
                    return (
                        <button
                            key={template.code}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onSelect(template)}
                            className={cn(
                                "relative flex min-w-0 flex-col items-start gap-1 rounded-lg border bg-surface p-3 text-left shadow-card transition-colors",
                                "hover:border-control-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                isSelected ? "border-primary bg-primary-soft/40 ring-2 ring-primary" : "border-border",
                            )}
                        >
                            <span className="flex w-full items-center gap-1.5 text-xs text-fg-muted">
                                <Icon aria-hidden className="size-3.5 shrink-0" />
                                <span>{t(`sessionTemplates.category.${template.category}`)}</span>
                                <span aria-hidden>·</span>
                                <span>{t("sessionTemplates.duration", { n: template.durationMin })}</span>
                            </span>
                            <span className="text-sm font-semibold text-fg">{template.name}</span>
                            <span className="text-[13px] text-fg-muted">{template.purpose}</span>
                            {restrictedTypes.includes(template.type) && (
                                <Badge tone="danger" size="sm" icon={Ban} className="mt-1">
                                    {t("sessionTemplates.restricted")}
                                </Badge>
                            )}
                            {isSelected && <Check aria-hidden className="absolute right-3 top-3 size-4 text-primary" />}
                        </button>
                    );
                })}
            </div>

            {selected && (
                <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4">
                    <div>
                        <p className="text-sm font-semibold text-fg">{t("sessionTemplates.why")}</p>
                        <p className="mt-1 text-[13px] text-fg-muted">{selected.rationale}</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-fg">{t("sessionTemplates.steps")}</p>
                        <ol className="mt-1 grid gap-2">
                            {selected.steps.map((step, index) => (
                                <li key={step.name} className="flex gap-2.5 text-[13px]">
                                    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                                        {index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="font-medium text-fg">{step.name}</span>
                                        <span className="block text-fg-muted">{step.detail}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <p className="text-[13px] text-fg-muted" role="status">
                        {t("sessionTemplates.filled")}
                    </p>
                    <div>
                        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                            {t("sessionTemplates.clear")}
                        </Button>
                    </div>
                </div>
            )}

            <p className="text-[13px] text-fg-muted">{t("sessionTemplates.disclaimer")}</p>
        </div>
    );
}
