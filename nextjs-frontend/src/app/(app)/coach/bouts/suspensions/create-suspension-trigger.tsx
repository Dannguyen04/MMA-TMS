"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { CreateSuspensionPanel } from "./create-suspension-panel";

export interface CreateSuspensionTriggerProps {
    fighters: Array<{ id: string; name: string }>;
    locale: Locale;
    todayKey: string;
}

export function CreateSuspensionTrigger({
    fighters,
    locale,
    todayKey,
}: CreateSuspensionTriggerProps) {
    const t = useT();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus aria-hidden className="size-4" />
                {t("suspensions.newSuspension")}
            </Button>
            <CreateSuspensionPanel
                open={open}
                onClose={() => setOpen(false)}
                fighters={fighters}
                locale={locale}
                todayKey={todayKey}
            />
        </>
    );
}
