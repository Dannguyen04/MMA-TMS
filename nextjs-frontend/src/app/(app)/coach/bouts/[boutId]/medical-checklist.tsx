"use client";

import { CircleAlert, Lock, LockOpen, PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { RequirementStateBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { addRequirementAction, removeRequirementAction, unlockChecklistAction, updateRequirementAction } from "@/lib/actions/bouts";
import type { ActionState } from "@/lib/actions/state";
import type { BoutRequirement, RequirementState } from "@/lib/domain/bout";
import { COACH_REQUIREMENT_STATES, expiresBeforeBout, readyForBout, suggestedValidUntil } from "@/lib/domain/bout-rules";
import { REQUIREMENT_STATE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MedicalChecklistProps {
    boutId: string;
    requirements: BoutRequirement[];
    /** Academy date of the bout: documents must be valid through it. */
    boutDay: string;
    dueOn: string;
    overdue: boolean;
    locked: boolean;
    /** True in fight week or weighed in, where a reason reopens the checklist. */
    canUnlock: boolean;
    unlock: { at: string; by: string; reason: string } | null;
    /** False once the bout is over: the list is history. */
    editable: boolean;
}

const STATE_OPTIONS = COACH_REQUIREMENT_STATES.map((value) => ({ value, label: REQUIREMENT_STATE_LABELS[value] }));

function useNotify() {
    const toast = useToast();
    return (state: ActionState<unknown>) => toast({ title: state.message ?? "Saved", tone: "success" });
}

/** F4: what the event asks for, each document's state and validity, and the deadline. No file uploads. */
export function MedicalChecklist({ boutId, requirements, boutDay, dueOn, overdue, locked, canUnlock, unlock, editable }: MedicalChecklistProps) {
    const notify = useNotify();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<BoutRequirement | null>(null);
    const [unlocking, setUnlocking] = useState(false);
    const remove = useConfirmAction((item: BoutRequirement) => removeRequirementAction({ boutId, code: item.code }), { onSuccess: notify });
    const ready = requirements.filter((item) => readyForBout(item, boutDay)).length;
    const canEdit = editable && !locked;

    return (
        <Card>
            <CardHeader
                title="Medical checklist"
                description={`Due ${formatDate(dueOn)} · ${ready} of ${requirements.length} ready for the bout`}
                action={
                    canEdit ? (
                        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                            <Plus aria-hidden />
                            Add item
                        </Button>
                    ) : undefined
                }
            />
            <CardContent className="flex flex-col gap-4">
                {overdue && (
                    <Callout tone="danger" icon={CircleAlert} title="Documents late">
                        The deadline was {formatDate(dueOn)}. The bout can&apos;t enter fight week until every required document is in.
                    </Callout>
                )}
                {editable && locked && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineNote icon={Lock}>Locked for fight week. Unlock it to change a document, with a reason.</InlineNote>
                        {canUnlock && (
                            <Button size="sm" variant="secondary" onClick={() => setUnlocking(true)}>
                                <LockOpen aria-hidden />
                                Unlock
                            </Button>
                        )}
                    </div>
                )}
                {unlock && (
                    <InlineNote icon={LockOpen} tone="warning">
                        Unlocked by {unlock.by}, {formatDateTime(unlock.at)}: {unlock.reason}
                    </InlineNote>
                )}

                {requirements.length === 0 ? (
                    <p className="text-sm text-fg-muted">No documents listed. Add the ones the event&apos;s notice asks for.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {requirements.map((item) => {
                            const late = expiresBeforeBout(item, boutDay);
                            return (
                                <li key={item.code} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                                            {item.label}
                                            <span className="text-xs font-normal text-fg-subtle">{item.required ? "Required" : "Optional"}</span>
                                            <RequirementStateBadge state={item.state} size="sm" />
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-fg-muted">
                                            {item.issuedOn && <span>Issued {formatDate(item.issuedOn)}</span>}
                                            {item.validUntil && (
                                                <span className={cn(late && "font-medium text-danger-fg")}>
                                                    Valid until {formatDate(item.validUntil)}
                                                    {late && " (before the bout)"}
                                                </span>
                                            )}
                                            {item.source === "COACH" && (
                                                <span className="inline-flex items-center gap-1">
                                                    <PenLine aria-hidden className="size-3.5" />
                                                    Coach-entered, not verified
                                                </span>
                                            )}
                                        </p>
                                        {item.state === "REJECTED" && item.statusReason && <p className="mt-1 text-[13px] text-danger-fg">Rejected: {item.statusReason}</p>}
                                    </div>
                                    {canEdit && item.state !== "CONFIRMED" && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => setEditing(item)} aria-label={`Edit ${item.label}`}>
                                                Edit
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => remove.request(item)} aria-label={`Remove ${item.label}`}>
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>

            <ActionDialog
                open={adding}
                onClose={() => setAdding(false)}
                title="Add a document"
                description="From the event's notice. It starts as missing and is marked coach-entered."
                action={addRequirementAction}
                submitLabel="Add"
                pendingLabel="Adding"
                onSuccess={notify}
            >
                {(form) => {
                    const label = form.control("label", { required: true });
                    const validity = form.control("validityDays", { hint: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={boutId} />
                            <Field label="Document" htmlFor={label.id} required error={form.error("label")}>
                                <Input {...label} maxLength={80} autoComplete="off" placeholder="Brain CT" />
                            </Field>
                            <Checkbox id={`${form.formProps.id}-required`} name="required" defaultChecked label="Required" description="Gate 1 waits for required documents. Optional ones never block fight week." />
                            <Field label="Valid for" htmlFor={validity.id} optional error={form.error("validityDays")} hint="Days from the issue date, used to suggest the expiry. Such as 180.">
                                <Input {...validity} inputMode="numeric" className="w-32" suffix="days" />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>

            {editing && <EditRequirementDialog boutId={boutId} item={editing} onClose={() => setEditing(null)} onSuccess={notify} />}

            <ConfirmDialog
                {...remove.dialogProps}
                title={`Remove ${remove.payload?.label ?? "this document"}?`}
                description="It leaves the checklist, and Gate 1 no longer waits for it."
                confirmLabel="Remove"
            />

            <ActionDialog
                open={unlocking}
                onClose={() => setUnlocking(false)}
                title="Unlock the checklist"
                description="Fight week locks the documents. Say why one has to change; the reason stays on the bout."
                action={unlockChecklistAction}
                submitLabel="Unlock"
                pendingLabel="Unlocking"
                onSuccess={notify}
            >
                {(form) => {
                    const reason = form.control("reason", { required: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={boutId} />
                            <Field label="Reason" htmlFor={reason.id} required error={form.error("reason")}>
                                <Textarea {...reason} rows={3} maxLength={300} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </Card>
    );
}

/** Status, issue date, valid-until (suggested from the validity) and the reason for a rejection. */
function EditRequirementDialog({
    boutId,
    item,
    onClose,
    onSuccess,
}: {
    boutId: string;
    item: BoutRequirement;
    onClose: () => void;
    onSuccess: (state: ActionState<unknown>) => void;
}) {
    const [open, setOpen] = useState(true);
    const [state, setState] = useState<RequirementState | "">(item.state === "CONFIRMED" ? "" : item.state);
    const [issuedOn, setIssuedOn] = useState(item.issuedOn ?? "");
    const [validUntil, setValidUntil] = useState(item.validUntil ?? "");
    const close = () => {
        setOpen(false);
        onClose();
    };

    return (
        <ActionDialog
            open={open}
            onClose={close}
            title={item.label}
            description="Provided needs the date it is valid until. Rejected needs a reason."
            action={updateRequirementAction}
            submitLabel="Save"
            pendingLabel="Saving"
            onSuccess={onSuccess}
        >
            {(form) => {
                const issued = form.control("issuedOn");
                const until = form.control("validUntil", { required: state === "PROVIDED", hint: true });
                const reason = form.control("statusReason", { required: true });
                const showDates = state === "PROVIDED" || state === "REJECTED";
                return (
                    <>
                        <input type="hidden" name="boutId" value={boutId} />
                        <input type="hidden" name="code" value={item.code} />
                        <ChoiceGroup
                            id={`${form.formProps.id}-state`}
                            name="state"
                            legend="Status"
                            required
                            options={STATE_OPTIONS}
                            value={state}
                            onChange={setState}
                            error={form.error("state")}
                            variant="compact"
                            columns={3}
                        />
                        {showDates && (
                            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                                <Field label="Issued on" htmlFor={issued.id} optional error={form.error("issuedOn")}>
                                    <Input
                                        {...issued}
                                        type="date"
                                        value={issuedOn}
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            setIssuedOn(next);
                                            const suggestion = suggestedValidUntil(next, item.validityDays);
                                            if (suggestion && !validUntil) setValidUntil(suggestion);
                                        }}
                                    />
                                </Field>
                                <Field
                                    label="Valid until"
                                    htmlFor={until.id}
                                    required={state === "PROVIDED"}
                                    error={form.error("validUntil")}
                                    hint={item.validityDays ? `Suggested from ${item.validityDays} days of validity.` : "It must cover the bout day."}
                                >
                                    <Input {...until} type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                                </Field>
                            </div>
                        )}
                        {state === "REJECTED" && (
                            <Field label="Reason" htmlFor={reason.id} required error={form.error("statusReason")}>
                                <Textarea {...reason} rows={2} maxLength={200} defaultValue={item.statusReason ?? ""} />
                            </Field>
                        )}
                    </>
                );
            }}
        </ActionDialog>
    );
}
