import Link from "next/link";

import { Avatar, type AvatarSize } from "@/components/ui/avatar";
import type { User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface UserIdentityProps {
    user: Pick<User, "name" | "email" | "role">;
    href?: string;
    size?: AvatarSize;
    /** Marks the signed-in administrator's own account. */
    isSelf?: boolean;
    className?: string;
}

/** Avatar with name and email. Fighters use the octagon avatar, staff use circles. */
export function UserIdentity({ user, href, size = "sm", isSelf = false, className }: UserIdentityProps) {
    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <Avatar name={user.name} size={size} shape={user.role === "fighter" ? "octagon" : "circle"} />
            <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
                    {href ? (
                        <Link href={href} className="truncate rounded-sm hover:underline">
                            {user.name}
                        </Link>
                    ) : (
                        <span className="truncate">{user.name}</span>
                    )}
                    {isSelf && <span className="shrink-0 rounded bg-surface-hover px-1 text-[11px] font-medium text-fg-muted">You</span>}
                </p>
                <p className="truncate text-[13px] text-fg-muted">{user.email}</p>
            </div>
        </div>
    );
}
