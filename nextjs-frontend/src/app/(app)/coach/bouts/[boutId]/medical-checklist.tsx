"use client";

import { CircleAlert, Lock, LockOpen, PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { RequirementStateBadge } from "@/components/domain/status-badges";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { addRequirementAction, removeRequirementAction, unlockChecklistAction, updateRequirementAction } from "@/lib/actions/bouts";
import type { ActionState } from "@/lib/actions/state";
import type { BoutRequirement, RequirementState } from "@/lib/domain/bout";
import { COACH_REQUIREMENT_STATES, expiresBeforeBout, readyForBout, suggestedValidUntil } from "@/lib/domain/bout-rules";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNotify } from "../use-notify";

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


/** F4: what the event asks for, each document's state and validity, and the deadline. No file uploads. */
export function MedicalChecklist({ boutId, requirements, boutDay, dueOn, overdue, locked, canUnlock, unlock, editable }: MedicalChecklistProps) {
    const notify = useNotify();
    const t = useT();
    const locale = useLocale();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<BoutRequirement | null>(null);
    const [unlocking, setUnlocking] = useState(false);
    const remove = useConfirmAction((item: BoutRequirement) => removeRequirementAction({ boutId, code: item.code }), { onSuccess: notify });
    const ready = requirements.filter((item) => readyForBout(item, boutDay)).length;
    const canEdit = editable && !locked;

    return (
        <Card>
            <CardHeader
                title={t("boutDetail.checklist.title")}
                description={t("boutDetail.checklist.description", { date: formatDate(dueOn, locale), ready, total: requirements.length })}
                action={
                    canEdit ? (
                        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                            <Plus aria-hidden />
                            {t("boutDetail.checklist.add")}
                        </Button>
                    ) : undefined
                }
            />
            <CardContent className="flex flex-col gap-4">
                {overdue && (
                    <Callout tone="danger" icon={CircleAlert} title={t("boutDetail.checklist.late.title")}>
                        {t("boutDetail.checklist.late.text", { date: formatDate(dueOn, locale) })}
                    </Callout>
                )}
                {editable && locked && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineNote icon={Lock}>{t("boutDetail.checklist.locked")}</InlineNote>
                        {canUnlock && (
                            <Button size="sm" variant="secondary" onClick={() => setUnlocking(true)}>
                                <LockOpen aria-hidden />
                                {t("boutDetail.checklist.unlock")}
                            </Button>
                        )}
                    </div>
                )}
                {unlock && (
                    <InlineNote icon={LockOpen} tone="warning">
                        {t("boutDetail.checklist.unlockedBy", { by: unlock.by, at: formatDateTime(unlock.at, locale), reason: unlock.reason })}
                    </InlineNote>
                )}

                {requirements.length === 0 ? (
                    <p className="text-sm text-fg-muted">{t("boutDetail.checklist.empty")}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {requirements.map((item) => {
                            const late = expiresBeforeBout(item, boutDay);
                            return (
                                <li key={item.code} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                                            {item.label}
                                            <span className="text-xs font-normal text-fg-subtle">{item.required ? t("boutDetail.checklist.required") : t("boutDetail.checklist.optional")}</span>
                                            <RequirementStateBadge state={item.state} size="sm" locale={locale} />
                                        </p>
                                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-fg-muted">
                                            {item.issuedOn && <span>{t("boutDetail.checklist.issued", { date: formatDate(item.issuedOn, locale) })}</span>}
                                            {item.validUntil && (
                                                <span className={cn(late && "font-medium text-danger-fg")}>
                                                    {t("boutDetail.checklist.validUntil", { date: formatDate(item.validUntil, locale) })}
                                                    {late && ` ${t("boutDetail.checklist.beforeBout")}`}
                                                </span>
                                            )}
                                            {item.source === "COACH" && (
                                                <span className="inline-flex items-center gap-1">
                                                    <PenLine aria-hidden className="size-3.5" />
                                                    {t("boutDetail.coachEntered")}
                                                </span>
                                            )}
                                        </p>
                                        {item.state === "REJECTED" && item.statusReason && (
                                            <p className="mt-1 text-[13px] text-danger-fg">{t("boutDetail.checklist.rejected", { reason: item.statusReason })}</p>
                                        )}
                                    </div>
                                    {canEdit && item.state !== "CONFIRMED" && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => setEditing(item)} aria-label={t("boutDetail.checklist.editAria", { label: item.label })}>
                                                {t("boutDetail.common.edit")}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => remove.request(item)} aria-label={t("boutDetail.checklist.removeAria", { label: item.label })}>
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
                title={t("boutDetail.addDoc.title")}
                description={t("boutDetail.addDoc.description")}
                action={addRequirementAction}
                submitLabel={t("boutDetail.addDoc.submit")}
                pendingLabel={t("boutDetail.addDoc.pending")}
                onSuccess={notify}
            >
                {(form) => {
                    const label = form.control("label", { required: true });
                    const validity = form.control("validityDays", { hint: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={boutId} />
                            <Field label={t("boutDetail.addDoc.document")} htmlFor={label.id} required error={form.error("label")}>
                                <Input {...label} maxLength={80} autoComplete="off" placeholder={t("boutDetail.addDoc.documentPlaceholder")} />
                            </Field>
                            <Checkbox
                                id={`${form.formProps.id}-required`}
                                name="required"
                                defaultChecked
                                label={t("boutDetail.checklist.required")}
                                description={t("boutDetail.addDoc.requiredDescription")}
                            />
                            <Field label={t("boutDetail.addDoc.validFor")} htmlFor={validity.id} optional error={form.error("validityDays")} hint={t("boutDetail.addDoc.validForHint")}>
                                <Input {...validity} inputMode="numeric" className="w-32" suffix={t("boutDetail.addDoc.days")} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>

            {editing && <EditRequirementDialog boutId={boutId} item={editing} onClose={() => setEditing(null)} onSuccess={notify} />}

            <ConfirmDialog
                {...remove.dialogProps}
                title={t("boutDetail.removeDoc.title", { label: remove.payload?.label ?? t("boutDetail.removeDoc.thisDocument") })}
                description={t("boutDetail.removeDoc.description")}
                confirmLabel={t("boutDetail.removeDoc.confirm")}
            />

            <ActionDialog
                open={unlocking}
                onClose={() => setUnlocking(false)}
                title={t("boutDetail.unlock.title")}
                description={t("boutDetail.unlock.description")}
                action={unlockChecklistAction}
                submitLabel={t("boutDetail.checklist.unlock")}
                pendingLabel={t("boutDetail.unlock.pending")}
                onSuccess={notify}
            >
                {(form) => {
                    const reason = form.control("reason", { required: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={boutId} />
                            <Field label={t("boutDetail.common.reason")} htmlFor={reason.id} required error={form.error("reason")}>
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
    const t = useT();
    const [open, setOpen] = useState(true);
    const [state, setState] = useState<RequirementState | "">(item.state === "CONFIRMED" ? "" : item.state);
    const [issuedOn, setIssuedOn] = useState(item.issuedOn ?? "");
    const [validUntil, setValidUntil] = useState(item.validUntil ?? "");
    const stateOptions = COACH_REQUIREMENT_STATES.map((value) => ({ value, label: t(`boutLabel.requirement.${value}`) }));
    const close = () => {
        setOpen(false);
        onClose();
    };

    return (
        <ActionDialog
            open={open}
            onClose={close}
            title={item.label}
            description={t("boutDetail.editDoc.description")}
            action={updateRequirementAction}
            submitLabel={t("boutDetail.common.save")}
            pendingLabel={t("boutDetail.common.saving")}
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
                            legend={t("boutDetail.editDoc.status")}
                            required
                            options={stateOptions}
                            value={state}
                            onChange={setState}
                            error={form.error("state")}
                            variant="compact"
                            columns={3}
                        />
                        {showDates && (
                            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                                <Field label={t("boutDetail.editDoc.issuedOn")} htmlFor={issued.id} optional error={form.error("issuedOn")}>
                                    <Input
                                        {...issued}
                                        type="date"
                                        value={issuedOn}
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            const previous = suggestedValidUntil(issuedOn, item.validityDays);
                                            setIssuedOn(next);
                                            const suggestion = suggestedValidUntil(next, item.validityDays);
                                            // Follow the issue date unless the coach typed their own date.
                                            if (suggestion && (!validUntil || validUntil === previous)) setValidUntil(suggestion);
                                        }}
                                    />
                                </Field>
                                <Field
                                    label={t("boutDetail.editDoc.validUntil")}
                                    htmlFor={until.id}
                                    required={state === "PROVIDED"}
                                    error={form.error("validUntil")}
                                    hint={item.validityDays ? t("boutDetail.editDoc.validUntilSuggested", { n: item.validityDays }) : t("boutDetail.editDoc.validUntilHint")}
                                >
                                    <Input {...until} type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                                </Field>
                            </div>
                        )}
                        {state === "REJECTED" && (
                            <Field label={t("boutDetail.common.reason")} htmlFor={reason.id} required error={form.error("statusReason")}>
                                <Textarea {...reason} rows={2} maxLength={200} defaultValue={item.statusReason ?? ""} />
                            </Field>
                        )}
                    </>
                );
            }}
        </ActionDialog>
    );
}
