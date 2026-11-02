"use client";

import { CalendarClock, CircleCheck, CircleX, PenLine } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { reviewAlertAction } from "@/lib/actions/clinical";
import type { DoctorDecision, DoctorReview } from "@/lib/domain/types";
import { DOCTOR_DECISION_META } from "./clinical-badges";
import { DOCTOR_DECISION_COPY } from "./clinical-copy";
import { DoctorReviewBlock } from "./doctor-review-block";

const DECISION_ICONS = { acknowledged: CircleCheck, follow_up: CalendarClock, dismissed: CircleX } as const;

const DECISION_OPTIONS: ChoiceOption<DoctorDecision>[] = (["acknowledged", "follow_up", "dismissed"] as const).map((value) => ({
    value,
    label: DOCTOR_DECISION_COPY[value].title,
    description: DOCTOR_DECISION_COPY[value].description,
    icon: DECISION_ICONS[value],
    tone: DOCTOR_DECISION_META[value].tone,
}));

const NOTE_HINT = "Lý do bạn đưa ra quyết định. Được lưu cùng quan sát và các bác sĩ phụ trách khác xem được.";

export interface AlertDecisionPanelProps {
    alertId: string;
    review: DoctorReview | null;
}

/** The doctor's decision on an AI observation: the recorded decision, or a form to record or change it. */
export function AlertDecisionPanel({ alertId, review }: AlertDecisionPanelProps) {
    const toast = useToast();
    const [editing, setEditing] = useState(review === null);
    const [decision, setDecision] = useState<DoctorDecision | "">(review?.decision ?? "");
    const [note, setNote] = useState("");

    const form = useActionForm(reviewAlertAction, {
        id: "alert-decision",
        onSuccess: (state) => {
            setEditing(false);
            setNote("");
            toast({ title: "Đã ghi quyết định", description: state.message });
        },
    });
    const noteControl = form.control("note", { hint: NOTE_HINT, required: true });

    if (!editing && review) {
        return (
            <div className="flex flex-col gap-3" aria-live="polite">
                <DoctorReviewBlock review={review} />
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                        setDecision(review.decision);
                        form.reset();
                        setEditing(true);
                    }}
                >
                    <PenLine aria-hidden />
                    Đổi quyết định
                </Button>
            </div>
        );
    }

    return (
        <form {...form.formProps} className="flex flex-col gap-4">
            <input type="hidden" name="alertId" value={alertId} />
            <ChoiceGroup
                id={form.control("decision").id}
                name="decision"
                legend="Quyết định"
                required
                options={DECISION_OPTIONS}
                value={decision}
                onChange={setDecision}
                error={form.error("decision")}
            />

            <Field label="Ghi chú lâm sàng" htmlFor={noteControl.id} required error={form.error("note")} hint={NOTE_HINT}>
                <Textarea
                    {...noteControl}
                    rows={4}
                    value={note}
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="VD: Đã xem các đoạn video; phù hợp với mệt mỏi ở hiệp 3. Kiểm tra lại ở buổi tập tuần sau."
                />
            </Field>

            <FormMessage {...form.message} />

            <div className="flex flex-wrap justify-end gap-2">
                {review && (
                    <Button variant="secondary" onClick={() => setEditing(false)} disabled={form.pending}>
                        Hủy
                    </Button>
                )}
                <Button type="submit" loading={form.pending}>
                    {form.pending ? "Đang ghi…" : "Ghi quyết định"}
                </Button>
            </div>
        </form>
    );
}
