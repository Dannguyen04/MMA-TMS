import { QueueSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return <QueueSkeleton label="Loading today" actions={1} />;
}
