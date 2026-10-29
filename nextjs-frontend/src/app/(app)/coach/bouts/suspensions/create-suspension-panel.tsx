"use client";

import { ArrowRight, CalendarX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { SessionStatusBadge } from "@/components/domain/status-badges";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { useT } from "@/components/i18n/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { createSuspensionAction } from "@/lib/actions/suspensions";
import { SESSION_TYPES, type SessionType } from "@/lib/domain/medical-contract";
import { trainingPhaseLabel, trainingTypeLabel } from "@/lib/domain/labels";
import { deriveRequiresClearance, endsOnFor } from "@/lib/domain/suspension-rules";
import type {
    SuspensionCreation,
    SuspensionReason,
    TrainingType,
} from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface CreateSuspensionPanelProps {
    open: boolean;
    onClose: () => void;
    fighters: Array<{ id: string; name: string }>;
    locale: Locale;
    todayKey: string;
}

const DEFAULT_DAYS_BY_REASON: Record<SuspensionReason, number> = {
    KO: 30,
    TKO: 30,
    MANDATORY_REST: 7,
    DQ: 14,
    MEDICAL: 14,
    OTHER: 14,
};

export function scrollDialogToTop(element: HTMLElement | null): boolean {
    if (!element) return false;
    const scrollContainer = (element.closest(".overflow-y-auto") || element.parentElement) as HTMLElement | null;
    if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        return true;
    }
    return false;
}

