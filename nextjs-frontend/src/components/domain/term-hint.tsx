"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryEntry, type GlossaryTerm } from "@/lib/domain/glossary";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, hasMessage } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/**
 * The glossary entry in the viewer's language. Terms with `screens.shared.glossary.<term>.*` keys are translated;
 * the rest, and every term when `locale` is omitted, stay as the English glossary has them.
 */
function glossaryEntry(term: GlossaryTerm, locale?: Locale): GlossaryEntry {
    const entry = GLOSSARY[term];
    const termKey = `screens.shared.glossary.${term}.term`;
    const definitionKey = `screens.shared.glossary.${term}.definition`;
    if (!locale || !hasMessage(termKey) || !hasMessage(definitionKey)) return entry;
    const t = createTranslator(locale);
    return { term: t(termKey), definition: t(definitionKey) };
}

function Definition({ term, locale }: { term: GlossaryTerm; locale?: Locale }) {
    const entry = glossaryEntry(term, locale);
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
export function TermHint({ term, side = "top", className, locale }: { term: GlossaryTerm; side?: "top" | "bottom"; className?: string; locale?: Locale }) {
    const name = glossaryEntry(term, locale).term;
    return (
        <Tooltip content={<Definition term={term} locale={locale} />} side={side}>
            <button
                type="button"
                aria-label={locale ? createTranslator(locale)("screens.shared.termHint", { term: name }) : `What is ${name}?`}
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
export function Term({
    term,
    children,
    side = "top",
    className,
    locale,
}: {
    term: GlossaryTerm;
    children?: ReactNode;
    side?: "top" | "bottom";
    className?: string;
    /** The viewer's language for the definition; English when omitted. */
    locale?: Locale;
}) {
    return (
        <Tooltip content={<Definition term={term} locale={locale} />} side={side}>
            <button
                type="button"
                className={cn(
                    "cursor-help rounded-sm underline decoration-fg-subtle decoration-dotted underline-offset-4 hover:decoration-fg",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    className,
                )}
            >
                {children ?? glossaryEntry(term, locale).term}
            </button>
        </Tooltip>
    );
}
