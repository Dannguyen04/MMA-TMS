"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser print dialog; the page provides a print stylesheet. */
export function PrintButton({ label = "Print" }: { label?: string }) {
    return (
        <Button variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden />
            {label}
        </Button>
    );
}
