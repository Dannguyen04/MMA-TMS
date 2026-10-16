import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeighInForm } from "@/components/domain/weigh-in-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Today's weight" };

export default async function WeighInPage() {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.bout, label: "Bout" }}
                title="Today's weight"
                description="Log this morning's weight. Saving again today replaces the earlier number."
            />
            <WeighInForm />
        </>
    );
}
