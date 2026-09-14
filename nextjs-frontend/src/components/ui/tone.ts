/** Semantic tones shared by badges, alerts, progress bars and icons. */
export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai";

export const TONE_SOFT: Record<Tone, string> = {
    neutral: "bg-neutral-soft text-neutral-fg ring-neutral-border",
    primary: "bg-primary-soft text-primary-soft-fg ring-primary/25",
    success: "bg-success-soft text-success-fg ring-success-border",
    warning: "bg-warning-soft text-warning-fg ring-warning-border",
    danger: "bg-danger-soft text-danger-fg ring-danger-border",
    info: "bg-info-soft text-info-fg ring-info-border",
    ai: "bg-ai-soft text-ai-fg ring-ai-border",
};

export const TONE_SOLID: Record<Tone, string> = {
    neutral: "bg-neutral-solid text-white ring-transparent",
    primary: "bg-primary text-primary-fg ring-transparent",
    success: "bg-success-solid text-white ring-transparent",
    warning: "bg-warning-solid text-warning-solid-fg ring-transparent",
    danger: "bg-danger-solid text-white ring-transparent",
    info: "bg-info-solid text-white ring-transparent",
    ai: "bg-ai-solid text-white ring-transparent",
};

/** Text color for icons or inline emphasis in a tone. */
export const TONE_TEXT: Record<Tone, string> = {
    neutral: "text-neutral-fg",
    primary: "text-primary-soft-fg",
    success: "text-success-fg",
    warning: "text-warning-fg",
    danger: "text-danger-fg",
    info: "text-info-fg",
    ai: "text-ai-fg",
};

/** Fill color for bars, dots and meters in a tone. */
export const TONE_FILL: Record<Tone, string> = {
    neutral: "bg-neutral-solid",
    primary: "bg-primary",
    success: "bg-success-solid",
    warning: "bg-warning-solid",
    danger: "bg-danger-solid",
    info: "bg-info-solid",
    ai: "bg-ai-solid",
};
