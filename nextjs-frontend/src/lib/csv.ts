/**
 * RFC 4180 CSV with a byte-order mark, so Excel reads Vietnamese as UTF-8. A cell that starts like a formula
 * (= + - @) gets a leading apostrophe so a spreadsheet never runs it.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
    const cell = (value: string | number | null) => {
        if (value === null) return "";
        let text = String(value);
        if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
