import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function WeighInLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("boutFighter.loading.weighIn")}>
            <PageHeaderSkeleton />
            <div className="flex max-w-lg flex-col gap-4">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
            </div>
        </LoadingRegion>
    );
}
