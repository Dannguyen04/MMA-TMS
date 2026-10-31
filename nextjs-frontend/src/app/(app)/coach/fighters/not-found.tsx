import { ArrowLeft, UserX } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { routes } from "@/lib/routes";

export default function CoachFighterNotFound() {
    return (
        <EmptyState
            className="mt-10"
            icon={<UserX />}
            title="Fighter not found"
            description="This fighter isn't on your roster, or the profile no longer exists. Ask an administrator if you should have access."
            action={
                <Link href={routes.coach.fighters} className={buttonClasses({ variant: "secondary" })}>
                    <ArrowLeft aria-hidden />
                    Back to fighters
                </Link>
            }
        />
    );
}
