"use client";

import { ShieldCheck, ShieldPlus } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { clearSuspensionAction, createSuspensionAction } from "@/lib/actions/bouts";
import type { ActionState } from "@/lib/actions/state";
import type { SuspensionReason } from "@/lib/domain/bout";
import { SUSPENSION_REASON_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { MANUAL_SUSPENSION_REASONS, suspensionEndsOn } from "@/lib/domain/suspension-rules";
import type { TrainingType } from "@/lib/domain/types";
import { formatDate, isDateKey } from "@/lib/format";

const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];

function useNotify() {
    const toast = useToast();
    return (state: ActionState<unknown>) => toast({ title: state.message ?? "Saved", tone: "success" });
}

export interface SuspensionDialogProps {
    /** After a result: the bout, its fighter and the reason the result calls for. Without it, a hand-entered suspension. */
    bout?: { id: string; reason: SuspensionReason; suggestedDays: number | null; rule: string | null };
    fighters?: { id: string; name: string }[];
    defaultBlocked: TrainingType[];
    startsOn: string;
    label: string;
    variant?: "primary" | "secondary";
}

/**
 * F7: a suggested or hand-entered suspension. Changing the suggested days needs a reason; the blocked session types
 * start from the ruleset and the coach can add more.
 */
export function SuspensionDialogButton({ bout, fighters, defaultBlocked, startsOn, label, variant = "primary" }: SuspensionDialogProps) {
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState(bout?.suggestedDays ? String(bout.suggestedDays) : "");
    const [start, setStart] = useState(startsOn);
    const notify = useNotify();
    const overridden = bout?.suggestedDays != null && days.trim() !== String(bout.suggestedDays);
    const dayCount = Number(days);
    const endsOn = isDateKey(start) && Number.isInteger(dayCount) && dayCount > 0 ? suspensionEndsOn(start, dayCount) : null;

    return (
        <>
            <Button variant={variant} onClick={() => setOpen(true)} className="self-start">
                <ShieldPlus aria-hidden />
                {label}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                    setDays(bout?.suggestedDays ? String(bout.suggestedDays) : "");
                    setStart(startsOn);
                }}
                title={bout ? "Confirm the suspension" : "New suspension"}
                description={
                    bout
                        ? bout.suggestedDays
                            ? `The ruleset suggests ${bout.suggestedDays} days (${bout.rule}). Confirm it, or change it with a reason.`
                            : "The ruleset has no rule for this. Enter the days yourself."
                        : "For a suspension outside a bout, such as a knockout in sparring or an organiser's medical ban. Earlier knockouts count towards the next suggestion."
                }
                size="lg"
                action={createSuspensionAction}
                submitLabel="Save suspension"
                pendingLabel="Saving"
                onSuccess={notify}
            >
                {(form) => {
                    const fighter = form.control("fighterId", { required: true });
                    const reason = form.control("reason", { required: true });
                    const startControl = form.control("startsOn", { required: true });
                    const daysControl = form.control("days", { required: true, hint: true });
                    const override = form.control("overrideReason", { required: true });
                    const note = form.control("note");
                    return (
                        <>
                            {bout ? (
                                <>
                                    <input type="hidden" name="boutId" value={bout.id} />
                                    <input type="hidden" name="reason" value={bout.reason} />
                                    <p className="text-sm text-fg">
                                        Reason: <span className="font-medium">{SUSPENSION_REASON_LABELS[bout.reason]}</span>
                                    </p>
                                </>
                            ) : (
                                <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                                    <Field label="Fighter" htmlFor={fighter.id} required error={form.error("fighterId")}>
                                        <Select {...fighter} defaultValue="">
                                            <option value="">Choose a fighter</option>
                                            {fighters?.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <Field label="Reason" htmlFor={reason.id} required error={form.error("reason")}>
                                        <Select {...reason} defaultValue="">
                                            <option value="">Choose a reason</option>
                                            {MANUAL_SUSPENSION_REASONS.map((value) => (
                                                <option key={value} value={value}>
                                                    {SUSPENSION_REASON_LABELS[value]}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>
                            )}
                            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                                <Field label="First day" htmlFor={startControl.id} required error={form.error("startsOn")}>
                                    <Input {...startControl} type="date" value={start} onChange={(event) => setStart(event.target.value)} />
                                </Field>
                                <Field
                                    label="Days"
                                    htmlFor={daysControl.id}
                                    required
                                    error={form.error("days")}
                                    hint={endsOn ? `Through ${formatDate(endsOn)}.` : "Whole days, such as 30."}
                                >
                                    <Input {...daysControl} inputMode="numeric" className="w-32" value={days} onChange={(event) => setDays(event.target.value)} />
                                </Field>
                            </div>
                            {overridden && (
                                <Field label="Why the days differ from the suggestion" htmlFor={override.id} required error={form.error("overrideReason")}>
                                    <Textarea {...override} rows={2} maxLength={300} />
                                </Field>
                            )}
                            <fieldset className="flex min-w-0 flex-col gap-2" data-invalid={form.error("blockedSessionTypes") ? "true" : undefined}>
                                <legend className="mb-1.5 text-sm font-medium text-fg">Blocked sessions</legend>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {TRAINING_TYPES.map((type) => (
                                        <Checkbox
                                            key={type}
                                            id={`${form.formProps.id}-blocked-${type}`}
                                            name="blockedSessionTypes"
                                            value={type}
                                            defaultChecked={defaultBlocked.includes(type)}
                                            label={TRAINING_TYPE_LABELS[type]}
                                        />
                                    ))}
                                </div>
                                {form.error("blockedSessionTypes") && <p className="text-[13px] font-medium text-danger-fg">{form.error("blockedSessionTypes")}</p>}
                            </fieldset>
                            <Checkbox
                                id={`${form.formProps.id}-clearance`}
                                name="requiresClearance"
                                defaultChecked={!bout || bout.reason === "KO" || bout.reason === "TKO"}
                                label="Needs clearance to train again"
                                description="After the last day the fighter stays blocked until a coach records what the return is based on."
                            />
                            <Field label="Note" htmlFor={note.id} optional error={form.error("note")}>
                                <Textarea {...note} rows={2} maxLength={300} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}

/** F7: after the last day, a coach confirms the return to training and writes what it is based on. */
export function ClearSuspensionButton({ suspensionId, fighterName }: { suspensionId: string; fighterName: string }) {
    const [open, setOpen] = useState(false);
    const notify = useNotify();
    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)}>
                <ShieldCheck aria-hidden />
                Clear to train
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={`Clear ${fighterName} to train`}
                description="Write what the return is based on. Without a doctor's letter, say so: the app records “no medical clearance”."
                action={clearSuspensionAction}
                submitLabel="Clear to train"
                pendingLabel="Saving"
                onSuccess={notify}
            >
                {(form) => {
                    const note = form.control("clearanceNote", { required: true, hint: true });
                    return (
                        <>
                            <input type="hidden" name="suspensionId" value={suspensionId} />
                            <Field label="Based on" htmlFor={note.id} required error={form.error("clearanceNote")} hint="Such as “Neurologist cleared, CT normal” or “Coach confirmed, no medical clearance”.">
                                <Textarea {...note} rows={3} maxLength={300} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}
