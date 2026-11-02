import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import type { ToastInput } from "@/components/ui/toast";
import type { SignInNotice } from "@/lib/actions/auth";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSessionAccount, homePath } from "@/lib/auth/session";
import { parseEnum } from "@/lib/query";
import { routes, safeRedirectPath } from "@/lib/routes";
import { param } from "@/lib/utils";
import { DemoAccounts } from "./demo-accounts";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.metaTitle") };
}

/** Toasts after a recovery link set a password (`resetPasswordAction`), after "forgot password" or for an approved applicant. */
const SIGN_IN_NOTICES: Record<SignInNotice, { title: MessageKey; description: MessageKey }> = {
    "password-updated": { title: "auth.passwordUpdated", description: "auth.passwordUpdatedText" },
    "activation-ready": { title: "auth.activationReady", description: "auth.activationReadyText" },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    const [query, { t }] = await Promise.all([searchParams, getTranslator()]);
    const next = safeRedirectPath(param(query.next));
    // Only known notices: a crafted `?notice=constructor` must not reach the prototype.
    const notice = parseEnum(param(query.notice), Object.keys(SIGN_IN_NOTICES) as SignInNotice[]);

    const toast = (keys: { title: MessageKey; description: MessageKey }): ToastInput => ({ title: t(keys.title), description: t(keys.description) });

    return (
        <div>
            <FlashToast notice={notice ? toast(SIGN_IN_NOTICES[notice]) : null} cleanHref={routes.login} />
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("auth.title")}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">{t("auth.subtitle")}</p>
            <LoginForm next={next} />
            {isDemoAuthEnabled() && <DemoAccounts next={next} />}
        </div>
    );
}
