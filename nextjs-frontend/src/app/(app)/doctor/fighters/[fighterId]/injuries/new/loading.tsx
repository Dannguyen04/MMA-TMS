import { FormSk, HeadSk, Skel } from "@/components/doctor/skeletons";
import { getTranslator } from "@/lib/i18n/server";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default async function Loading() {
    const { t } = await getTranslator();
    return (
        <Skel label={t("doctorPages.loading.injuryForm")}>
            <HeadSk actions={0} />
            <FormSk />
        </Skel>
    );
}
