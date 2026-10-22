"use client";

import { useT } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/state";

/** Success toast for an action dialog on the bout screens, after the dialog has closed. */
export function useNotify() {
    const t = useT();
    const toast = useToast();
    return (state: ActionState<unknown>) => toast({ title: state.message ?? t("coachBouts.notify.saved"), tone: "success" });
}
