import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { getDemoCopy } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const copy = await getDemoCopy();
    return { title: copy("Upload training video") };
}

export default async function FighterUploadVideoPage({ searchParams }: PageProps<"/fighter/videos/upload">) {
    const copy = await getDemoCopy();
    const user = await requireRole("fighter");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: copy("Film") }}
                title={copy("Upload training video")}
                description={copy("The AI detects your strikes, guard drops and footwork. Your coach then reviews the findings with you.")}
            />
            <UploadWizard
                role="fighter"
                viewerId={user.id}
                {...data}
                initialFighterId={user.profileId}
                initialSessionId={param(params.session) ?? null}
                cancelHref={routes.fighter.videos}
            />
        </>
    );
}
