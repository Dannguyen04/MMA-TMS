"use client";

import { Ban, CircleCheck, CloudOff, ShieldQuestion, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Checkbox } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { clearanceConflictMessage, type ClearanceConflict } from "@/lib/domain/clearance-rules";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export type ClearanceCheckStatus = "idle" | "ready" | "error";

export interface ClearanceCheckPanelProps {
    /** Result of the most recent completed check. */
    status: ClearanceCheckStatus;
    /** A newer check is running; the last result stays visible meanwhile. */
    pending: boolean;
    conflicts: ClearanceConflict[];
    fighterName?: string;
    acknowledged: boolean;
    onAcknowledgedChange: (value: boolean) => void;
    className?: string;
    acknowledgeLabel?: string;
}

function ConflictList({ conflicts, tone, t, locale }: { conflicts: ClearanceConflict[]; tone: "danger" | "warning"; t: Translator; locale: Locale }) {
    return (
        <ul className="flex flex-col gap-2">
            {conflicts.map((conflict, index) => {
                const message = clearanceConflictMessage(t, conflict, locale);
                return (
                    <li key={index}>
                        <InlineNote icon={tone === "danger" ? Ban : TriangleAlert} tone={tone}>
                            <span className="sr-only">{tone === "danger" ? t("training.clearanceCheck.blockedPrefix") : t("training.clearanceCheck.warningPrefix")}</span>
                            {message}
                        </InlineNote>
                    </li>
                );
            })}
        </ul>
    );
}

function announcement(t: Translator, status: ClearanceCheckStatus, blocks: number, warnings: number): string {
    if (status === "error") return t("training.clearanceCheck.announcement.error");
    if (status !== "ready") return "";
    if (blocks + warnings === 0) return t("training.clearanceCheck.announcement.noConflicts");
    const parts = [
        blocks > 0 ? (blocks === 1 ? `1 ${t("training.clearanceCheck.announcement.blockingConflict")}` : `${blocks} ${t("training.clearanceCheck.announcement.blockingConflict")}s`) : null,
        warnings > 0 ? (warnings === 1 ? `1 ${t("training.clearanceCheck.announcement.warning")}` : `${warnings} ${t("training.clearanceCheck.announcement.warning")}s`) : null,
    ];
    return t("training.clearanceCheck.announcement.result", { parts: parts.filter(Boolean).join(t("training.clearanceCheck.announcement.and")) });
}

/** Live result of checking the planned session against the fighter's Medical Clearance. */
export function ClearanceCheckPanel({ status, pending, conflicts, fighterName, acknowledged, onAcknowledgedChange, className, acknowledgeLabel }: ClearanceCheckPanelProps) {
    const t = useT();
    const locale = useLocale();
    const blocks = conflicts.filter((c) => c.severity === "block");
    const warnings = conflicts.filter((c) => c.severity === "warn");

    let body: ReactNode;
    if (status === "idle" && pending) {
        body = <p className="text-[13px] text-fg-muted">{t("training.clearanceCheck.checking")}</p>;
    } else if (status === "idle") {
        body = <InlineNote icon={ShieldQuestion}>{t("training.clearanceCheck.idle")}</InlineNote>;
    } else if (status === "error") {
        body = <InlineNote icon={CloudOff}>{t("training.clearanceCheck.error")}</InlineNote>;
    } else if (conflicts.length === 0) {
        body = (
            <InlineNote icon={CircleCheck} tone="success">
                {t("training.clearanceCheck.noConflicts", { name: fighterName ? `${fighterName}'s` : t("training.clearanceCheck.the") })}
            </InlineNote>
        );
    } else {
        body = (
            <div className="flex flex-col gap-3">
                {blocks.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-semibold text-danger-fg">{t("training.clearanceCheck.blockedTitle")}</p>
                        <ConflictList conflicts={blocks} tone="danger" t={t} locale={locale} />
                        <p className="text-[13px] text-fg-muted">
                            {t("training.clearanceCheck.blockedDesc")}
                        </p>
                    </div>
                )}
                {warnings.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-semibold text-warning-fg">{t("training.clearanceCheck.warningTitle")}</p>
                        <ConflictList conflicts={warnings} tone="warning" t={t} locale={locale} />
                        {blocks.length === 0 && (
                            <Checkbox
                                id="acknowledgeWarnings"
                                name="acknowledgeWarnings"
                                checked={acknowledged}
                                onChange={(event) => onAcknowledgedChange(event.target.checked)}
                                label={acknowledgeLabel ?? t("training.clearanceCheck.acknowledgeLabel")}
                                description={t("training.clearanceCheck.acknowledgeDesc")}
                                className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5"
                            />
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <section aria-labelledby="clearance-check-title" className={cn("rounded-xl border border-border bg-surface p-4 shadow-card", className)}>
            <div className="flex items-center justify-between gap-2">
                <h2 id="clearance-check-title" className="text-[15px] font-semibold text-fg">
                    {t("training.clearanceCheck.title")}
                </h2>
                {pending && <Spinner className="text-fg-subtle" label={t("training.clearanceCheck.spinnerLabel")} />}
            </div>
            <div className={cn("mt-2 transition-opacity", pending && status !== "idle" && "opacity-60")}>{body}</div>
            <p aria-live="polite" className="sr-only">
                {pending ? "" : announcement(t, status, blocks.length, warnings.length)}
            </p>
        </section>
    );
}
