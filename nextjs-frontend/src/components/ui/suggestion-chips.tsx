"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

export { appendSuggestion } from "./suggestion-text";

export interface Suggestion {
    label: string;
    /** What picking the chip writes; defaults to the label. */
    value?: string;
}

export interface SuggestionChipsProps {
    /** Short caption read before the chips, e.g. "Common reasons". */
    label: string;
    suggestions: Suggestion[];
    onPick(value: string, suggestion: Suggestion): void;
    disabled?: boolean;
    className?: string;
}

/**
 * One-tap suggestions that fill or extend a field, so people pick instead of typing. Picking never submits:
 * the value lands in the field for the person to check and edit.
 */
export function SuggestionChips({ label, suggestions, onPick, disabled, className }: SuggestionChipsProps) {
    if (suggestions.length === 0) return null;
    return (
        <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
            <span aria-hidden className="mr-0.5 text-xs text-fg-subtle">
                {label}
            </span>
            {suggestions.map((suggestion) => (
                <button
                    key={suggestion.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(suggestion.value ?? suggestion.label, suggestion)}
                    className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-fg-muted transition-colors",
                        "hover:border-border-strong hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    )}
                >
                    <Plus aria-hidden className="size-3" />
                    {suggestion.label}
                </button>
            ))}
        </div>
    );
}
