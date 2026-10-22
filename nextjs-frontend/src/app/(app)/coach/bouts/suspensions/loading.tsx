import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function SuspensionsLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachBouts.suspensions.loading")}>
            <PageHeaderSkeleton actions={1} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Skeleton className="h-72 rounded-xl lg:col-span-2" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        </LoadingRegion>
    );
}
