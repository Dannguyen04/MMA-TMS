import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { LiveFormCheck } from "@/components/video/live-form-check";
import { requireRole } from "@/lib/auth/session";
import { getDemoCopy } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const copy = await getDemoCopy();
    return { title: copy("Live form check") };
}

export default async function FighterLiveFormCheckPage() {
    const copy = await getDemoCopy();
    await requireRole("fighter");
    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: copy("Film") }}
                eyebrow={copy("Beta")}
                title={copy("Live form check")}
                description={copy("Practise your roundhouse kick in front of the camera and get instant feedback on knee chamber, extension and speed.")}
            />
            <LiveFormCheck />
        </>
    );
}
