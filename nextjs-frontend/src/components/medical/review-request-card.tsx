"use client";

import { CheckCircle2, ClipboardPlus, Hourglass, MessageSquareWarning } from "lucide-react";
import { useState } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { requestMedicalReviewAction } from "@/lib/actions/medical-contract";
import { MEDICAL_TEXT_LIMITS, REQUESTER_ROLE_LABELS, type MedicalEligibility, type MedicalReviewRequest } from "@/lib/domain/medical-contract";
import { formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
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

function hints(t: Translator): Record<ReviewAudience, string> {
    return {
        fighter: t("reviewRequest.hintFighter"),
        coach: t("reviewRequest.hintCoach"),
        doctor: t("reviewRequest.hintDoctor"),
    };
}

/** Coaches see what they asked themselves; what a fighter told the doctor stays between them. */
const reasonVisible = (audience: ReviewAudience, request: MedicalReviewRequest) => audience !== "coach" || request.requesterRole === "COACH";

function intro(t: Translator, audience: ReviewAudience, firstName: string): string {
    if (audience === "fighter") return t("reviewRequest.introFighter");
    if (audience === "coach") return t("reviewRequest.introCoach", { firstName });
    return t("reviewRequest.introDoctor");
}

/**
 * Medical review requests for one fighter: why training is paused (if it is), what's waiting for the doctor, and a
 * short form to ask for a review. The form locks while sending so a request is never sent twice.
 */
export function ReviewRequestCard({ fighterId, fighterName, audience, requests, eligibility, canRequest, examineHref, now, className }: ReviewRequestCardProps) {
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const [reason, setReason] = useState("");
    const form = useActionForm(requestMedicalReviewAction, {
        onSuccess: (state) => {
            setReason("");
            toast({ title: t("reviewRequest.toastTitle"), description: state.message });
        },
    });
    const firstName = fighterName.split(" ")[0];
    const open = requests.filter((request) => request.status === "OPEN");
    const resolved = requests.filter((request) => request.status === "RESOLVED").slice(0, RECENT_RESOLVED);
    const reasons = eligibility && !eligibility.eligible ? eligibility.reasons : [];
    const audienceHints = hints(t);

    return (
        <Card className={className}>
            <CardHeader
                title={t("reviewRequest.title")}
                icon={<MessageSquareWarning />}
                description={intro(t, audience, firstName)}
                action={open.length > 0 ? <Badge tone="warning" icon={Hourglass}>{t("reviewRequest.openCount", { count: open.length })}</Badge> : undefined}
            />
            <CardContent className="flex flex-col gap-4">
                {reasons.length > 0 && (
                    <section aria-label={t("reviewRequest.whyPausedSr")} className="flex flex-col gap-2">
                        <h3 className="text-[13px] font-semibold text-fg">{t("reviewRequest.whyPausedHeading")}</h3>
                        <EligibilityReasons reasons={reasons} locale={locale} />
                        {audience === "doctor" && examineHref && reasons.includes("EXAMINATION_REQUIRED") && (
                            <ButtonLink href={`${examineHref}&type=baseline`} size="sm" className="self-start">
                                <ClipboardPlus aria-hidden />
                                {t("reviewRequest.recordBaseline")}
                            </ButtonLink>
                        )}
                    </section>
                )}

                {open.length > 0 && (
                    <section aria-label={t("reviewRequest.waitingSr")} className="flex flex-col gap-2">
                        <h3 className="text-[13px] font-semibold text-fg">{t("reviewRequest.waitingHeading")}</h3>
                        <ul className="flex flex-col divide-y divide-border rounded-lg ring-1 ring-border ring-inset">
                            {open.map((request) => (
                                <RequestRow key={request.id} request={request} showReason={reasonVisible(audience, request)} now={now} locale={locale} />
                            ))}
                        </ul>
                        {audience === "doctor" && examineHref && (
                            <ButtonLink href={examineHref} size="sm" className="self-start">
                                <ClipboardPlus aria-hidden />
                                {t("reviewRequest.recordTrainingExam")}
                            </ButtonLink>
                        )}
                    </section>
                )}

                {canRequest && (
                    <form {...form.formProps} className="flex flex-col gap-3">
                        <input type="hidden" name="fighterId" value={fighterId} />
                        <Field
                            label={audience === "fighter" ? t("reviewRequest.fieldLabelFighter") : t("reviewRequest.fieldLabelCoach")}
                            htmlFor={form.control("reason").id}
                            error={form.error("reason")}
                            hint={audienceHints[audience]}
                        >
                            <Textarea
                                {...form.control("reason", { hint: true })}
                                rows={3}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={MEDICAL_TEXT_LIMITS.reviewReason}
                                placeholder={audience === "fighter" ? t("reviewRequest.placeholderFighter") : t("reviewRequest.placeholderCoach")}
                            />
                        </Field>
                        <FormMessage {...form.message} />
                        <Button type="submit" variant="secondary" size="sm" loading={form.pending} disabled={reason.trim().length === 0} className="self-start">
                            {form.pending ? t("reviewRequest.sending") : t("reviewRequest.submit")}
                        </Button>
                    </form>
                )}

                {open.length === 0 && reasons.length === 0 && !canRequest && <p className="text-sm text-fg-muted">{t("reviewRequest.noRequests")}</p>}

                {resolved.length > 0 && (
                    <section aria-label={t("reviewRequest.recentlyReviewedSr")} className="flex flex-col gap-2 border-t border-border pt-4">
                        <h3 className="text-[13px] font-semibold text-fg-muted">{t("reviewRequest.recentlyReviewed")}</h3>
                        <ul className="flex flex-col gap-2">
                            {resolved.map((request) => (
                                <li key={request.id} className="flex items-start gap-2 text-[13px] text-fg-muted">
                                    <CheckCircle2 aria-hidden className="mt-px size-4 shrink-0 text-success-fg" />
                                    <span className="min-w-0 text-pretty">
                                        {reasonVisible(audience, request) ? (
                                            <span className="text-fg">“{request.reason}”</span>
                                        ) : (
                                            t("reviewRequest.requestedBy", { role: REQUESTER_ROLE_LABELS[request.requesterRole].toLowerCase() })
                                        )}
                                        {request.resolvedAt && (
                                            <span>
                                                {t("reviewRequest.reviewedAgo", { ago: formatRelative(request.resolvedAt, now, locale).toLowerCase() })}
                                            </span>
                                        )}
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

function RequestRow({ request, showReason, now, locale }: { request: MedicalReviewRequest; showReason: boolean; now: string; locale: Locale }) {
    const t = useT();
    return (
        <li className="flex flex-col gap-0.5 px-3 py-2.5 text-[13px]">
            <p className="text-pretty text-fg">{showReason ? `“${request.reason}”` : t("reviewRequest.requestedReview")}</p>
            <p className="text-fg-muted">
                {REQUESTER_ROLE_LABELS[request.requesterRole]} · <time dateTime={request.requestedAt}>{formatRelative(request.requestedAt, now, locale)}</time>
            </p>
        </li>
    );
}
