"use client";

import {
    Calendar,
    CalendarX,
    ClipboardCheck,
    Edit2,
    FileText,
    Plus,
    Trash2,
    TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import {
    BoutRequirementStatusBadge,
    Gate1Badge,
} from "@/components/domain/status-badges";
import { useDemoCopy, useLocale, useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import {
    addRequirementAction,
    removeRequirementAction,
    updateRequirementAction,
} from "@/lib/actions/bouts";
import type { Bout, BoutRequirement } from "@/lib/domain/types";
import { dayKey, formatDate, formatShortDate } from "@/lib/format";

export function BoutChecklistCard({ bout }: { bout: Bout }) {
    const t = useT();
    const copy = useDemoCopy();
    const locale = useLocale();
    const toast = useToast();
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<BoutRequirement | null>(null);
    const [deleteItem, setDeleteItem] = useState<BoutRequirement | null>(null);

    const requirements = bout.requirements ?? [];
    const todayKey = dayKey(new Date());
    const isOverdue =
        Boolean(bout.requirementsDueOn) &&
        todayKey > (bout.requirementsDueOn ?? "") &&
        !bout.gate1?.passed;

    const boutDateKey = dayKey(bout.boutAt);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("coachBouts.checklist.title")}
                icon={<ClipboardCheck aria-hidden />}
                className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <Gate1Badge gate1={bout.gate1} locale={locale} />
                        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                            <Plus aria-hidden className="size-4" />
                            {t("coachBouts.checklist.addItem")}
                        </Button>
                    </div>
                }
            />

            <CardContent className="flex flex-col gap-4">
                {/* Due Date & Deadline Notice */}
                {bout.requirementsDueOn && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2 text-fg">
                            <Calendar aria-hidden className="size-4 text-fg-muted" />
                            <span>
                                {t("coachBouts.checklist.dueNotice", {
                                    date: formatShortDate(bout.requirementsDueOn, locale),
                                    days: bout.requirementsDueDays,
                                })}
                            </span>
                        </div>
                        {isOverdue && (
                            <Badge tone="danger" variant="solid" size="sm" icon={CalendarX}>
                                {t("coachBouts.checklist.overdue")}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Overdue Warning Callout */}
                {isOverdue && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-soft p-3 text-xs text-danger-fg">
                        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <div>
                            <span className="font-semibold">{t("coachBouts.checklist.overdueWarningTitle")}</span>
                            <p className="mt-0.5">
                                {t("coachBouts.checklist.overdueWarningText", { date: formatDate(bout.boutAt, locale) })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Requirements List */}
                {requirements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-xs text-fg-muted">
                        <FileText aria-hidden className="mb-2 size-8 text-fg-subtle" />
                        <p className="font-medium text-fg">{t("coachBouts.checklist.emptyTitle")}</p>
                        <p className="mt-1">{t("coachBouts.checklist.emptyText")}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border rounded-lg border border-border">
                        {requirements.map((req) => {
                            const isExpiringBeforeBout =
                                (req.status === "PROVIDED" || req.status === "CONFIRMED") &&
                                req.validUntil &&
                                dayKey(req.validUntil) < boutDateKey;

                            return (
                                <div
                                    key={req.code}
                                    className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-fg">{req.source === "PRESET" ? copy(req.label) : req.label}</span>
                                            {!req.required && (
                                                <Badge tone="neutral" variant="outline" size="sm">
                                                    {t("coachBouts.checklist.optional")}
                                                </Badge>
                                            )}
                                            <BoutRequirementStatusBadge status={req.status} size="sm" locale={locale} />
                                            {req.source === "COACH" && (
                                                <span className="rounded border border-warning-border bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-fg">
                                                    {t("coachBouts.checklist.coachEntered")}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                                            {req.issuedOn && (
                                                <span>{t("coachBouts.checklist.issuedDate", { date: formatDate(req.issuedOn, locale) })}</span>
                                            )}
                                            {req.validUntil && (
                                                <span className={isExpiringBeforeBout ? "font-medium text-danger-fg" : ""}>
                                                    {t("coachBouts.checklist.validUntil", { date: formatDate(req.validUntil, locale) })}
                                                    {isExpiringBeforeBout && t("coachBouts.checklist.expiresBeforeBout")}
                                                </span>
                                            )}
                                            {req.status === "REJECTED" && req.statusReason && (
                                                <span className="text-danger-fg">
                                                    {t("coachBouts.checklist.rejectedReason", { reason: req.statusReason })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditItem(req)}
                                            aria-label={t("coachBouts.checklist.editItemAria", { label: req.source === "PRESET" ? copy(req.label) : req.label })}
                                        >
                                            <Edit2 aria-hidden className="size-3.5" />
                                            {t("coachBouts.checklist.edit")}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteItem(req)}
                                            className="text-danger-fg hover:bg-danger-soft"
                                            aria-label={t("coachBouts.checklist.deleteItemAria", { label: req.label })}
                                        >
                                            <Trash2 aria-hidden className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>

            {/* Add Requirement Dialog */}
            <ActionDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                title={t("coachBouts.checklist.addDialog.title")}
                description={t("coachBouts.checklist.addDialog.description")}
                action={addRequirementAction}
                submitLabel={t("coachBouts.checklist.addDialog.submit")}
                pendingLabel={t("coachBouts.checklist.addDialog.pending")}
                onSuccess={(state) => {
                    toast({ title: t("coachBouts.toast.requirementAdded"), description: state.message });
                    setAddOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />

                        <Field
                            label={t("coachBouts.checklist.field.code")}
                            htmlFor="add-req-code"
                            required
                            error={form.error("code")}
                            hint={t("coachBouts.checklist.field.codeHint")}
                        >
                            <Input
                                id="add-req-code"
                                name="code"
                                required
                                placeholder={t("coachBouts.checklist.field.codePlaceholder")}
                                maxLength={40}
                            />
                        </Field>

                        <Field
                            label={t("coachBouts.checklist.field.label")}
                            htmlFor="add-req-label"
                            required
                            error={form.error("label")}
                            hint={t("coachBouts.checklist.field.labelHint")}
                        >
                            <Input
                                id="add-req-label"
                                name="label"
                                required
                                placeholder={t("coachBouts.checklist.field.labelPlaceholder")}
                                maxLength={120}
                            />
                        </Field>

                        <Checkbox
                            id="add-req-required"
                            name="required"
                            defaultChecked
                            label={t("coachBouts.checklist.field.requiredLabel")}
                        />

                        <Field
                            label={t("coachBouts.checklist.field.validityDays")}
                            htmlFor="add-req-validity"
                            error={form.error("validityDays")}
                            hint={t("coachBouts.checklist.field.validityDaysHint")}
                        >
                            <Input
                                id="add-req-validity"
                                name="validityDays"
                                type="number"
                                min={1}
                                max={730}
                                placeholder={t("coachBouts.checklist.field.validityDaysPlaceholder")}
                            />
                        </Field>
                    </div>
                )}
            </ActionDialog>

            {/* Edit Requirement Dialog */}
            {editItem && (
                <ActionDialog
                    open={Boolean(editItem)}
                    onClose={() => setEditItem(null)}
                    title={t("coachBouts.checklist.editDialog.title", { label: editItem.label })}
                    description={t("coachBouts.checklist.editDialog.description")}
                    action={updateRequirementAction}
                    submitLabel={t("coachBouts.dialog.edit.submit")}
                    pendingLabel={t("coachBouts.dialog.edit.pending")}
                    onSuccess={(state) => {
                        toast({ title: t("coachBouts.toast.requirementUpdated"), description: state.message });
                        setEditItem(null);
                    }}
                >
                    {(form) => (
                        <div className="flex flex-col gap-4">
                            <input type="hidden" name="boutId" value={bout.id} />
                            <input type="hidden" name="code" value={editItem.code} />

                            <Field
                                label={t("coachBouts.table.status")}
                                htmlFor="edit-req-status"
                                required
                                error={form.error("status")}
                            >
                                <Select
                                    id="edit-req-status"
                                    name="status"
                                    defaultValue={editItem.status}
                                >
                                    <option value="MISSING">{t("coachBouts.checklist.statusOption.MISSING")}</option>
                                    <option value="PROVIDED">{t("coachBouts.checklist.statusOption.PROVIDED")}</option>
                                    <option value="CONFIRMED">{t("coachBouts.checklist.statusOption.CONFIRMED")}</option>
                                    <option value="REJECTED">{t("coachBouts.checklist.statusOption.REJECTED")}</option>
                                </Select>
                            </Field>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field
                                    label={t("coachBouts.checklist.field.issuedDate")}
                                    htmlFor="edit-req-issued"
                                    error={form.error("issuedOn")}
                                >
                                    <Input
                                        id="edit-req-issued"
                                        name="issuedOn"
                                        type="date"
                                        defaultValue={editItem.issuedOn ?? ""}
                                    />
                                </Field>

                                <Field
                                    label={t("coachBouts.checklist.field.validUntil")}
                                    htmlFor="edit-req-valid"
                                    error={form.error("validUntil")}
                                    hint={t("coachBouts.checklist.field.validUntilHint")}
                                >
                                    <Input
                                        id="edit-req-valid"
                                        name="validUntil"
                                        type="date"
                                        defaultValue={editItem.validUntil ?? ""}
                                    />
                                </Field>
                            </div>

                            <Field
                                label={t("coachBouts.checklist.field.label")}
                                htmlFor="edit-req-label"
                                error={form.error("label")}
                            >
                                <Input
                                    id="edit-req-label"
                                    name="label"
                                    defaultValue={editItem.label}
                                    maxLength={120}
                                />
                            </Field>

                            <Checkbox
                                id="edit-req-required"
                                name="required"
                                defaultChecked={editItem.required}
                                label={t("coachBouts.checklist.field.requiredLabel")}
                            />

                            <Field
                                label={t("coachBouts.checklist.field.reason")}
                                htmlFor="edit-req-reason"
                                error={form.error("statusReason")}
                                hint={t("coachBouts.checklist.field.reasonHint")}
                            >
                                <Textarea
                                    id="edit-req-reason"
                                    name="statusReason"
                                    rows={2}
                                    defaultValue={editItem.statusReason ?? ""}
                                    placeholder={t("coachBouts.checklist.field.reasonPlaceholder")}
                                    maxLength={300}
                                />
                            </Field>
                        </div>
                    )}
                </ActionDialog>
            )}

            {/* Delete Requirement Dialog */}
            {deleteItem && (
                <ActionDialog
                    open={Boolean(deleteItem)}
                    onClose={() => setDeleteItem(null)}
                    title={t("coachBouts.checklist.deleteDialog.title")}
                    description={t("coachBouts.checklist.deleteDialog.description", { label: deleteItem.label, code: deleteItem.code })}
                    action={removeRequirementAction}
                    submitLabel={t("coachBouts.checklist.deleteDialog.submit")}
                    submitVariant="danger"
                    pendingLabel={t("coachBouts.checklist.deleteDialog.pending")}
                    onSuccess={(state) => {
                        toast({ title: t("coachBouts.toast.requirementRemoved"), description: state.message });
                        setDeleteItem(null);
                    }}
                >
                    {() => (
                        <div>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <input type="hidden" name="code" value={deleteItem.code} />
                            <p className="text-sm text-fg">
                                {t("coachBouts.checklist.deleteDialog.warning")}
                            </p>
                        </div>
                    )}
                </ActionDialog>
            )}
        </Card>
    );
}
