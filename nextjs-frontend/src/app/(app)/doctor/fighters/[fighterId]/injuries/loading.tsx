import { SecHeadSk, Skel, TableSk } from "@/components/doctor/skeletons";
import { getTranslator } from "@/lib/i18n/server";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <Skel label={t("doctorPages.loading.injuries")}>
            <SecHeadSk />
            <TableSk title rows={3} cols={5} />
            <TableSk title rows={2} cols={5} />
        </Skel>
    );
}
