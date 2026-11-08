"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    const t = useT();
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            className="mt-10"
            title={t("shell.error.title")}
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
                <Button onClick={() => retry()}>
                    <RotateCcw aria-hidden />
                    {t("shell.error.retry")}
                </Button>
            }
        />
    );
}
