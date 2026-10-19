"use client";

import { usePathname } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { TabNav } from "@/components/ui/tabs";
import { navLabel } from "@/lib/i18n/translate";
import type { Role } from "@/lib/domain/types";
import { hubTabsFor } from "./navigation";

/** Route tabs for the hub the current page belongs to. Rendered by the shell, so they stay put while a tab loads. */
export function HubTabs({ role }: { role: Role }) {
    const pathname = usePathname();
    const hub = hubTabsFor(role, pathname);
    const t = useT();
    if (!hub) return null;
    // The label must not contain "main" or "primary": those name the sidebar and the mobile bar.
    return <TabNav label={t("shell.hubSections", { hub: navLabel(t, hub.label) })} items={hub.tabs.map((tab) => ({ ...tab, label: navLabel(t, tab.label), exact: true }))} className="mb-6" />;
}
