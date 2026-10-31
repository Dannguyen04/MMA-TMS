import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterBoutLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("boutFighter.loading.bout")}>
            <PageHeaderSkeleton />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-80 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        </LoadingRegion>
    );
}
