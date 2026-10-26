import { Circle, CircleCheck, CircleDot, CircleHelp, Hourglass, ShieldAlert, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { CornerTag } from "@/components/ui/corner-tag";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import { JOURNEY_STATUS_LABELS, journeyOwnerLabel, type FighterJourney as Journey, type JourneyStep, type JourneyStepId } from "@/lib/domain/journey";
import { cn } from "@/lib/utils";

export interface FighterJourneyProps {
    journey: Journey;
    /** "full": every step with who moves it, for the fighter's Today hero. "compact": one strip for profile headers. */
    variant?: "full" | "compact";
    /** What it sits on: the Today hero's blue ground, or an ordinary surface. Full defaults to the hero, compact to a surface. */
    ground?: "hero" | "surface";
    /** Defaults to "Getting fight-ready" for the fighter and "Getting started" for staff. */
    title?: string;
    headingLevel?: 2 | 3;
    /** Leave out the next-action line when the page already says it (the Today hero's right half does). */
    hideNextAction?: boolean;
    /** A link or button for the next action, shown beside it. */
    action?: ReactNode;
    className?: string;
}

/** Glossary terms explained next to a step's label. */
const STEP_TERMS: Partial<Record<JourneyStepId, GlossaryTerm>> = { baseline: "baselineExam", clearance: "medicalClearance" };

/**
 * The fighter's journey as a stepper: each step, who moves it, and the one thing that happens next. An ordered list with
 * `aria-current="step"` on the step in progress; status is carried by icon and words, never colour alone.
 * Server or Client Component.
 */
export function FighterJourney({ journey, variant = "full", ground, title, headingLevel = 2, hideNextAction, action, className }: FighterJourneyProps) {
    const headingId = useId();
    const onHero = (ground ?? (variant === "full" ? "hero" : "surface")) === "hero";
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const heading = title ?? (journey.viewer === "fighter" ? "Getting fight-ready" : "Getting started");
    const total = journey.steps.length;
    const next = !hideNextAction && journey.active ? <NextAction step={journey.active} journey={journey} onHero={onHero} action={action} /> : null;

    if (variant === "compact") {
        return (
            <section
                aria-labelledby={headingId}
                className={cn(
                    "@container flex min-w-0 flex-col gap-3",
                    !onHero && "rounded-xl border border-border bg-surface px-5 py-4 shadow-card",
                    className,
                )}
            >
                <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:gap-6">
                    <Heading
                        id={headingId}
                        className={cn("shrink-0 font-display text-[16px] font-bold tracking-[0.06em] uppercase", onHero ? "text-white" : "text-fg")}
                    >
                        {heading}{" "}
                        <span className={onHero ? "text-white/80" : "text-fg-muted"}>
                            <span aria-hidden>
                                {journey.doneCount}/{total}
                            </span>
                            <span className="sr-only">
                                , {journey.doneCount} of {total} steps done
                            </span>
                        </span>
                    </Heading>
                    <ol className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                        {journey.steps.map((step) => (
                            <li key={step.id} aria-current={isActive(step) ? "step" : undefined} className="flex items-center gap-1.5">
                                <StatusIcon step={step} onHero={onHero} size="sm" />
                                <span className="sr-only">{JOURNEY_STATUS_LABELS[step.status]}: </span>
                                <span className={labelClass(step, onHero)}>{step.label}</span>
                            </li>
                        ))}
                    </ol>
                </div>
                {next}
            </section>
        );
    }

    return (
        <section aria-labelledby={headingId} className={cn("@container flex min-w-0 flex-col gap-4", className)}>
            <div className="flex flex-col gap-2">
                <CornerTag tone={onHero ? "stage" : "neutral"}>
                    {journey.doneCount} of {total} done
                </CornerTag>
                <Heading
                    id={headingId}
                    className={cn("font-display text-[30px] leading-[1.05] font-extrabold text-balance italic sm:text-[34px]", onHero ? "text-white" : "text-fg")}
                >
                    {heading}
                </Heading>
            </div>
            <ol className="grid grid-cols-1 gap-3 @md:grid-cols-3 @md:gap-x-3 @md:gap-y-4 @xl:grid-cols-6">
                {journey.steps.map((step, index) => (
                    <FullStep key={step.id} step={step} journey={journey} onHero={onHero} last={index === total - 1} />
                ))}
            </ol>
            {next}
        </section>
    );
}

function FullStep({ step, journey, onHero, last }: { step: JourneyStep; journey: Journey; onHero: boolean; last: boolean }) {
    const term = STEP_TERMS[step.id];
    return (
        <li aria-current={isActive(step) ? "step" : undefined} className="flex min-w-0 items-start gap-3 @md:flex-col @md:items-stretch @md:gap-2">
            <span className="flex items-center gap-2">
                <StatusIcon step={step} onHero={onHero} size="md" />
                {!last && <span aria-hidden className={cn("hidden h-px flex-1 @xl:block", onHero ? "bg-white/35" : "bg-border-strong")} />}
            </span>
            <span className="min-w-0">
                <span className="sr-only">{JOURNEY_STATUS_LABELS[step.status]}: </span>
                <span className={cn("flex items-center gap-0.5 text-[13px] leading-snug", labelClass(step, onHero))}>
                    {step.label}
                    {term && <TermHint term={term} className={onHero ? "text-white/80 hover:text-white" : undefined} />}
                </span>
                <span className={cn("mt-0.5 block text-[12px] leading-snug break-words", subClass(step, onHero))}>{stepSubline(step, journey)}</span>
            </span>
        </li>
    );
}

function isActive(step: JourneyStep): boolean {
    return step.status === "current" || step.status === "waiting";
}

/** Under each step's label: what it came to once done, who it's with while in progress, who does it later. */
function stepSubline(step: JourneyStep, journey: Journey): string {
    switch (step.status) {
        case "done":
        case "unknown":
            return step.detail;
        case "current":
            return "Your move";
        case "waiting":
            return `With ${step.person && step.id !== "doctor" ? step.person : journeyOwnerLabel(step.owner, journey.viewer)}`;
        case "upcoming":
            return step.person && step.id !== "doctor" ? step.person : journeyOwnerLabel(step.owner, journey.viewer);
    }
}

function NextAction({ step, journey, onHero, action }: { step: JourneyStep; journey: Journey; onHero: boolean; action?: ReactNode }) {
    const owner = step.status === "current" ? null : journeyOwnerLabel(step.owner, journey.viewer);
    return (
        <div className={cn("flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between", onHero ? "border-white/20" : "border-border")}>
            <p className={cn("flex min-w-0 items-start gap-1.5 text-[13px] text-pretty", onHero ? "text-white/80" : "text-fg-muted")}>
                {step.attention && <ShieldAlert aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", onHero ? "text-white" : "text-danger-fg")} />}
                <span>
                    <span className="sr-only">Next: </span>
                    <span className={cn("font-medium", onHero ? "text-white" : "text-fg")}>{step.detail}</span>
                    {owner && <span> · {owner}</span>}
                </span>
            </p>
            {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
    );
}

/** Status icons; a blocked step in progress shows a shield instead of its usual mark. */
const STATUS_ICONS: Record<JourneyStep["status"] | "blocked", LucideIcon> = {
    done: CircleCheck,
    unknown: CircleHelp,
    upcoming: Circle,
    current: CircleDot,
    waiting: Hourglass,
    blocked: ShieldAlert,
};

const iconKey = (step: JourneyStep): keyof typeof STATUS_ICONS => (isActive(step) && step.attention ? "blocked" : step.status);

function StatusIcon({ step, onHero, size }: { step: JourneyStep; onHero: boolean; size: "sm" | "md" }) {
    const Icon = STATUS_ICONS[iconKey(step)];
    const glyph = size === "sm" ? "size-4" : "size-[18px]";
    if (isActive(step)) {
        return (
            <span
                aria-hidden
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-full",
                    size === "sm" ? "size-5" : "size-7",
                    onHero ? "bg-white text-hero-bg" : step.attention ? "bg-danger-soft text-danger-fg ring-1 ring-danger-border ring-inset" : "bg-primary text-primary-fg",
                )}
            >
                <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.25} />
            </span>
        );
    }
    const tone =
        step.status === "done" ? (onHero ? "text-white" : "text-success-fg") : onHero ? "text-white/80" : "text-fg-subtle";
    return (
        <span aria-hidden className={cn("flex shrink-0 items-center justify-center", size === "md" && "size-7")}>
            <Icon className={cn(glyph, tone)} strokeWidth={2} />
        </span>
    );
}

function labelClass(step: JourneyStep, onHero: boolean): string {
    if (isActive(step)) return cn("font-semibold", onHero ? "text-white" : "text-fg");
    if (step.status === "done") return onHero ? "font-medium text-white" : "text-fg-muted";
    return onHero ? "text-white/80" : "text-fg-muted";
}

function subClass(step: JourneyStep, onHero: boolean): string {
    if (isActive(step)) return onHero ? "text-white" : "text-fg";
    return onHero ? "text-white/80" : "text-fg-subtle";
}
