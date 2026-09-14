"use client";

import { Ban, CircleCheck, CloudOff, ShieldQuestion, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Checkbox } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import type { ClearanceConflict } from "@/lib/domain/rules";
import { pluralize } from "@/lib/format";
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
}

function ConflictList({ conflicts, tone }: { conflicts: ClearanceConflict[]; tone: "danger" | "warning" }) {
    return (
        <ul className="flex flex-col gap-2">
            {conflicts.map((conflict) => (
                <li key={conflict.message}>
                    <InlineNote icon={tone === "danger" ? Ban : TriangleAlert} tone={tone}>
                        <span className="sr-only">{tone === "danger" ? "Blocked: " : "Warning: "}</span>
                        {conflict.message}
                    </InlineNote>
                </li>
            ))}
        </ul>
    );
}

function announcement(status: ClearanceCheckStatus, blocks: number, warnings: number): string {
    if (status === "error") return "The clearance check isn't available right now.";
    if (status !== "ready") return "";
    if (blocks + warnings === 0) return "Clearance check: no conflicts.";
    const parts = [blocks > 0 ? pluralize(blocks, "blocking conflict") : null, warnings > 0 ? pluralize(warnings, "warning") : null];
    return `Clearance check: ${parts.filter(Boolean).join(" and ")}.`;
}

/** Live result of checking the planned session against the fighter's Medical Clearance. */
export function ClearanceCheckPanel({ status, pending, conflicts, fighterName, acknowledged, onAcknowledgedChange, className }: ClearanceCheckPanelProps) {
    const blocks = conflicts.filter((c) => c.severity === "block");
    const warnings = conflicts.filter((c) => c.severity === "warn");

    let body: ReactNode;
    if (status === "idle" && pending) {
        body = <p className="text-[13px] text-fg-muted">Checking Medical Clearance…</p>;
    } else if (status === "idle") {
        body = <InlineNote icon={ShieldQuestion}>Choose a fighter to check this session against their Medical Clearance.</InlineNote>;
    } else if (status === "error") {
        body = <InlineNote icon={CloudOff}>The clearance check isn&apos;t available right now. It runs again when you save.</InlineNote>;
    } else if (conflicts.length === 0) {
        body = (
            <InlineNote icon={CircleCheck} tone="success">
                No conflicts with {fighterName ? `${fighterName}'s` : "the"} Medical Clearance.
            </InlineNote>
        );
    } else {
        body = (
            <div className="flex flex-col gap-3">
                {blocks.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-semibold text-danger-fg">Can&apos;t be scheduled as planned</p>
                        <ConflictList conflicts={blocks} tone="danger" />
                        <p className="text-[13px] text-fg-muted">
                            Blocking conflicts can&apos;t be overridden — only the sports doctor can change a Medical Clearance. Change the training type,
                            intensity or date to continue.
                        </p>
                    </div>
                )}
                {warnings.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-semibold text-warning-fg">Needs your judgement</p>
                        <ConflictList conflicts={warnings} tone="warning" />
                        {blocks.length === 0 && (
                            <Checkbox
                                id="acknowledgeWarnings"
                                name="acknowledgeWarnings"
                                checked={acknowledged}
                                onChange={(event) => onAcknowledgedChange(event.target.checked)}
                                label="I've reviewed these warnings"
                                description="The fighter's doctors are notified that the session was scheduled with warnings."
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
                    Clearance check
                </h2>
                {pending && <Spinner className="text-fg-subtle" label="Checking Medical Clearance" />}
            </div>
            <div className={cn("mt-2 transition-opacity", pending && status !== "idle" && "opacity-60")}>{body}</div>
            <p aria-live="polite" className="sr-only">
                {pending ? "" : announcement(status, blocks.length, warnings.length)}
            </p>
        </section>
    );
}
