import { CardGridSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.roles")}>
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-6">
                <CardGridSkeleton columns={4} count={4} height="h-40" />
                <TableCardSkeleton rows={12} />
            </div>
        </LoadingRegion>
    );
}
