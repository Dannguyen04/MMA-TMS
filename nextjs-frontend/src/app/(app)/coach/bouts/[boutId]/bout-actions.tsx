"use client";

import { Edit3, Link2, Swords, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";

import { useDemoCopy, useT } from "@/components/i18n/locale-provider";
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
    const t = useT();
    const copy = useDemoCopy();
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
                    {t("coachBouts.actions.linkCamp")}
                </Button>
            )}

            {isCamp && (
                <Button variant="primary" size="sm" onClick={() => setEnterWeekOpen(true)}>
                    <Swords aria-hidden className="size-4" />
                    {t("coachBouts.actions.enterFightWeek")}
                </Button>
            )}

            {canEdit && (
                <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    <Edit3 aria-hidden className="size-4" />
                    {t("coachBouts.actions.edit")}
                </Button>
            )}

            {canCancel && (
                <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} className="text-danger-fg hover:bg-danger-soft">
                    <XCircle aria-hidden className="size-4" />
                    {t("coachBouts.actions.cancelBout")}
                </Button>
            )}

            {/* Link Camp Plan Dialog */}
            <ActionDialog
                open={linkOpen}
                onClose={() => setLinkOpen(false)}
                title={t("coachBouts.dialog.linkCamp.title")}
                description={t("coachBouts.dialog.linkCamp.description")}
                action={linkCampAction}
                submitLabel={t("coachBouts.dialog.linkCamp.submit")}
                pendingLabel={t("coachBouts.dialog.linkCamp.pending")}
                onSuccess={(state) => {
                    toast({ title: t("coachBouts.toast.campLinked"), description: state.message });
                    setLinkOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />
                        {plans.length === 0 ? (
                            <div className="rounded-lg border border-warning-border bg-warning-soft p-3.5 text-xs text-warning-fg">
                                <span className="font-semibold">{t("coachBouts.dialog.linkCamp.noPlansTitle")}</span>
                                <p className="mt-1">
                                    {t("coachBouts.dialog.linkCamp.noPlansText")}
                                </p>
                            </div>
                        ) : (
                            <Field
                                label={t("coachBouts.dialog.linkCamp.planLabel")}
                                htmlFor="link-plan-id"
                                required
                                error={form.error("trainingPlanId")}
                                hint={t("coachBouts.dialog.linkCamp.planHint")}
                            >
                                <Select id="link-plan-id" name="trainingPlanId" required defaultValue={plans[0]?.id}>
                                    {plans.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title} ({t("coachBouts.dialog.linkCamp.phaseOption", { phase: t(`coachBouts.phase.${p.phase}`) })})
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
                title={t("coachBouts.dialog.enterFightWeek.title")}
                description={t("coachBouts.dialog.enterFightWeek.description")}
                action={enterFightWeekAction}
                submitLabel={t("coachBouts.dialog.enterFightWeek.submit")}
                pendingLabel={t("coachBouts.dialog.enterFightWeek.pending")}
                onSuccess={(state) => {
                    toast({ title: t("coachBouts.toast.enteredFightWeek"), description: state.message });
                    setEnterWeekOpen(false);
                }}
            >
                {() => (
                    <div className="flex flex-col gap-3">
                        <input type="hidden" name="boutId" value={bout.id} />
                        <p className="text-sm text-fg">
                            {t("coachBouts.dialog.enterFightWeek.notice")}
                        </p>
                        {bout.gate1 && !bout.gate1.passed && (
                            <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-xs text-danger-fg">
                                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                                <div>
                                    <span className="font-semibold">{t("coachBouts.dialog.enterFightWeek.gate1MissingTitle")}</span>
                                    <ul className="mt-1 list-inside list-disc">
                                        {[...bout.gate1.missing, ...bout.gate1.expiring].map((item) => (
                                            <li key={item}>{copy(item)}</li>
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
                title={t("coachBouts.dialog.cancel.title")}
                description={t("coachBouts.dialog.cancel.description")}
                action={cancelBoutAction}
                submitLabel={t("coachBouts.dialog.cancel.submit")}
                submitVariant="danger"
                pendingLabel={t("coachBouts.dialog.cancel.pending")}
                onSuccess={(state) => {
                    toast({ title: t("coachBouts.toast.boutCancelled"), description: state.message });
                    setCancelOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />
                        <Field
                            label={t("coachBouts.dialog.cancel.reasonLabel")}
                            htmlFor="cancel-reason"
                            required
                            error={form.error("reason")}
                            hint={t("coachBouts.dialog.cancel.reasonHint")}
                        >
                            <Textarea
                                {...form.control("reason", { id: "cancel-reason", required: true })}
                                rows={3}
                                placeholder={t("coachBouts.dialog.cancel.reasonPlaceholder")}
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
                title={t("coachBouts.dialog.edit.title")}
                description={t("coachBouts.dialog.edit.description")}
                action={updateBoutAction}
                submitLabel={t("coachBouts.dialog.edit.submit")}
                pendingLabel={t("coachBouts.dialog.edit.pending")}
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
                                message: t("coachBouts.form.error.weighInBeforeBout"),
                                fieldErrors: { weighInAt: t("coachBouts.form.error.weighInBeforeBout") },
                            };
                        }
                    }
                }}
                onSuccess={(state) => {
                    toast({ title: t("coachBouts.toast.boutUpdated"), description: state.message });
                    setEditOpen(false);
                }}
            >
                {(form) => (
                    <div className="flex flex-col gap-4">
                        <input type="hidden" name="boutId" value={bout.id} />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field
                                label={t("coachBouts.form.eventName")}
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
                                label={t("bout.venue")}
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
                                label={t("coachBouts.form.opponent")}
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
                                label={t("coachBouts.form.weightLimit")}
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
                                label={t("coachBouts.form.weighInAt")}
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
                                label={t("coachBouts.form.boutAt")}
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
                            label={t("coachBouts.dialog.edit.dueDaysLabel")}
                            htmlFor="edit-due-days"
                            error={form.error("requirementsDueDays")}
                            hint={t("coachBouts.dialog.edit.dueDaysHint")}
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
                            label={t("coachBouts.form.notes")}
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
