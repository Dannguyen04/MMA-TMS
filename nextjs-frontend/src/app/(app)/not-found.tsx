import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function AppNotFound() {
    return (
        <EmptyState
            className="mt-10"
            icon={<SearchX />}
            title="We couldn't find that"
            description="It may have been removed, or it belongs to a fighter you aren't assigned to."
            action={
                <Link href="/" className={buttonClasses({ variant: "secondary" })}>
                    <ArrowLeft aria-hidden />
                    Back to dashboard
                </Link>
            }
        />
    );
}
