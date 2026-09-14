import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("rounded-xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export interface CardHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Right-aligned actions (links, buttons, filters). */
    action?: ReactNode;
    icon?: ReactNode;
    /** Heading level; defaults to h2 because cards usually sit under the page h1. */
    as?: ElementType;
    className?: string;
}

export function CardHeader({ title, description, action, icon, as: Heading = "h2", className }: CardHeaderProps) {
    return (
        <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
            <div className="flex min-w-0 items-start gap-3">
                {icon && (
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted [&_svg]:size-4">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <Heading className="text-[15px] leading-6 font-semibold text-fg">{title}</Heading>
                    {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
                </div>
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm", className)}
            {...props}
        />
    );
}
