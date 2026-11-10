import { FilterSk, HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";
import { getTranslator } from "@/lib/i18n/server";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <div className="yt-page">
            <Skel label={t("doctorPages.loading.reviewRequests")}>
                <HeadSk actions={0} />
                <FilterSk n={3} />
                <TableSk rows={6} cols={5} />
            </Skel>
        </div>
    );
}
