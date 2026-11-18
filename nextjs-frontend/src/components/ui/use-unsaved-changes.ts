"use client";

import { useEffect } from "react";

import { useT } from "@/components/i18n/locale-provider";

/**
 * While `active`, leaving the page asks first: closing or reloading the tab gets the browser's own prompt, and a
 * click on an in-app link asks with a confirm. Programmatic navigation (a redirect after saving) is not stopped.
 */
export function useUnsavedChanges(active: boolean): void {
    const t = useT();
    const question = t("ux.unsaved.confirm");

    useEffect(() => {
        if (!active) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        const click = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = (event.target as Element | null)?.closest?.("a[href]");
            if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
            if (!window.confirm(question)) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        window.addEventListener("beforeunload", beforeUnload);
        document.addEventListener("click", click, true);
        return () => {
            window.removeEventListener("beforeunload", beforeUnload);
            document.removeEventListener("click", click, true);
        };
    }, [active, question]);
}
