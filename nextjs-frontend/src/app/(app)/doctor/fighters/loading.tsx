import { FilterSk, HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";
import { getTranslator } from "@/lib/i18n/server";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <div className="yt-page">
            <Skel label={t("doctorPages.loading.fighters")}>
                <HeadSk actions={0} />
                <FilterSk n={4} />
                <TableSk rows={8} cols={5} />
            </Skel>
        </div>
    );
}
