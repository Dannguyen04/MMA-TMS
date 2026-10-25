import { TrainingTabSkeleton } from "@/components/training/training-tab-skeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function CoachFighterTrainingLoading() {
    const { t } = await getTranslator();
    return <TrainingTabSkeleton label={t("training.loading.fighterTraining")} />;
}
