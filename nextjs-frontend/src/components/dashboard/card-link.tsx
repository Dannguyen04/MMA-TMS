import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CardLinkProps {
    href: string;
    children: ReactNode;
    /** Extra words for screen readers when the visible label is generic ("View all"). */
    srContext?: string;
    className?: string;
}

/** Quiet text link for card headers and footers ("All sessions", "Details"). */
export function CardLink({ href, children, srContext, className }: CardLinkProps) {
    return (
        <Link
            href={href}
            className={cn(
                "inline-flex h-8 items-center gap-0.5 rounded-md px-2 text-[13px] font-medium whitespace-nowrap text-primary-soft-fg hover:bg-surface-hover",
                className,
            )}
        >
            {children}
            {srContext && <span className="sr-only"> {srContext}</span>}
            <ChevronRight aria-hidden className="size-3.5" />
        </Link>
    );
}
