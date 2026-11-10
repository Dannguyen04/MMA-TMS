import { ColumnsSk, FilterSk, HeadSk, Skel } from "@/components/doctor/skeletons";
import { getTranslator } from "@/lib/i18n/server";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <div className="yt-page">
            <Skel label={t("doctorPages.loading.clearance")}>
                <HeadSk />
                <FilterSk n={5} />
                <ColumnsSk cards={[2, 2, 1]} />
            </Skel>
        </div>
    );
}
