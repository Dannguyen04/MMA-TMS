import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.newUser")}>
            <PageHeaderSkeleton back />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Skeleton className="h-[34rem] rounded-xl lg:col-span-2" />
                <div className="flex flex-col gap-6">
                    <Skeleton className="h-72 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                </div>
            </div>
        </LoadingRegion>
    );
}
