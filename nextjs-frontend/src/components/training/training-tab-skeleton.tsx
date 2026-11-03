import { LoadingRegion, SectionHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/** Placeholder for the coach's fighter Training tab (no page header — the fighter layout provides it). */
export function TrainingTabSkeleton({ label, locale = "en" }: { label?: string; locale?: Locale } = {}) {
    return (
        <LoadingRegion label={label ?? createTranslator(locale)("screens.shared.loadingTraining")} className="flex flex-col gap-6">
            <SectionHeaderSkeleton withAction />
            <Skeleton className="h-52 rounded-xl" />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-xl" />
        </LoadingRegion>
    );
}
