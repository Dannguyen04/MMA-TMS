"use client";

import { House, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

const AREA_HOME: Record<string, string> = {
    fighter: "/fighter/dashboard",
    coach: "/coach/dashboard",
    doctor: "/doctor/dashboard",
    admin: "/admin/dashboard",
};

/** The Today page of the area the viewer is in, read from the URL (an error boundary has no session). */
export function areaHome(pathname: string): string | null {
    return AREA_HOME[pathname.split("/")[1] ?? ""] ?? null;
}

/**
 * Body of an `error.tsx` boundary. `page` replaces the whole page under the app shell; `section` sits inside a
 * layout (a fighter's tabs, say) so the header and tabs stay usable. `retry` re-fetches and re-renders.
 */
export function RouteError({ error, retry, scope = "page" }: { error: Error & { digest?: string }; retry: () => void; scope?: "page" | "section" }) {
    const t = useT();
    const home = areaHome(usePathname() ?? "");

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            className={scope === "page" ? "mt-10" : "mt-2"}
            title={t(scope === "page" ? "ux.error.title" : "ux.error.sectionTitle")}
            description={
                <>
                    {t(scope === "page" ? "ux.error.description" : "ux.error.sectionDescription")}
                    {error.digest && <span className="mt-2 block font-mono text-xs text-fg-subtle">{t("ux.error.reference", { digest: error.digest })}</span>}
                </>
            }
            action={
                <>
                    <Button onClick={() => retry()}>
                        <RotateCcw aria-hidden />
                        {t("ux.error.retry")}
                    </Button>
                    {scope === "page" && home && (
                        <Link href={home} className={buttonClasses({ variant: "secondary" })}>
                            <House aria-hidden />
                            {t("ux.error.home")}
                        </Link>
                    )}
                </>
            }
        />
    );
}
