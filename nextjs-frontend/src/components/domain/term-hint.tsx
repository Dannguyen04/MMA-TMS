"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryTerm } from "@/lib/domain/glossary";
import { cn } from "@/lib/utils";

function Definition({ term }: { term: GlossaryTerm }) {
    const entry = GLOSSARY[term];
    return (
        <>
            <span className="font-semibold">{entry.term}:</span> <span className="font-normal">{entry.definition}</span>
        </>
    );
}

/**
 * A small info button that explains a term from the glossary on hover, keyboard focus or tap. Put it in a
 * Field's `info` slot (never inside a `<label>`), or next to a heading.
 */
export function TermHint({ term, side = "top", className }: { term: GlossaryTerm; side?: "top" | "bottom"; className?: string }) {
    return (
        <Tooltip content={<Definition term={term} />} side={side}>
            <button
                type="button"
                aria-label={`What is ${GLOSSARY[term].term}?`}
                className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-fg-subtle transition-colors hover:text-fg",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    className,
                )}
            >
                <Info aria-hidden className="size-3.5" />
            </button>
        </Tooltip>
    );
}

/** Inline text with a dotted underline that explains a glossary term, for terms inside sentences, badges or table headers. */
export function Term({ term, children, side = "top", className }: { term: GlossaryTerm; children?: ReactNode; side?: "top" | "bottom"; className?: string }) {
    return (
        <Tooltip content={<Definition term={term} />} side={side}>
            <button
                type="button"
                className={cn(
                    "cursor-help rounded-sm underline decoration-fg-subtle decoration-dotted underline-offset-4 hover:decoration-fg",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    className,
                )}
            >
                {children ?? GLOSSARY[term].term}
            </button>
        </Tooltip>
    );
}
