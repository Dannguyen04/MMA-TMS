"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast, type ToastInput } from "@/components/ui/toast";

export interface FlashToastProps {
    /** Toast to show once after a redirect, or null. */
    notice: ToastInput | null;
    /** The current URL without the notice parameter, so a reload doesn't repeat the toast. */
    cleanHref: string;
}

/** Shows a one-off confirmation toast after a Server Action redirected here with ?notice=. */
export function FlashToast({ notice, cleanHref }: FlashToastProps) {
    const toast = useToast();
    const router = useRouter();
    const shown = useRef(false);

    useEffect(() => {
        if (!notice) {
            shown.current = false;
            return;
        }
        if (shown.current) return;
        shown.current = true;
        toast(notice);
        router.replace(cleanHref, { scroll: false });
    }, [notice, cleanHref, router, toast]);

    return null;
}
