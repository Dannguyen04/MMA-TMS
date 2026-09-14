import { FighterProfileHeaderSkeleton, ProfileOverviewSkeleton } from "@/components/dashboard/profile-overview-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <>
            <FighterProfileHeaderSkeleton meta />
            <div className="mb-6 flex gap-6 overflow-hidden border-b border-border pb-3">
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-5 w-24 shrink-0" />
                ))}
            </div>
            <ProfileOverviewSkeleton label="Loading health profile" />
        </>
    );
}
