"use client";

import { useDemoCopy } from "@/components/i18n/locale-provider";

export function FieldOptional() {
    const copy = useDemoCopy();
    return <span className="ml-1.5 text-xs font-normal text-fg-subtle">{copy("(optional)")}</span>;
}
