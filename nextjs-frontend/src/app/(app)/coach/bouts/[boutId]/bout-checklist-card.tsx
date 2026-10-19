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
                title="Medical checklist"
                icon={<ClipboardCheck aria-hidden />}
                className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        <Gate1Badge gate1={bout.gate1} />
                        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                            <Plus aria-hidden className="size-4" />
                            Add item
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
                                Documents due{" "}
                                <strong className="font-semibold text-fg">
                                    {formatShortDate(bout.requirementsDueOn)}
                                </strong>{" "}
                                ({bout.requirementsDueDays} days before weigh-in)
                            </span>
                        </div>
                        {isOverdue && (
                            <Badge tone="danger" variant="solid" size="sm" icon={CalendarX}>
                                Overdue
                            </Badge>
                        )}
                    </div>
                )}

                {/* Overdue Warning Callout */}
                {isOverdue && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-soft p-3 text-xs text-danger-fg">
                        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <div>
                            <span className="font-semibold">Checklist is past the required due date.</span>
                            <p className="mt-0.5">
                                All required documents must be marked Provided or Confirmed with validity through the bout date ({formatDate(bout.boutAt)}) before this bout can enter fight week.
                            </p>
                        </div>
                    </div>
                )}

                {/* Requirements List */}
                {requirements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-xs text-fg-muted">
                        <FileText aria-hidden className="mb-2 size-8 text-fg-subtle" />
                        <p className="font-medium text-fg">No requirements in this checklist</p>
                        <p className="mt-1">Add items requested by the tournament organiser or governing body.</p>
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
                                            <span className="font-medium text-fg">{req.label}</span>
                                            {!req.required && (
                                                <Badge tone="neutral" variant="outline" size="sm">
                                                    Optional
                                                </Badge>
                                            )}
                                            <BoutRequirementStatusBadge status={req.status} size="sm" />
                                            {req.source === "COACH" && (
                                                <span className="rounded border border-warning-border bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-fg">
                                                    Coach-entered, not verified
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                                            {req.issuedOn && (
                                                <span>Issued: {formatDate(req.issuedOn)}</span>
                                            )}
                                            {req.validUntil && (
                                                <span className={isExpiringBeforeBout ? "font-medium text-danger-fg" : ""}>
                                                    Valid until: {formatDate(req.validUntil)}
                                                    {isExpiringBeforeBout && " (expires before bout!)"}
                                                </span>
                                            )}
                                            {req.status === "REJECTED" && req.statusReason && (
                                                <span className="text-danger-fg">
                                                    Reason: {req.statusReason}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditItem(req)}
                                            aria-label={`Edit ${req.label}`}
                                        >
                                            <Edit2 aria-hidden className="size-3.5" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteItem(req)}
                                            className="text-danger-fg hover:bg-danger-soft"
                                            aria-label={`Delete ${req.label}`}
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
                title="Add checklist requirement"
                description="Add a medical or regulatory document required by the tournament."
                action={addRequirementAction}
                submitLabel="Add requirement"
                pendingLabel="Adding…"
                onSuccess={(state) => {
                    toast({ title: "Requirement added", description: state.message });
                    setAddOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />

                        <Field
                            label="Requirement code"
                            htmlFor="add-req-code"
                            required
                            error={form.error("code")}
                            hint="Short identifier, e.g. BLOOD_TEST, HEALTH_CERT, BRAIN_MRI."
                        >
                            <Input
                                id="add-req-code"
                                name="code"
                                required
                                placeholder="e.g. BRAIN_MRI"
                                maxLength={40}
                            />
                        </Field>

                        <Field
                            label="Document name / label"
                            htmlFor="add-req-label"
                            required
                            error={form.error("label")}
                            hint="Descriptive name shown on the checklist."
                        >
                            <Input
                                id="add-req-label"
                                name="label"
                                required
                                placeholder="e.g. Brain MRI / Neurological Evaluation"
                                maxLength={120}
                            />
                        </Field>

                        <Checkbox
                            id="add-req-required"
                            name="required"
                            defaultChecked
                            label="Required for Gate 1 clearance"
                        />

                        <Field
                            label="Validity period (days)"
                            htmlFor="add-req-validity"
                            error={form.error("validityDays")}
                            hint="Optional standard validity duration, e.g. 180 days."
                        >
                            <Input
                                id="add-req-validity"
                                name="validityDays"
                                type="number"
                                min={1}
                                max={730}
                                placeholder="e.g. 180"
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
                    title={`Edit ${editItem.label}`}
                    description="Update verification status, validity dates or document requirements."
                    action={updateRequirementAction}
                    submitLabel="Save changes"
                    pendingLabel="Saving…"
                    onSuccess={(state) => {
                        toast({ title: "Requirement updated", description: state.message });
                        setEditItem(null);
                    }}
                >
                    {(form) => (
                        <div className="flex flex-col gap-4">
                            <input type="hidden" name="boutId" value={bout.id} />
                            <input type="hidden" name="code" value={editItem.code} />

                            <Field
                                label="Status"
                                htmlFor="edit-req-status"
                                required
                                error={form.error("status")}
                            >
                                <Select
                                    id="edit-req-status"
                                    name="status"
                                    defaultValue={editItem.status}
                                >
                                    <option value="MISSING">Missing (Not provided)</option>
                                    <option value="PROVIDED">Provided (Under coach verification)</option>
                                    <option value="CONFIRMED">Confirmed (Verified by medical staff)</option>
                                    <option value="REJECTED">Rejected (Document rejected)</option>
                                </Select>
                            </Field>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field
                                    label="Issued date"
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
                                    label="Valid until"
                                    htmlFor="edit-req-valid"
                                    error={form.error("validUntil")}
                                    hint="Required if Provided. Must be on or after bout date."
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
                                label="Document label"
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
                                label="Required for Gate 1 clearance"
                            />

                            <Field
                                label="Status note / rejection reason"
                                htmlFor="edit-req-reason"
                                error={form.error("statusReason")}
                                hint="Required if status is Rejected."
                            >
                                <Textarea
                                    id="edit-req-reason"
                                    name="statusReason"
                                    rows={2}
                                    defaultValue={editItem.statusReason ?? ""}
                                    placeholder="Explain status changes or rejection reasons…"
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
                    title={`Delete requirement`}
                    description={`Are you sure you want to remove "${deleteItem.label}" (${deleteItem.code}) from this bout's checklist?`}
                    action={removeRequirementAction}
                    submitLabel="Delete requirement"
                    submitVariant="danger"
                    pendingLabel="Removing…"
                    onSuccess={(state) => {
                        toast({ title: "Requirement removed", description: state.message });
                        setDeleteItem(null);
                    }}
                >
                    {() => (
                        <div>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <input type="hidden" name="code" value={deleteItem.code} />
                            <p className="text-sm text-fg">
                                This item will be permanently removed from the bout checklist.
                            </p>
                        </div>
                    )}
                </ActionDialog>
            )}
        </Card>
    );
}
