"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <ErrorState
            className="mt-10"
            title="This page didn't load"
            description={
                <>
                    Something went wrong while loading this data. Try again — if it keeps happening, contact your administrator.
                    {error.digest && (
                        <span className="mt-2 block text-xs text-fg-subtle">
                            Reference <code className="font-mono">{error.digest}</code>
                        </span>
                    )}
                </>
            }
            action={
                <Button onClick={() => retry()}>
                    <RotateCcw aria-hidden />
                    Try again
                </Button>
            }
        />
    );
}
