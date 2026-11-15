import { FilterRowSkeleton, LoadingRegion, PageHeaderSkeleton, TableCardSkeleton } from "@/components/ui/skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <LoadingRegion label={t("screens.admin.loading.users")}>
            <PageHeaderSkeleton actions={1} />
            <div className="flex flex-col gap-4">
                <FilterRowSkeleton selects={2} />
                <TableCardSkeleton rows={10} withHeader />
            </div>
        </LoadingRegion>
    );
}
