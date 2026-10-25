import { LoadingRegion, PageHeaderSkeleton, Skeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function NotificationsLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("notifications.loading")}>
            <PageHeaderSkeleton meta actions={2} />
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-11 w-44 rounded-xl" />
                    <Skeleton className="h-8 w-[36rem] max-w-full rounded-full" />
                </div>
                <TableCardSkeleton rows={8} />
            </div>
        </LoadingRegion>
    );
}
