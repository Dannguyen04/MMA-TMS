"use client";

import { CheckCircle2, ClipboardPlus, Hourglass, MessageSquareWarning } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { requestMedicalReviewAction } from "@/lib/actions/medical-contract";
import { MEDICAL_TEXT_LIMITS, REQUESTER_ROLE_LABELS, type MedicalEligibility, type MedicalReviewRequest } from "@/lib/domain/medical-contract";
import { formatRelative } from "@/lib/format";
import { EligibilityReasons } from "./eligibility-reasons";

export type ReviewAudience = "fighter" | "coach" | "doctor";

export interface ReviewRequestCardProps {
    fighterId: string;
    fighterName: string;
    audience: ReviewAudience;
    /** Every request for the fighter, newest first. */
    requests: MedicalReviewRequest[];
    /** Training eligibility from the medical service; null when it isn't known. */
    eligibility: MedicalEligibility | null;
    /** Whether the viewer may ask for a review (the doctor records an examination instead). */
    canRequest: boolean;
    /** Where the doctor records the examination that answers open requests. */
    examineHref?: string;
    now: string;
    className?: string;
}

/** Resolved requests kept in view for context. */
const RECENT_RESOLVED = 2;

const HINTS: Record<ReviewAudience, string> = {
    fighter: "Your sports doctor sees this. Coaches only see that a review was requested.",
    coach: "The sports doctor and the fighter see this.",
    doctor: "The fighter and their coaches see that a review was requested.",
};

/** Coaches see what they asked themselves; what a fighter told the doctor stays between them. */
const reasonVisible = (audience: ReviewAudience, request: MedicalReviewRequest) => audience !== "coach" || request.requesterRole === "COACH";

function intro(audience: ReviewAudience, firstName: string): string {
    if (audience === "fighter") return "Hurt, unwell or unsure about training? Ask your sports doctor to review you. Training pauses until they examine you.";
    if (audience === "coach") return `Worried about ${firstName}? Ask the sports doctor for a review. Training pauses until the doctor examines ${firstName}.`;
    return "Requests from the fighter or their coaches. A training examination answers them.";
}

/**
 * Medical review requests for one fighter: why training is paused (if it is), what's waiting for the doctor, and a
 * short form to ask for a review. The form locks while sending so a request is never sent twice.
 */
export function ReviewRequestCard({ fighterId, fighterName, audience, requests, eligibility, canRequest, examineHref, now, className }: ReviewRequestCardProps) {
    const toast = useToast();
    const [reason, setReason] = useState("");
    const form = useActionForm(requestMedicalReviewAction, {
        onSuccess: (state) => {
            setReason("");
            toast({ title: "Review requested", description: state.message });
        },
    });
    const firstName = fighterName.split(" ")[0];
    const open = requests.filter((request) => request.status === "OPEN");
    const resolved = requests.filter((request) => request.status === "RESOLVED").slice(0, RECENT_RESOLVED);
    const reasons = eligibility && !eligibility.eligible ? eligibility.reasons : [];

    return (
        <Card className={className}>
            <CardHeader
                title="Medical review"
                icon={<MessageSquareWarning />}
                description={intro(audience, firstName)}
                action={open.length > 0 ? <Badge tone="warning" icon={Hourglass}>{open.length} open</Badge> : undefined}
            />
            <CardContent className="flex flex-col gap-4">
                {reasons.length > 0 && (
                    <section aria-label="Why training is paused" className="flex flex-col gap-2">
                        <h3 className="text-[13px] font-semibold text-fg">Training is paused</h3>
                        <EligibilityReasons reasons={reasons} />
                    </section>
                )}

                {open.length > 0 && (
                    <section aria-label="Waiting for the doctor" className="flex flex-col gap-2">
                        <h3 className="text-[13px] font-semibold text-fg">Waiting for the doctor</h3>
                        <ul className="flex flex-col divide-y divide-border rounded-lg ring-1 ring-border ring-inset">
                            {open.map((request) => (
                                <RequestRow key={request.id} request={request} showReason={reasonVisible(audience, request)} now={now} />
                            ))}
                        </ul>
                        {audience === "doctor" && examineHref && (
                            <ButtonLink href={examineHref} size="sm" className="self-start">
                                <ClipboardPlus aria-hidden />
                                Record training examination
                            </ButtonLink>
                        )}
                    </section>
                )}

                {canRequest && (
                    <form {...form.formProps} className="flex flex-col gap-3">
                        <input type="hidden" name="fighterId" value={fighterId} />
                        <Field
                            label={audience === "fighter" ? "What's going on?" : "What should the doctor look at?"}
                            htmlFor={form.control("reason").id}
                            error={form.error("reason")}
                            hint={HINTS[audience]}
                        >
                            <Textarea
                                {...form.control("reason", { hint: true })}
                                rows={3}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={MEDICAL_TEXT_LIMITS.reviewReason}
                                placeholder={audience === "fighter" ? "e.g. My left knee has been sore since Tuesday's sparring." : "e.g. Took a hard knee to the ribs in sparring today."}
                            />
                        </Field>
                        <FormMessage {...form.message} />
                        <Button type="submit" variant="secondary" size="sm" loading={form.pending} disabled={reason.trim().length === 0} className="self-start">
                            {form.pending ? "Sending…" : "Request review"}
                        </Button>
                    </form>
                )}

                {open.length === 0 && reasons.length === 0 && !canRequest && <p className="text-sm text-fg-muted">No review requests.</p>}

                {resolved.length > 0 && (
                    <section aria-label="Recently reviewed" className="flex flex-col gap-2 border-t border-border pt-4">
                        <h3 className="text-[13px] font-semibold text-fg-muted">Recently reviewed</h3>
                        <ul className="flex flex-col gap-2">
                            {resolved.map((request) => (
                                <li key={request.id} className="flex items-start gap-2 text-[13px] text-fg-muted">
                                    <CheckCircle2 aria-hidden className="mt-px size-4 shrink-0 text-success-fg" />
                                    <span className="min-w-0 text-pretty">
                                        {reasonVisible(audience, request) ? <span className="text-fg">“{request.reason}”</span> : `Requested by the ${REQUESTER_ROLE_LABELS[request.requesterRole].toLowerCase()}`}
                                        {request.resolvedAt && ` — reviewed ${formatRelative(request.resolvedAt, now).toLowerCase()}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </CardContent>
        </Card>
    );
}

function RequestRow({ request, showReason, now }: { request: MedicalReviewRequest; showReason: boolean; now: string }) {
    return (
        <li className="flex flex-col gap-0.5 px-3 py-2.5 text-[13px]">
            <p className="text-pretty text-fg">{showReason ? `“${request.reason}”` : "Review requested"}</p>
            <p className="text-fg-muted">
                {REQUESTER_ROLE_LABELS[request.requesterRole]} · <time dateTime={request.requestedAt}>{formatRelative(request.requestedAt, now)}</time>
            </p>
        </li>
    );
}
