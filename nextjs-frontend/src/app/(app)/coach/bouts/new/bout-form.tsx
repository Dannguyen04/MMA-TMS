"use client";

import { Scale, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { previewFeasibilityAction } from "@/lib/actions/bouts";
import type { ActionState } from "@/lib/actions/state";
import type { CompetitionRuleset, WeightFeasibility } from "@/lib/domain/types";
import { Callout } from "@/components/training/callout";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";

export interface BoutFormFighter {
    id: string;
    name: string;
}

export interface BoutFormProps {
    fighters: BoutFormFighter[];
    rulesets: CompetitionRuleset[];
    action: (prev: ActionState<{ id: string }>, formData: FormData) => Promise<ActionState<{ id: string }>>;
    defaultFighterId?: string;
    defaultWeighInAt?: string;
    defaultBoutAt?: string;
}

export function BoutForm({
    fighters,
    rulesets,
    action,
    defaultFighterId = "",
    defaultWeighInAt = "",
    defaultBoutAt = "",
}: BoutFormProps) {
    const t = useT();
    const router = useRouter();
    const formId = useId();

    const [fighterId, setFighterId] = useState(defaultFighterId);
    const [rulesetId, setRulesetId] = useState(rulesets[0]?.id ?? "");
    const [weightClassCode, setWeightClassCode] = useState(rulesets[0]?.weightClasses[0]?.code ?? "custom");
    const [weightLimitKg, setWeightLimitKg] = useState<string>(
        rulesets[0]?.weightClasses[0]?.limitKg?.toString() ?? "60",
    );
    const [weighInAt, setWeighInAt] = useState(defaultWeighInAt);
    const [boutAt, setBoutAt] = useState(defaultBoutAt);

    const selectedRuleset = rulesets.find((r) => r.id === rulesetId);
    const hasWeightClasses = Boolean(selectedRuleset && selectedRuleset.weightClasses.length > 0);

    // R31: the weight check re-reads when the fighter, class or schedule changes. A warning, never a block.
    const limitKg = Number(weightLimitKg.replace(",", "."));
    const previewKey =
        fighterId && rulesetId && weighInAt && boutAt && Number.isFinite(limitKg)
            ? JSON.stringify({ fighterId, rulesetId, weightClassCode, weightLimitKg: limitKg, weighInAt, boutAt })
            : null;
    const [preview, setPreview] = useState<{ key: string; value: WeightFeasibility | null } | null>(null);
    useEffect(() => {
        if (!previewKey) return;
        let stale = false;
        const timer = setTimeout(() => {
            previewFeasibilityAction(JSON.parse(previewKey)).then(
                (value) => {
                    if (!stale) setPreview({ key: previewKey, value });
                },
                () => {
                    if (!stale) setPreview({ key: previewKey, value: null });
                },
            );
        }, 400);
        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [previewKey]);
    const feasibility = previewKey && preview?.key === previewKey ? preview.value : null;

    const form = useActionForm(action, {
        id: formId,
        prepare: (fd) => {
            const rawWeight = fd.get("weightLimitKg");
            if (typeof rawWeight === "string") {
                fd.set("weightLimitKg", rawWeight.replace(",", "."));
            }
            const wIn = fd.get("weighInAt") as string;
            const bAt = fd.get("boutAt") as string;
            if (wIn && bAt) {
                const wMs = new Date(wIn).getTime();
                const bMs = new Date(bAt).getTime();
                if (wMs >= bMs) {
                    return {
                        status: "error",
                        message: t("coachBouts.form.error.weighInBeforeBout"),
                        fieldErrors: { weighInAt: t("coachBouts.form.error.weighInBeforeBout") },
                    };
                }
            }
        },
        onSuccess: () => {
            router.push(routes.coach.bouts);
            router.refresh();
        },
    });

    const handleRulesetChange = (newRulesetId: string) => {
        setRulesetId(newRulesetId);
        const r = rulesets.find((item) => item.id === newRulesetId);
        if (r && r.weightClasses.length > 0) {
            setWeightClassCode(r.weightClasses[0].code);
            setWeightLimitKg(r.weightClasses[0].limitKg.toString());
        } else {
            setWeightClassCode("custom");
            // Keep current kg or default to 60
        }
    };

    const handleWeightClassChange = (newCode: string) => {
        setWeightClassCode(newCode);
        const wc = selectedRuleset?.weightClasses.find((item) => item.code === newCode);
        if (wc) {
            setWeightLimitKg(wc.limitKg.toString());
        }
    };

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormMessage {...form.message} className="mb-6" />

                    <FormSection
                        title={t("coachBouts.form.section.fighterRuleset")}
                    >
                        <Field
                            label={t("coachBouts.form.fighter")}
                            htmlFor={`${formId}-fighterId`}
                            required
                            error={form.error("fighterId")}
                        >
                            <Select
                                {...form.control("fighterId", { id: `${formId}-fighterId`, required: true })}
                                value={fighterId}
                                onChange={(e) => setFighterId(e.target.value)}
                            >
                                <option value="">{t("coachBouts.form.chooseFighter")}</option>
                                {fighters.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        <Field
                            label={t("coachBouts.form.ruleset")}
                            htmlFor={`${formId}-rulesetId`}
                            required
                            error={form.error("rulesetId")}
                        >
                            <Select
                                {...form.control("rulesetId", { id: `${formId}-rulesetId`, required: true })}
                                value={rulesetId}
                                onChange={(e) => handleRulesetChange(e.target.value)}
                            >
                                {rulesets.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        {selectedRuleset && !selectedRuleset.verified && (
                            <div className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-soft px-3.5 py-2.5 text-xs text-warning-fg">
                                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                                <span>{t("coachBouts.form.rulesetUnverifiedNotice")}</span>
                            </div>
                        )}

                        {hasWeightClasses ? (
                            <>
                                <Field
                                    label={t("coachBouts.form.weightClass")}
                                    htmlFor={`${formId}-weightClassCode`}
                                    required
                                    error={form.error("weightClassCode")}
                                >
                                    <Select
                                        id={`${formId}-weightClassCode`}
                                        name="weightClassCode"
                                        required
                                        value={weightClassCode}
                                        onChange={(e) => handleWeightClassChange(e.target.value)}
                                    >
                                        {selectedRuleset?.weightClasses.map((wc) => (
                                            <option key={wc.code} value={wc.code}>
                                                {wc.label}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <input type="hidden" name="weightLimitKg" value={weightLimitKg} />
                            </>
                        ) : (
                            <>
                                <input type="hidden" name="weightClassCode" value="custom" />
                                <Field
                                    label={t("coachBouts.form.weightLimit")}
                                    htmlFor={`${formId}-weightLimitKg`}
                                    required
                                    error={form.error("weightLimitKg")}
                                    hint={t("coachBouts.form.weightLimitHint")}
                                >
                                    <Input
                                        id={`${formId}-weightLimitKg`}
                                        name="weightLimitKg"
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={weightLimitKg}
                                        onChange={(e) => setWeightLimitKg(e.target.value)}
                                        placeholder={t("coachBouts.form.weightLimitPlaceholder")}
                                    />
                                </Field>
                            </>
                        )}
                    </FormSection>

                    <FormSection
                        title={t("coachBouts.form.section.event")}
                    >
                        <Field
                            label={t("coachBouts.form.eventName")}
                            htmlFor={`${formId}-eventName`}
                            required
                            error={form.error("eventName")}
                        >
                            <Input
                                {...form.control("eventName", { id: `${formId}-eventName`, required: true })}
                                placeholder={t("coachBouts.form.eventNamePlaceholder")}
                                maxLength={120}
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label={t("bout.venue")}
                                htmlFor={`${formId}-venue`}
                                error={form.error("venue")}
                            >
                                <Input
                                    {...form.control("venue", { id: `${formId}-venue` })}
                                    placeholder={t("coachBouts.form.venuePlaceholder")}
                                    maxLength={120}
                                />
                            </Field>

                            <Field
                                label={t("coachBouts.form.opponent")}
                                htmlFor={`${formId}-opponentName`}
                                error={form.error("opponentName")}
                                hint={t("coachBouts.form.opponentHint")}
                            >
                                <Input
                                    {...form.control("opponentName", { id: `${formId}-opponentName` })}
                                    placeholder={t("coachBouts.form.opponentPlaceholder")}
                                    maxLength={100}
                                />
                            </Field>
                        </div>
                    </FormSection>

                    <FormSection
                        title={t("coachBouts.form.section.schedule")}
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label={t("coachBouts.form.weighInAt")}
                                htmlFor={`${formId}-weighInAt`}
                                required
                                error={form.error("weighInAt")}
                            >
                                <Input
                                    {...form.control("weighInAt", { id: `${formId}-weighInAt`, required: true })}
                                    type="datetime-local"
                                    value={weighInAt}
                                    onChange={(e) => {
                                        setWeighInAt(e.target.value);
                                        form.markEdited("weighInAt");
                                    }}
                                />
                            </Field>

                            <Field
                                label={t("coachBouts.form.boutAt")}
                                htmlFor={`${formId}-boutAt`}
                                required
                                error={form.error("boutAt")}
                            >
                                <Input
                                    {...form.control("boutAt", { id: `${formId}-boutAt`, required: true })}
                                    type="datetime-local"
                                    value={boutAt}
                                    onChange={(e) => {
                                        setBoutAt(e.target.value);
                                        form.markEdited("boutAt");
                                    }}
                                />
                            </Field>
                        </div>

                        {feasibility && <FeasibilityNote feasibility={feasibility} t={t} />}

                        <Field
                            label={t("coachBouts.form.notes")}
                            htmlFor={`${formId}-notes`}
                            error={form.error("notes")}
                        >
                            <Textarea
                                {...form.control("notes", { id: `${formId}-notes` })}
                                rows={3}
                                placeholder={t("coachBouts.form.notesPlaceholder")}
                                maxLength={500}
                            />
                        </Field>
                    </FormSection>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
                    <ButtonLink href={routes.coach.bouts} variant="secondary">
                        {t("coachBouts.form.cancel")}
                    </ButtonLink>
                    <SubmitButton pending={form.pending}>{t("coachBouts.form.submitCreate")}</SubmitButton>
                </CardFooter>
            </Card>
        </form>
    );
}

const FEASIBILITY_TEXT = {
    OVER_LIMIT: "feasibility.OVER_LIMIT",
    ON_TRACK: "feasibility.ON_TRACK",
    NEUTRAL: "feasibility.NEUTRAL",
    NOT_WEIGHED: "feasibility.NOT_WEIGHED",
    ABOVE_TARGET: "feasibility.ON_TRACK",
} as const;

function FeasibilityNote({ feasibility, t }: { feasibility: WeightFeasibility; t: ReturnType<typeof useT> }) {
    const tone = feasibility.status === "OVER_LIMIT" ? "danger" : feasibility.status === "ON_TRACK" ? "success" : "neutral";
    return (
        <Callout tone={tone} icon={feasibility.status === "OVER_LIMIT" ? TriangleAlert : Scale} title={t("feasibility.title")} role="status">
            {t(FEASIBILITY_TEXT[feasibility.status], {
                kg: feasibility.latestKg != null ? formatNumber(feasibility.latestKg, 1) : "",
                remaining: feasibility.remainingPct != null ? formatNumber(feasibility.remainingPct, 1) : "",
                limit: formatNumber(feasibility.acuteLossLimitPct, 1),
                limitKg: formatNumber(feasibility.limitKg, 1),
                window: 7,
            })}
        </Callout>
    );
}
