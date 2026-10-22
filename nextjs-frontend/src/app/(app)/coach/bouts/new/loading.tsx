import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function NewBoutLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachBouts.new.loading")}>
            <PageHeaderSkeleton back eyebrow />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        </LoadingRegion>
    );
}
