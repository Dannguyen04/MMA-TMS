"use client";

import { ChevronDown, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import { signOut } from "@/lib/actions/auth";
import type { ThemePreference } from "@/lib/auth/constants";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { ThemeSwitcher } from "./theme-switcher";

export interface ShellUser {
    name: string;
    email: string;
    title: string;
    role: Role;
}

export function UserMenu({ user, theme }: { user: ShellUser; theme: ThemePreference }) {
    return (
        <Popover
            label="Account"
            className="w-72"
            trigger={(props) => (
                <button
                    {...props}
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-lg pr-1.5 pl-1 text-left transition-colors hover:bg-surface-hover"
                    aria-label={`Account menu for ${user.name}`}
                >
                    <Avatar name={user.name} size="sm" shape={user.role === "fighter" ? "octagon" : "circle"} />
                    <span className="hidden max-w-36 truncate text-sm font-medium text-fg md:block">{user.name}</span>
                    <ChevronDown aria-hidden className="hidden size-4 text-fg-subtle md:block" />
                </button>
            )}
        >
            {(close) => (
                <div>
                    <div className="flex items-center gap-3 border-b border-border p-4">
                        <Avatar name={user.name} size="md" shape={user.role === "fighter" ? "octagon" : "circle"} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
                            <p className="truncate text-[13px] text-fg-muted">{user.email}</p>
                            <p className="mt-0.5 text-xs text-fg-subtle">
                                {ROLE_LABELS[user.role]} · {user.title}
                            </p>
                        </div>
                    </div>
                    <div className="border-b border-border p-3">
                        <p className="mb-2 text-xs font-medium text-fg-muted">Appearance</p>
                        <ThemeSwitcher initial={theme} />
                    </div>
                    <ul className="p-1.5">
                        <li>
                            <Link href={routes.profile} onClick={close} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-muted">
                                <UserRound aria-hidden className="size-4 text-fg-subtle" />
                                Profile
                            </Link>
                        </li>
                        <li>
                            <Link href={routes.settings} onClick={close} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-muted">
                                <SlidersHorizontal aria-hidden className="size-4 text-fg-subtle" />
                                Preferences
                            </Link>
                        </li>
                        <li>
                            <form action={signOut}>
                                <button
                                    type="submit"
                                    className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-danger-fg hover:bg-danger-soft"
                                >
                                    <LogOut aria-hidden className="size-4" />
                                    Sign out
                                </button>
                            </form>
                        </li>
                    </ul>
                </div>
            )}
        </Popover>
    );
}
