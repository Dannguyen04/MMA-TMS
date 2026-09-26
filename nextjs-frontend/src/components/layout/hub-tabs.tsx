"use client";

import { usePathname } from "next/navigation";

import { TabNav } from "@/components/ui/tabs";
import type { Role } from "@/lib/domain/types";
import { hubTabsFor } from "./navigation";

/** Route tabs for the hub the current page belongs to. Rendered by the shell, so they stay put while a tab loads. */
export function HubTabs({ role }: { role: Role }) {
    const pathname = usePathname();
    const hub = hubTabsFor(role, pathname);
    if (!hub) return null;
    // The label must not contain "main" or "primary": those name the sidebar and the mobile bar.
    return <TabNav label={`${hub.label} sections`} items={hub.tabs.map((tab) => ({ ...tab, exact: true }))} className="mb-6" />;
}
