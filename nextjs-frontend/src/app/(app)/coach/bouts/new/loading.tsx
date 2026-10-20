import { Card } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("coachBouts.loading.newBout")}>
            <PageHeaderSkeleton back />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="p-6 lg:col-span-2">
                    <div className="flex flex-col gap-6">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </Card>
            </div>
        </LoadingRegion>
    );
}
