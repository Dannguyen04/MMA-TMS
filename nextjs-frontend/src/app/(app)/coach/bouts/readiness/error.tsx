"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function ReadinessError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useT();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            className="mt-10"
            title={t("readiness.errorTitle")}
            description={
                <>
                    {error.message || "An unexpected error occurred while loading readiness."}
                    {error.digest && (
                        <span className="mt-2 block text-xs text-fg-subtle">
                            Reference <code className="font-mono">{error.digest}</code>
                        </span>
                    )}
                </>
            }
            action={
                <Button onClick={() => reset()}>
                    <RotateCcw aria-hidden className="size-4" />
                    {t("readiness.errorRetry")}
                </Button>
            }
        />
    );
}
