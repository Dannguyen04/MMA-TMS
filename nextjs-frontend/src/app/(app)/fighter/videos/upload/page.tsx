import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "@/components/video/upload-wizard";
import { loadUploadWizardData } from "@/components/video/upload-wizard-data";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Upload video" };

export default async function FighterUploadVideoPage({ searchParams }: PageProps<"/fighter/videos/upload">) {
    const user = await requireRole("fighter");
    const params = await searchParams;
    const data = await loadUploadWizardData(user);

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: "Videos" }}
                title="Upload training video"
                description="The AI detects your strikes, guard drops and footwork. Your coach then reviews the findings with you."
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
