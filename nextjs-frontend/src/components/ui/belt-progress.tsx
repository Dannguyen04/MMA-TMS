import { cn } from "@/lib/utils";

export type BeltColor = "white" | "blue" | "purple" | "brown" | "black";

const BELT_CLASS: Record<BeltColor, string> = {
    white: "bg-belt-white ring-1 ring-inset ring-border-strong",
    blue: "bg-belt-blue",
    purple: "bg-belt-purple",
    brown: "bg-belt-brown",
    black: "bg-belt-black",
};

export interface BeltProgressProps {
    /** Stripes earned so far. */
    stripes: number;
    /** Stripes on a full rank bar; a jiu-jitsu belt takes four before the next colour. */
    max?: number;
    belt?: BeltColor;
    /** Read out instead of the drawing, e.g. "2 of 4 goals on track". */
    label: string;
    className?: string;
}

/**
 * Progress drawn as a jiu-jitsu belt: white tape stripes fill the rank bar near the tip. The black belt's
 * rank bar is red, as on the mat. Colour never carries a status here; pair "at risk" with a badge.
 */
export function BeltProgress({ stripes, max = 4, belt = "blue", label, className }: BeltProgressProps) {
    const earned = Math.max(0, Math.min(max, Math.round(stripes)));
    return (
        <span role="img" aria-label={label} className={cn("relative block h-3 w-full rounded-[2px] shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]", BELT_CLASS[belt], className)}>
            <span
                aria-hidden
                className={cn("absolute inset-y-0 right-[12%] flex w-[38%] justify-center gap-1 px-1.5", belt === "black" ? "bg-corner-red" : "bg-belt-black")}
            >
                {Array.from({ length: max }, (_, index) => (
                    <span key={index} className={cn("w-[3px]", index < earned ? "bg-white" : "bg-white/15")} />
                ))}
            </span>
        </span>
    );
}
