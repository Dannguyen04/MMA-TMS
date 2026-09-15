import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/admin";

export const metadata: Metadata = { title: "System settings" };

/** Container formats the video pipeline can decode. */
const SUPPORTED_FORMATS = ["mp4", "mov", "webm", "mkv", "avi"];

export default async function AdminSettingsPage() {
    await requireRole("admin");
    const settings = await getSettings();
    const formatOptions = [...new Set([...SUPPORTED_FORMATS, ...settings.allowedVideoFormats])];

    return (
        <>
            <PageHeader
                title="System settings"
                description="Platform-wide configuration. Changes apply to every account as soon as you save and are recorded in the audit log."
            />
            <Card className="min-w-0">
                <SettingsForm settings={settings} formatOptions={formatOptions} />
            </Card>
        </>
    );
}
