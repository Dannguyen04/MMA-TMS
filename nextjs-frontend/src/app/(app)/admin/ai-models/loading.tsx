import { CardGridSkeleton, LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.aiModels")}>
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-8">
                <Skeleton className="h-20 rounded-xl" />
                {Array.from({ length: 2 }, (_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                        <Skeleton className="h-11 w-96 max-w-full" />
                        <CardGridSkeleton columns={2} count={2} height="h-64" />
                    </div>
                ))}
            </div>
        </LoadingRegion>
    );
}
