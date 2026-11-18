import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getCurrentUser } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { dashboardPath } from "@/lib/routes";

export default async function AppNotFound() {
    const { t } = await getTranslator();
    const user = await getCurrentUser();
    return (
        <EmptyState
            className="mt-10"
            icon={<SearchX />}
            title={t("ux.notFound.title")}
            description={t("ux.notFound.description")}
            action={
                <Link href={user ? dashboardPath(user.role) : "/"} className={buttonClasses({ variant: "secondary" })}>
                    <ArrowLeft aria-hidden />
                    {t("ux.notFound.home")}
                </Link>
            }
        />
    );
}
