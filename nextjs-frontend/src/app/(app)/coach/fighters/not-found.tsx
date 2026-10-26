import { ArrowLeft, UserX } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export default async function CoachFighterNotFound() {
    const { t } = await getTranslator();
    return (
        <EmptyState
            className="mt-10"
            icon={<UserX />}
            title={t("training.notFound.title")}
            description={t("training.notFound.desc")}
            action={
                <Link href={routes.coach.fighters} className={buttonClasses({ variant: "secondary" })}>
                    <ArrowLeft aria-hidden />
                    {t("training.notFound.back")}
                </Link>
            }
        />
    );
}