export function CreateSuspensionPanel({
    open,
    onClose,
    fighters,
    locale,
    todayKey,
}: CreateSuspensionPanelProps) {
    const t = useT();
    const router = useRouter();
    const toast = useToast();

    // Form states
    const [fighterId, setFighterId] = useState("");
    const [reason, setReason] = useState<SuspensionReason>("KO");
    const [startsOn, setStartsOn] = useState(todayKey);
    const [days, setDays] = useState(30);
    const [mode, setMode] = useState<"tier" | "custom">("tier");
    const [maxTier, setMaxTier] = useState<number>(1);
    const [customBlockedTypes, setCustomBlockedTypes] = useState<SessionType[]>(["SPARRING"]);
    const [requiresClearance, setRequiresClearance] = useState<boolean>(true);

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Success consequence view state
    const [createdResult, setCreatedResult] = useState<SuspensionCreation | null>(null);
    const consequenceTitleRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (createdResult && consequenceTitleRef.current) {
            scrollDialogToTop(consequenceTitleRef.current);
            consequenceTitleRef.current.focus({ preventScroll: true });
        }
    }, [createdResult]);

    const handleReasonChange = (newReason: SuspensionReason) => {
        setReason(newReason);
        setDays(DEFAULT_DAYS_BY_REASON[newReason]);
        const clearanceRes = deriveRequiresClearance(newReason);
        if (clearanceRes.ok) {
            setRequiresClearance(clearanceRes.requiresClearance);
        }
    };

    const endsOn = endsOnFor(startsOn, days);

    const isKoOrTko = reason === "KO" || reason === "TKO";
    const isDqOrRest = reason === "DQ" || reason === "MANDATORY_REST";
    const isClearanceLocked = isKoOrTko || isDqOrRest;

    const resetForm = () => {
        setFighterId("");
        setReason("KO");
        setStartsOn(todayKey);
        setDays(30);
        setMode("tier");
        setMaxTier(1);
        setCustomBlockedTypes(["SPARRING"]);
        setRequiresClearance(true);
        setFormErrors({});
        setGeneralError(null);
        setCreatedResult(null);
    };

    const handleClose = () => {
        if (isPending) return;
        const hadResult = createdResult !== null;
        resetForm();
        onClose();
        if (hadResult) {
            router.refresh();
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormErrors({});
        setGeneralError(null);

        if (!fighterId) {
            setFormErrors({ fighterId: t("coachBouts.action.selectFighterFromRoster") });
            return;
        }

        const formData = new FormData();
        formData.set("fighterId", fighterId);
        formData.set("reason", reason);
        formData.set("startsOn", startsOn);
        formData.set("days", String(days));

        if (mode === "tier") {
            formData.set("maxTier", String(maxTier));
        } else {
            for (const type of customBlockedTypes) {
                formData.append("blockedSessionTypes", type);
            }
        }

        formData.set("requiresClearance", requiresClearance ? "true" : "false");

        startTransition(async () => {
            const result = await createSuspensionAction({ status: "idle" }, formData);
            if (result.status === "success" && result.data) {
                toast({ title: result.message || t("suspensions.action.created"), tone: "success" });
                setCreatedResult(result.data);
            } else {
                const errMsg = result.message || t("suspensions.action.failed");
                toast({ title: errMsg, tone: "error" });
                setGeneralError(errMsg);
                if (result.fieldErrors) {
                    setFormErrors(result.fieldErrors);
                }
            }
        });
    };

    const reasonOptions: ChoiceOption<SuspensionReason>[] = [
        {
            value: "KO",
            label: "KO",
            description: t("suspensions.reasonDesc.KO"),
        },
        {
            value: "TKO",
            label: "TKO",
            description: t("suspensions.reasonDesc.TKO"),
        },
        {
            value: "DQ",
            label: t("suspension.reason.DQ"),
            description: t("suspensions.reasonDesc.DQ"),
        },
        {
            value: "MANDATORY_REST",
            label: t("suspension.reason.MANDATORY_REST"),
            description: t("suspensions.reasonDesc.MANDATORY_REST"),
        },
        {
            value: "MEDICAL",
            label: t("suspension.reason.MEDICAL"),
            description: t("suspensions.reasonDesc.MEDICAL"),
        },
        {
            value: "OTHER",
            label: t("suspension.reason.OTHER"),
            description: t("suspensions.reasonDesc.OTHER"),
        },
    ];

    const translator = createTranslator(locale);

    // Consequence counts
    const cancelledCount =
        createdResult?.affectedSessions.filter((s) => s.action === "cancel").length ?? 0;
    const rescheduledCount =
        createdResult?.affectedSessions.filter((s) => s.action === "pending").length ?? 0;
    const rehabPlansCount = createdResult?.affectedPlans.length ?? 0;

    const summaryParts: string[] = [];
    if (cancelledCount > 0) {
        summaryParts.push(
            plural(t, "suspensions.consequences.summaryCancelled", cancelledCount, {
                count: cancelledCount,
            }),
        );
    }
    if (rescheduledCount > 0) {
        summaryParts.push(
            plural(t, "suspensions.consequences.summaryRescheduled", rescheduledCount, {
                count: rescheduledCount,
            }),
        );
    }
    if (rehabPlansCount > 0) {
        summaryParts.push(
            plural(t, "suspensions.consequences.summaryRehabPlans", rehabPlansCount, {
                count: rehabPlansCount,
            }),
        );
    }
    const summaryHeadline = summaryParts.join(" · ");

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            side="right"
            size="lg"
            dismissible={!isPending}
            title={createdResult ? t("suspensions.consequences.title") : t("suspensions.panel.title")}
            description={
                createdResult
                    ? t("suspensions.consequences.subtitle")
                    : t("suspensions.panel.description")
            }
        >
            {createdResult ? (
                /* BẢNG TÓM TẮT HỆ QUẢ */
                <div className="flex flex-col gap-5 py-1">
                    {summaryHeadline && (
                        <div className="flex items-start gap-3 rounded-xl border border-warning-border/80 bg-warning-soft/40 p-4">
                            <CalendarX
                                className="size-5 shrink-0 text-warning-solid mt-0.5"
                                aria-hidden="true"
                            />
                            <h3
                                ref={consequenceTitleRef}
                                tabIndex={-1}
                                className="text-[15px] font-bold text-fg leading-snug outline-hidden"
                            >
                                {summaryHeadline}
                            </h3>
                        </div>
                    )}

                    {createdResult.affectedSessions.length === 0 &&
                    createdResult.affectedPlans.length === 0 ? (
                        <div className="rounded-xl border border-border bg-surface-muted/30 p-6 text-center">
                            <h3
                                ref={consequenceTitleRef}
                                tabIndex={-1}
                                className="outline-hidden text-sm font-medium text-fg"
                            >
                                {t("suspensions.consequences.none")}
                            </h3>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">

                            {createdResult.affectedSessions.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <h4 className="text-xs font-medium text-fg-muted">
                                        {t("suspensions.consequences.affectedSessions", {
                                             count: createdResult.affectedSessions.length,
                                        })}
                                    </h4>
                                    <ul className="flex flex-col gap-2">
                                        {createdResult.affectedSessions.map((session, index) => {
                                            const isCancelled = session.action === "cancel";
                                            return (
                                                <li
                                                    key={session.sessionId}
                                                    style={{
                                                        animationDelay: `${Math.min(index * 50, 250)}ms`,
                                                    }}
                                                    className={cn(
                                                        "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs",
                                                        "motion-safe:animate-consequence-in",
                                                    )}
                                                >
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        {session.type && (
                                                            <TrainingTypeIcon
                                                                type={
                                                                    (session.type.toLowerCase() as TrainingType) ||
                                                                    "recovery_mobility"
                                                                }
                                                                locale={locale}
                                                                className="size-4 shrink-0 text-fg-muted"
                                                            />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p
                                                                className={cn(
                                                                    "truncate text-sm font-medium text-fg",
                                                                    isCancelled &&
                                                                        "text-fg-muted line-through decoration-danger decoration-1",
                                                                )}
                                                            >
                                                                {session.name ||
                                                                    t(
                                                                        "suspensions.consequences.fallbackSessionTitle",
                                                                    )}
                                                            </p>
                                                            {session.scheduledAt && (
                                                                <p className="text-xs text-fg-muted">
                                                                    {formatShortDate(
                                                                        session.scheduledAt,
                                                                        locale,
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <SessionStatusBadge
                                                        status={isCancelled ? "cancelled" : "pending"}
                                                        locale={locale}
                                                        size="sm"
                                                    />
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {createdResult.affectedPlans.length > 0 && (
                                <div className="flex flex-col gap-2 pt-2">
                                    <h4 className="text-xs font-medium text-fg-muted">
                                        {t("suspensions.consequences.affectedPlans", {
                                            count: createdResult.affectedPlans.length,
                                        })}
                                    </h4>
                                    <ul className="flex flex-col gap-2">
                                        {createdResult.affectedPlans.map((plan, index) => (
                                            <li
                                                key={plan.planId}
                                                style={{
                                                    animationDelay: `${Math.min((createdResult.affectedSessions.length + index) * 50, 250)}ms`,
                                                }}
                                                className={cn(
                                                    "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs",
                                                    "motion-safe:animate-consequence-in",
                                                )}
                                            >
                                                <span className="truncate text-sm font-medium text-fg">
                                                    {plan.name || plan.planId}
                                                </span>
                                                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-info-fg">
                                                    <span>{trainingPhaseLabel(t, plan.fromPhase)}</span>
                                                    <ArrowRight className="size-3" />
                                                    <span>{trainingPhaseLabel(t, plan.toPhase)}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                        <ButtonLink
                            href={routes.coach.sessions}
                            variant="secondary"
                            className="text-sm"
                        >
                            {t("suspensions.consequences.viewSchedule")}
                        </ButtonLink>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleClose}
                        >
                            {t("suspensions.consequences.done")}
                        </Button>
                    </div>
                </div>
            ) : (
                /* FORM TẠO ĐÌNH CHỈ */
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-1">
                    {/* 1. Võ sĩ */}
                    <Field
                        htmlFor="fighter-select"
                        label={t("suspensions.panel.fighter")}
                        required
                        error={formErrors.fighterId}
                    >
                        <Select
                            id="fighter-select"
                            value={fighterId}
                            onChange={(e) => {
                                setFighterId(e.target.value);
                                if (formErrors.fighterId) {
                                    setFormErrors((prev) => ({ ...prev, fighterId: "" }));
                                }
                            }}
                            required
                            disabled={isPending}
                            className="w-full"
                        >
                            <option value="">{t("suspensions.panel.fighterPlaceholder")}</option>
                            {fighters.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    {/* 2. Lý do */}
                    <ChoiceGroup<SuspensionReason>
                        id="suspension-reason"
                        name="reason"
                        legend={t("suspensions.panel.reason")}
                        options={reasonOptions}
                        value={reason}
                        onChange={handleReasonChange}
                        columns={2}
                        variant="compact"
                        error={formErrors.reason}
                    />

                    {/* 3. Ngày bắt đầu, Số ngày & Kết thúc tính sẵn */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            htmlFor="starts-on-input"
                            label={t("suspensions.panel.startsOn")}
                            required
                            error={formErrors.startsOn}
                        >
                            <Input
                                id="starts-on-input"
                                type="date"
                                value={startsOn}
                                min={todayKey}
                                onChange={(e) => setStartsOn(e.target.value)}
                                required
                                disabled={isPending}
                            />
                        </Field>

                        <Field
                            htmlFor="days-input"
                            label={t("suspensions.panel.days")}
                            required
                            error={formErrors.days}
                            hint={t("suspensions.panel.endsOn", {
                                date: formatShortDate(endsOn, locale),
                            })}
                        >
                            <Input
                                id="days-input"
                                type="number"
                                min={1}
                                max={365}
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                required
                                disabled={isPending}
                            />
                        </Field>
                    </div>

                    {/* 4 & 5. Giới hạn buổi tập: Bậc cường độ HOẶC Chọn từng loại buổi */}
                    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 bg-surface-muted/20">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                            <p className="text-sm font-semibold text-fg">
                                {t("suspensions.panel.modeSelect")}
                            </p>
                            <SegmentedControl<"tier" | "custom">
                                label={t("suspensions.panel.modeSelect")}
                                value={mode}
                                onChange={(val) => setMode(val)}
                                options={[
                                    { value: "tier", label: t("suspensions.panel.modeTier") },
                                    { value: "custom", label: t("suspensions.panel.modeCustom") },
                                ]}
                            />
                        </div>

                        {mode === "tier" ? (
                            <div className="flex flex-col gap-2 pt-1">
                                <p className="text-xs font-medium text-fg-muted">
                                    {t("suspensions.panel.maxAllowedTier")}
                                </p>
                                <IntensityLadder
                                    maxAllowedTier={maxTier}
                                    size="lg"
                                    interactive
                                    value={maxTier}
                                    onChange={(newTier) => setMaxTier(newTier)}
                                    locale={locale}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 pt-1">
                                <p className="text-xs font-medium text-fg-muted">
                                    {t("suspensions.panel.customSessionTypesToggle")}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {SESSION_TYPES.map((type: SessionType) => {
                                        const isChecked = customBlockedTypes.includes(type);
                                        const label = trainingTypeLabel(
                                            translator,
                                            type.toLowerCase() as TrainingType,
                                        );
                                        const checkboxId = `blocked-type-${type}`;
                                        return (
                                            <label
                                                key={type}
                                                htmlFor={checkboxId}
                                                className={cn(
                                                    "flex items-center gap-2 rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors",
                                                    isChecked
                                                        ? "border-primary bg-primary/5 text-fg"
                                                        : "border-border bg-surface text-fg-muted hover:border-border-hover hover:text-fg",
                                                )}
                                            >
                                                <input
                                                    id={checkboxId}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setCustomBlockedTypes((prev) => [
                                                                ...prev,
                                                                type,
                                                            ]);
                                                        } else {
                                                            setCustomBlockedTypes((prev) =>
                                                                prev.filter((item) => item !== type),
                                                            );
                                                        }
                                                    }}
                                                    className="size-4 rounded border-control-border text-primary focus:ring-primary"
                                                />
                                                <TrainingTypeIcon
                                                    type={type.toLowerCase() as TrainingType}
                                                    locale={locale}
                                                    className="size-3.5 shrink-0"
                                                />
                                                <span className="truncate">{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {formErrors.blockedSessionTypes && (
                                    <FormMessage status="error" message={formErrors.blockedSessionTypes} />
                                )}
                            </div>
                        )}
                        {formErrors.maxTier && <FormMessage status="error" message={formErrors.maxTier} />}
                    </div>

                    {/* 6. Cần xác nhận mới được tập lại */}
                    <div className="rounded-xl border border-border p-4 bg-surface-muted/20">
                        <Switch
                            id="requires-clearance-switch"
                            label={t("suspensions.panel.requiresClearance")}
                            checked={requiresClearance}
                            disabled={isClearanceLocked || isPending}
                            onChange={(e) => setRequiresClearance(e.target.checked)}
                            description={
                                isKoOrTko
                                    ? t("suspensions.panel.koLockedNotice")
                                    : isDqOrRest
                                      ? t("suspensions.panel.dqLockedNotice")
                                      : undefined
                            }
                        />
                    </div>

                    {/* Dòng cảnh báo trước hệ quả */}
                    <p className="text-xs leading-relaxed text-fg-muted bg-surface-muted/30 border border-border/40 rounded-lg p-3">
                        {t("suspensions.panel.sideEffectsNotice")}
                    </p>

                    {/* Lỗi chung (nếu có) */}
                    {generalError && (
                        <FormMessage status="error" message={generalError} />
                    )}

                    {/* Nút lưu */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleClose}
                            disabled={isPending}
                        >
                            {t("suspensions.panel.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={isPending}
                            disabled={isPending}
                        >
                            {t("suspensions.panel.submit")}
                        </Button>
                    </div>
                </form>
            )}
        </Dialog>
    );
}
