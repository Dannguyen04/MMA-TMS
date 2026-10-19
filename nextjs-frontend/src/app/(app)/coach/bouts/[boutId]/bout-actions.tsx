"use client";

import { Edit3, Link2, Swords, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import {
    cancelBoutAction,
    enterFightWeekAction,
    linkCampAction,
    updateBoutAction,
} from "@/lib/actions/bouts";
import type { Bout, TrainingPlan } from "@/lib/domain/types";

export interface BoutHeaderActionsProps {
    bout: Bout;
    plans: TrainingPlan[];
}

function toLocalDatetimeInput(isoDate: string): string {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "";
    // Offset for UTC+7 (Asia/Ho_Chi_Minh)
    const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 16);
}

export function BoutHeaderActions({ bout, plans }: BoutHeaderActionsProps) {
    const toast = useToast();

    const [linkOpen, setLinkOpen] = useState(false);
    const [enterWeekOpen, setEnterWeekOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const isScheduled = bout.status === "SCHEDULED";
    const isCamp = bout.status === "CAMP";
    const canCancel = bout.status !== "COMPLETED" && bout.status !== "CANCELLED";
    const canEdit = bout.status === "SCHEDULED" || bout.status === "CAMP" || bout.status === "FIGHT_WEEK";

    return (
        <div className="flex flex-wrap items-center gap-2">
            {isScheduled && (
                <Button variant="primary" size="sm" onClick={() => setLinkOpen(true)}>
                    <Link2 aria-hidden className="size-4" />
                    Link camp plan
                </Button>
            )}

            {isCamp && (
                <Button variant="primary" size="sm" onClick={() => setEnterWeekOpen(true)}>
                    <Swords aria-hidden className="size-4" />
                    Enter fight week
                </Button>
            )}

            {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit3 aria-hidden className="size-4" />
                    Edit
                </Button>
            )}

            {canCancel && (
                <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} className="text-danger-fg hover:bg-danger-soft">
                    <XCircle aria-hidden className="size-4" />
                    Cancel bout
                </Button>
            )}

            {/* Link Camp Plan Dialog */}
            <ActionDialog
                open={linkOpen}
                onClose={() => setLinkOpen(false)}
                title="Link fight camp plan"
                description="Attach an active training plan in fight_camp phase to this bout. This will transition the bout to CAMP status."
                action={linkCampAction}
                submitLabel="Link camp"
                pendingLabel="Linking…"
                onSuccess={(state) => {
                    toast({ title: "Camp linked", description: state.message });
                    setLinkOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />
                        {plans.length === 0 ? (
                            <div className="rounded-lg border border-warning-border bg-warning-soft p-3.5 text-xs text-warning-fg">
                                <span className="font-semibold">No fight camp plans found.</span>
                                <p className="mt-1">
                                    This fighter has no active plans in the &quot;fight_camp&quot; phase. Please create or update a training plan first.
                                </p>
                            </div>
                        ) : (
                            <Field
                                label="Training plan"
                                htmlFor="link-plan-id"
                                required
                                error={form.error("trainingPlanId")}
                                hint="Only fight_camp plans belonging to this fighter are listed."
                            >
                                <Select id="link-plan-id" name="trainingPlanId" required defaultValue={plans[0]?.id}>
                                    {plans.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} (Phase: {p.phase})
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        )}
                    </div>
                )}
            </ActionDialog>

            {/* Enter Fight Week Dialog */}
            <ActionDialog
                open={enterWeekOpen}
                onClose={() => setEnterWeekOpen(false)}
                title="Enter fight week"
                description="Transition this bout from CAMP to FIGHT_WEEK. All required checklist items must be satisfied (Gate 1)."
                action={enterFightWeekAction}
                submitLabel="Confirm fight week"
                pendingLabel="Checking requirements…"
                onSuccess={(state) => {
                    toast({ title: "Entered fight week", description: state.message });
                    setEnterWeekOpen(false);
                }}
            >
                {() => (
                    <div className="flex flex-col gap-3">
                        <input type="hidden" name="boutId" value={bout.id} />
                        <p className="text-sm text-fg">
                            Entering fight week locks medical requirements and activates the final weight cut monitoring protocols.
                        </p>
                        {bout.gate1 && !bout.gate1.passed && (
                            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-xs text-danger-fg">
                                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                <div>
                                    <span className="font-semibold">Gate 1 checklist has missing items:</span>
                                    <ul className="mt-1 list-inside list-disc">
                                        {[...bout.gate1.missing, ...bout.gate1.expiring].map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ActionDialog>

            {/* Cancel Bout Dialog */}
            <ActionDialog
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                title="Cancel bout"
                description="Cancelling a bout is permanent. Please state the reason for cancellation."
                action={cancelBoutAction}
                submitLabel="Cancel bout"
                submitVariant="danger"
                pendingLabel="Cancelling…"
                onSuccess={(state) => {
                    toast({ title: "Bout cancelled", description: state.message });
                    setCancelOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />
                        <Field
                            label="Cancellation reason"
                            htmlFor="cancel-reason"
                            required
                            error={form.error("reason")}
                            hint="e.g. Fighter injury, opponent withdrawal, failed medical clearance, or contract dispute."
                        >
                            <Textarea
                                {...form.control("reason", { id: "cancel-reason", required: true })}
                                rows={3}
                                placeholder="Explain why the bout is being cancelled…"
                                maxLength={300}
                            />
                        </Field>
                    </div>
                )}
            </ActionDialog>

            {/* Edit Bout Dialog */}
            <ActionDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                size="lg"
                title="Edit bout details"
                description="Update tournament information, venue, opponent, weight limit and schedule."
                action={updateBoutAction}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                prepare={(fd) => {
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
                                message: "Weigh-in must be scheduled before the bout.",
                                fieldErrors: { weighInAt: "Weigh-in must be before the bout." },
                            };
                        }
                    }
                }}
                onSuccess={(state) => {
                    toast({ title: "Bout updated", description: state.message });
                    setEditOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Event name"
                                htmlFor="edit-event-name"
                                required
                                error={form.error("eventName")}
                            >
                                <Input
                                    id="edit-event-name"
                                    name="eventName"
                                    required
                                    defaultValue={bout.eventName}
                                    maxLength={120}
                                />
                            </Field>

                            <Field
                                label="Venue"
                                htmlFor="edit-venue"
                                error={form.error("venue")}
                            >
                                <Input
                                    id="edit-venue"
                                    name="venue"
                                    defaultValue={bout.venue ?? ""}
                                    maxLength={120}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Opponent"
                                htmlFor="edit-opponent-name"
                                error={form.error("opponentName")}
                            >
                                <Input
                                    id="edit-opponent-name"
                                    name="opponentName"
                                    defaultValue={bout.opponentName ?? ""}
                                    maxLength={100}
                                />
                            </Field>

                            <Field
                                label="Weight limit (kg)"
                                htmlFor="edit-weight-limit"
                                required
                                error={form.error("weightLimitKg")}
                            >
                                <Input
                                    id="edit-weight-limit"
                                    name="weightLimitKg"
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    defaultValue={bout.weightLimitKg.toString()}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label="Weigh-in date & time"
                                htmlFor="edit-weigh-in-at"
                                required
                                error={form.error("weighInAt")}
                            >
                                <Input
                                    id="edit-weigh-in-at"
                                    name="weighInAt"
                                    type="datetime-local"
                                    required
                                    defaultValue={toLocalDatetimeInput(bout.weighInAt)}
                                />
                            </Field>

                            <Field
                                label="Bout date & time"
                                htmlFor="edit-bout-at"
                                required
                                error={form.error("boutAt")}
                            >
                                <Input
                                    id="edit-bout-at"
                                    name="boutAt"
                                    type="datetime-local"
                                    required
                                    defaultValue={toLocalDatetimeInput(bout.boutAt)}
                                />
                            </Field>
                        </div>

                        <Field
                            label="Checklist due days before weigh-in"
                            htmlFor="edit-due-days"
                            error={form.error("requirementsDueDays")}
                            hint="Days before weigh-in when all documents must be submitted (default: 7)."
                        >
                            <Input
                                id="edit-due-days"
                                name="requirementsDueDays"
                                type="number"
                                min={0}
                                max={60}
                                defaultValue={bout.requirementsDueDays}
                            />
                        </Field>

                        <Field
                            label="Notes"
                            htmlFor="edit-notes"
                            error={form.error("notes")}
                        >
                            <Textarea
                                id="edit-notes"
                                name="notes"
                                rows={2}
                                defaultValue={bout.notes ?? ""}
                                maxLength={500}
                            />
                        </Field>
                    </div>
                )}
            </ActionDialog>
        </div>
    );
}
