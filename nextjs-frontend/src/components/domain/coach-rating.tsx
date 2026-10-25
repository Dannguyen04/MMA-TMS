import { Star } from "lucide-react";
import type { CSSProperties } from "react";

import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/** Words for a coach rating, indexed by rating − 1. */
export const COACH_RATING_WORDS = ["Poor", "Needs work", "Solid", "Strong", "Excellent"] as const;

const MAX_RATING = COACH_RATING_WORDS.length;

export function coachRatingWord(rating: number): string {
    return COACH_RATING_WORDS[Math.min(Math.max(Math.round(rating), 1), MAX_RATING) - 1];
}

export interface CoachRatingProps {
    rating: number;
    max?: number;
    /** Dense variant for tables and lists: smaller stars and "4/5". */
    compact?: boolean;
    className?: string;
    locale?: Locale;
}

/** Read-only coach rating: one image of stars (a single CSS mask), with the value in words. */
export function CoachRating({ rating, max = MAX_RATING, compact = false, className, locale }: CoachRatingProps) {
    const t = locale ? createTranslator(locale) : undefined;
    const word = t ? t(`training.coachRating.${Math.min(Math.max(Math.round(rating), 1), 5)}` as any) : coachRatingWord(rating);
    const style = {
        "--rating-fill": `${(Math.min(Math.max(rating, 0), max) / max) * 100}%`,
        "--rating-max": max,
        "--rating-star": compact ? "0.75rem" : "1rem",
    } as CSSProperties;

    const label = compact ? `${rating}/${max}` : t ? t("training.coachRating.of", { rating, max, word }) : `${rating} of ${max} · ${word}`;

    return (
        <span className={cn("inline-flex items-center whitespace-nowrap", compact ? "gap-1.5" : "gap-2", className)}>
            <span role="img" aria-label={label} className="rating-stars" style={style} />
            <span aria-hidden className={cn("text-fg-muted tabular-nums", compact ? "text-xs" : "text-[13px]")}>
                {label}
            </span>
        </span>
    );
}

export interface CoachRatingInputProps {
    /** Base id for the error element. */
    id: string;
    name: string;
    legend: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
    required?: boolean;
    locale?: Locale;
}

/** 1–5 rating as native radios drawn as stars. Arrow keys change the value; the choice is also shown in words. */
export function CoachRatingInput({ id, name, legend, value, onChange, error, required = false, locale }: CoachRatingInputProps) {
    const t = locale ? createTranslator(locale) : undefined;
    const errorId = `${id}-error`;
    return (
        <fieldset
            role="radiogroup"
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            data-invalid={error ? "true" : undefined}
            className="flex min-w-0 flex-col gap-1.5"
        >
            <legend className="mb-1.5 text-sm font-medium text-fg">
                {legend}
                {required && (
                    <>
                        <span className="ml-0.5 text-danger-fg" aria-hidden>
                            *
                        </span>
                        <span className="sr-only">{locale === "vi" ? " (bắt buộc)" : " (required)"}</span>
                    </>
                )}
            </legend>
            <div className="flex flex-wrap items-center gap-3">
                <div className={cn("flex items-center gap-0.5 rounded-lg", error && "ring-1 ring-danger-solid")}>
                    {COACH_RATING_WORDS.map((wordEn, index) => {
                        const rating = index + 1;
                        const word = t ? t(`training.coachRating.${rating}` as any) : wordEn;
                        const label = t ? t("training.coachRating.of", { rating, max: MAX_RATING, word }) : `${rating} of ${MAX_RATING} · ${word}`;
                        return (
                            <label
                                key={rating}
                                className="flex size-9 cursor-pointer items-center justify-center rounded-md hover:bg-surface-hover has-focus-visible:outline-2 has-focus-visible:outline-ring"
                            >
                                <input
                                    type="radio"
                                    name={name}
                                    value={rating}
                                    checked={value === rating}
                                    onChange={() => onChange(rating)}
                                    required={required}
                                    aria-describedby={error ? errorId : undefined}
                                    className="sr-only"
                                />
                                <Star
                                    aria-hidden
                                    className={cn(
                                        "size-6 transition-colors",
                                        rating <= value ? "fill-warning-solid text-warning-solid" : "fill-transparent text-control-border",
                                    )}
                                />
                                <span className="sr-only">{label}</span>
                            </label>
                        );
                    })}
                </div>
                <p aria-hidden className="text-sm text-fg-muted">
                    {value > 0
                        ? t
                            ? t("training.coachRating.of", { rating: value, max: MAX_RATING, word: t(`training.coachRating.${value}` as any) })
                            : `${value} of ${MAX_RATING} · ${coachRatingWord(value)}`
                        : t
                        ? t("training.coachRating.notRated")
                        : "Not rated"}
                </p>
            </div>
            {error && (
                <p id={errorId} className="text-[13px] font-medium text-danger-fg">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
