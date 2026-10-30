import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.settings")}>
            <PageHeaderSkeleton />
            <Skeleton className="h-[48rem] rounded-xl" />
        </LoadingRegion>
    );
}
