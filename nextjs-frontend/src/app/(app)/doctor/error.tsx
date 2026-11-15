"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { ErrorBox } from "@/components/doctor/ui";
import { useT } from "@/components/i18n/locale-provider";

export default function DoctorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    const t = useT();
    useEffect(() => {
        console.error(error);
    }, [error]);
    return (
        <div className="yt-page">
            <ErrorBox
                title={t("doctorPages.error.title")}
                action={
                    <button type="button" className="yt-btn" data-v="primary" onClick={() => retry()}>
                        <RotateCcw aria-hidden />
                        {t("doctorPages.error.retry")}
                    </button>
                }
            >
                {t("doctorPages.error.body")}
                {error.digest && <span className="yt-muted"> {t("doctorPages.error.reference", { digest: error.digest })}</span>}
            </ErrorBox>
        </div>
    );
}
