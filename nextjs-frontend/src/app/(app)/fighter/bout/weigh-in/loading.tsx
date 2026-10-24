import { LoadingRegion, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function FighterWeighInLoading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("weighIn.loading")} className="mx-auto w-full max-w-md">
            <PageHeaderSkeleton eyebrow back />
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-5 py-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-11 w-full" />
            </div>
        </LoadingRegion>
    );
}
