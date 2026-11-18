"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function SuspensionsError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    const t = useT();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            className="mt-10"
            title={t("suspensions.errorTitle")}
            description={
                <>
                    {t("shell.error.body")}
                    {error.digest && (
                        <span className="mt-2 block text-xs text-fg-subtle">
                            {t("shell.error.reference")} <code className="font-mono">{error.digest}</code>
                        </span>
                    )}
                </>
            }
            action={
                <Button type="button" onClick={() => retry()}>
                    <RotateCcw aria-hidden className="size-4" />
                    {t("suspensions.errorRetry")}
                </Button>
            }
        />
    );
}
