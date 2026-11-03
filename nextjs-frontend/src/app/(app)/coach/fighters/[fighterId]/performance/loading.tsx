import { PerformanceTabSkeleton } from "@/components/performance/tab-skeletons";
import { getLocale } from "@/lib/i18n/server";

export default async function CoachFighterPerformanceLoading() {
    return <PerformanceTabSkeleton locale={await getLocale()} />;
}
