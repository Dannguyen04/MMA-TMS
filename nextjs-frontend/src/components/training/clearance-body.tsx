"use client";

import { useMemo } from "react";

import type { BodyMapHighlight } from "@/components/domain/body-map";
import { BodyMapAuto } from "@/components/fighter-3d/body/body-map-auto";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import type { BodyRegion } from "@/lib/domain/types";

/**
 * Where the planned session meets the doctor's restrictions, on the body: a region the session loads that the
 * clearance protects pulses red, other protected regions are amber, the rest of the session's load is blue. Only
 * clearance-level regions, never injury details (the coach's view).
 */
export function ClearanceBody({ blocked, loads }: { blocked: BodyRegion[]; loads: BodyRegion[] }) {
    const t = useT();
    const locale = useLocale();
    const highlights = useMemo<BodyMapHighlight[]>(() => {
        const protectedSet = new Set(blocked);
        const loaded = new Set(loads);
        const clash = [...protectedSet].filter((region) => loaded.has(region));
        return [
            ...clash.map((region) => ({ region, tone: "danger" as const, label: t("figure3d.clearance.clash") })),
            ...[...protectedSet].filter((region) => !loaded.has(region)).map((region) => ({ region, tone: "warning" as const, label: t("figure3d.clearance.protected") })),
            ...[...loaded].filter((region) => !protectedSet.has(region)).map((region) => ({ region, tone: "info" as const, label: t("figure3d.clearance.loaded") })),
        ];
    }, [blocked, loads, t]);

    if (blocked.length === 0) return null;
    return <BodyMapAuto highlights={highlights} size="sm" locale={locale} stageClassName="h-[240px]" />;
}
