import { cn, initials } from "@/lib/utils";

const SIZES = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
    xl: "size-20 text-2xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Initials avatar. Fighters use the octagon shape — the product's signature mark for
 * athletes — while staff use circles, so people are recognisable at a glance.
 */
export function Avatar({
    name,
    size = "md",
    shape = "circle",
    className,
}: {
    name: string;
    size?: AvatarSize;
    shape?: "circle" | "octagon";
    className?: string;
}) {
    if (shape === "octagon") {
        return (
            <span aria-hidden className={cn("octagon relative inline-flex shrink-0 bg-nav-accent/70 p-[1.5px]", SIZES[size], className)}>
                <span className="octagon flex size-full items-center justify-center bg-nav-bg font-semibold tracking-tight text-white">
                    {initials(name)}
                </span>
            </span>
        );
    }
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-hover font-semibold tracking-tight text-fg-muted ring-1 ring-border",
                SIZES[size],
                className,
            )}
        >
            {initials(name)}
        </span>
    );
}
