"use client";

import { Download, Printer } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { toCsv } from "@/lib/csv";

/** Prints the page; the browser's dialog also saves it as a PDF. The app shell hides itself on paper. */
export function PrintButton({ size = "md" }: { size?: "sm" | "md" }) {
    const t = useT();
    return (
        <Button variant="secondary" size={size} onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("ux.export.print")}
        </Button>
    );
}

/** Downloads rows the page already shows as a CSV file Excel opens with Vietnamese intact. */
export function CsvButton({ filename, header, rows, size = "md" }: { filename: string; header: string[]; rows: (string | number | null)[][]; size?: "sm" | "md" }) {
    const t = useT();
    const download = () => {
        const url = URL.createObjectURL(new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: filename });
        link.click();
        URL.revokeObjectURL(url);
    };
    return (
        <Button variant="secondary" size={size} onClick={download} disabled={rows.length === 0}>
            <Download aria-hidden />
            {t("ux.export.csv")}
        </Button>
    );
}
