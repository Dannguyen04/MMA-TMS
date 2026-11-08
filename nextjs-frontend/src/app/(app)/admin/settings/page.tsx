import { Clock3 } from "lucide-react";
import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings-form";
import { Callout } from "@/components/training/callout";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { getSettings } from "@/lib/services/admin";
import { platformFeatureAvailable } from "@/lib/services/platform-features";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.misc.adminPages.settings.title") };
}

/** Container formats the video pipeline can decode. */
const SUPPORTED_FORMATS = ["mp4", "mov", "webm", "mkv", "avi"];

export default async function AdminSettingsPage() {
    const { t } = await getTranslator();
    await requireRole("admin");
    const settings = await getSettings();
    const editable = platformFeatureAvailable("systemSettings");
    const formatOptions = [...new Set([...SUPPORTED_FORMATS, ...settings.allowedVideoFormats])];

    return (
        <>
            <PageHeader title={t("screens.misc.adminPages.settings.title")} description={t("screens.misc.adminPages.settings.description")} />
            <div className="flex flex-col gap-6">
                {!editable && (
                    <Callout tone="info" icon={Clock3} title={t("screens.misc.adminPages.settings.lockedTitle")}>
                        {t("screens.misc.adminPages.settings.lockedBody")}
                    </Callout>
                )}
                <Card className="min-w-0">
                    <SettingsForm settings={settings} formatOptions={formatOptions} readOnly={!editable} />
                </Card>
            </div>
        </>
    );
}
