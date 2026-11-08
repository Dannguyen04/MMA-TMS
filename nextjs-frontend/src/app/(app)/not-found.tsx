import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getTranslator } from "@/lib/i18n/server";

export default async function AppNotFound() {
    const { t } = await getTranslator();
    return (
        <EmptyState
            className="mt-10"
            icon={<SearchX />}
            title={t("shell.missing.title")}
            description={t("shell.missing.body")}
            action={
                <Link href="/" className={buttonClasses({ variant: "secondary" })}>
                    <ArrowLeft aria-hidden />
                    {t("shell.missing.back")}
                </Link>
            }
        />
    );
}
