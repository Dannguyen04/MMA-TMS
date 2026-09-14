import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { LiveFormCheck } from "@/components/video/live-form-check";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Live form check" };

export default async function FighterLiveFormCheckPage() {
    await requireRole("fighter");
    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.videos, label: "Videos" }}
                eyebrow="Beta"
                title="Live form check"
                description="Practise your roundhouse kick in front of the camera and get instant feedback on knee chamber, extension and speed."
            />
            <LiveFormCheck />
        </>
    );
}
