import { GoalsTabSkeleton } from "@/components/performance/tab-skeletons";
import { getLocale } from "@/lib/i18n/server";

export default async function CoachFighterGoalsLoading() {
    return <GoalsTabSkeleton locale={await getLocale()} />;
}
