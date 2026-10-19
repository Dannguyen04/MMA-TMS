"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import type { CompetitionRuleset } from "@/lib/domain/types";
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
                        message: "Weigh-in must be before the bout.",
                        fieldErrors: { weighInAt: "Weigh-in must be before the bout." },
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
                        title="Fighter & ruleset"
                    >
                        <Field
                            label="Fighter"
                            htmlFor={`${formId}-fighterId`}
                            required
                            error={form.error("fighterId")}
                        >
                            <Select
                                {...form.control("fighterId", { id: `${formId}-fighterId`, required: true })}
                                value={fighterId}
                                onChange={(e) => setFighterId(e.target.value)}
                            >
                                <option value="">Choose a fighter…</option>
                                {fighters.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        <Field
                            label="Competition ruleset"
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
                                <span>Reference only, not verified with the organiser.</span>
                            </div>
                        )}

                        {hasWeightClasses ? (
                            <>
                                <Field
                                    label="Weight class"
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
                                    label="Weight limit (kg)"
                                    htmlFor={`${formId}-weightLimitKg`}
                                    required
                                    error={form.error("weightLimitKg")}
                                    hint="Enter the exact weight class limit in kg."
                                >
                                    <Input
                                        id={`${formId}-weightLimitKg`}
                                        name="weightLimitKg"
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={weightLimitKg}
                                        onChange={(e) => setWeightLimitKg(e.target.value)}
                                        placeholder="e.g. 63.5"
                                    />
                                </Field>
                            </>
                        )}
                    </FormSection>

                    <FormSection
                        title="Event"
                    >
                        <Field
                            label="Event name"
                            htmlFor={`${formId}-eventName`}
                            required
                            error={form.error("eventName")}
                        >
                            <Input
                                {...form.control("eventName", { id: `${formId}-eventName`, required: true })}
                                placeholder="e.g. Lotus Fight Night 18"
                                maxLength={120}
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Venue"
                                htmlFor={`${formId}-venue`}
                                error={form.error("venue")}
                            >
                                <Input
                                    {...form.control("venue", { id: `${formId}-venue` })}
                                    placeholder="e.g. Lotus Combat Arena, HCMC"
                                    maxLength={120}
                                />
                            </Field>

                            <Field
                                label="Opponent"
                                htmlFor={`${formId}-opponentName`}
                                error={form.error("opponentName")}
                                hint="Optional. Leave blank if not announced."
                            >
                                <Input
                                    {...form.control("opponentName", { id: `${formId}-opponentName` })}
                                    placeholder="e.g. Nguyễn Văn Hùng"
                                    maxLength={100}
                                />
                            </Field>
                        </div>
                    </FormSection>

                    <FormSection
                        title="Schedule"
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Weigh-in date & time"
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
                                label="Bout date & time"
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

                        <Field
                            label="Notes"
                            htmlFor={`${formId}-notes`}
                            error={form.error("notes")}
                        >
                            <Textarea
                                {...form.control("notes", { id: `${formId}-notes` })}
                                rows={3}
                                placeholder="Any special rules, contract agreements, or catchweight notes…"
                                maxLength={500}
                            />
                        </Field>
                    </FormSection>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
                    <ButtonLink href={routes.coach.bouts} variant="secondary">
                        Cancel
                    </ButtonLink>
                    <SubmitButton pending={form.pending}>Create bout</SubmitButton>
                </CardFooter>
            </Card>
        </form>
    );
}
