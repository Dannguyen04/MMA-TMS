"use client";

import { RouteError } from "@/components/feedback/route-error";

/** A failing tab keeps the fighter's header and tabs, so the coach can switch tabs or retry. */
export default function FighterTabError(props: { error: Error & { digest?: string }; retry: () => void }) {
    return <RouteError {...props} scope="section" />;
}
