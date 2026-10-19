import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionAccount, homePath } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Joining the academy" };

/** The academy only trains fighters a coach has already added. There is no public application. */
export default async function RegisterPage() {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Fighters are added by the academy</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                Lotus Combat Academy trains fighters a coach has already brought in. There is no application to fill in. Sign in with the account your coach gave you.
            </p>
            <p className="mt-6 text-sm">
                <Link href={routes.login} className="font-medium text-primary-soft-fg hover:underline">
                    Back to sign in
                </Link>
            </p>
        </div>
    );
}
