"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickFillProps {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    /** Whether there is anything left to fill. Without it the button goes away, but the note of the last fill stays. */
    available: boolean;
    /** What the last click filled, shown (and announced) so the doctor sees exactly what changed. */
    note?: string;
    className?: string;
}

/**
 * A one-click fill the doctor chooses: never applied on load, it fills only what is still blank and then says what it
 * filled. The note's live region is rendered before it has text, so screen readers announce the change.
 */
export function QuickFill({ label, icon: Icon, onClick, available, note, className }: QuickFillProps) {
    if (!available && !note) return null;
    return (
        <div className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
            {available && (
                <Button variant="secondary" size="sm" onClick={onClick}>
                    <Icon aria-hidden />
                    {label}
                </Button>
            )}
            <p aria-live="polite" className="text-[13px] text-pretty text-fg-muted">
                {note}
            </p>
        </div>
    );
}
