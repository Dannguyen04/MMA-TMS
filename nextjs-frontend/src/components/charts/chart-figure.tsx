"use client";

import { Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stepDecimals } from "./ticks";

/** Tabular twin of a chart. The first column labels each row (e.g. the week). */
export interface ChartTableData {
    columns: string[];
    rows: (string | number)[][];
}

export interface ChartFigureProps {
    title?: ReactNode;
    description?: ReactNode;
    /** The chart itself (and its legend, if any). */
    children: ReactNode;
    table: ChartTableData;
    /** Accessible caption for the data table. Defaults to the title when it is plain text. */
    tableCaption?: string;
    className?: string;
}

/**
 * Wraps a chart with an optional title and description and a "Show data table" toggle that
 * reveals the same data as a real table, so no value is ever reachable only through hover.
 */
export function ChartFigure({ title, description, children, table, tableCaption, className }: ChartFigureProps) {
    const [showTable, setShowTable] = useState(false);
    const tableId = useId();
    const caption = tableCaption ?? (typeof title === "string" ? title : undefined);
    // Value columns (anything holding digits, e.g. 72, "72%" or "—" beside numbers) align right.
    const numericColumns = table.columns.map(
        (_, column) => column > 0 && table.rows.some((row) => typeof row[column] === "number" || /\d/.test(String(row[column] ?? ""))),
    );

    return (
        <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
            <div className="flex items-start justify-between gap-3">
                {title || description ? (
                    <figcaption className="min-w-0">
                        {title && <p className="text-sm font-medium text-fg">{title}</p>}
                        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
                    </figcaption>
                ) : (
                    <span aria-hidden />
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={showTable}
                    aria-controls={tableId}
                    onClick={() => setShowTable((shown) => !shown)}
                    className="-mr-2"
                >
                    <Table2 aria-hidden />
                    {showTable ? "Hide data table" : "Show data table"}
                </Button>
            </div>

            {children}

            <div id={tableId} hidden={!showTable} className="overflow-hidden rounded-lg border border-border">
                {showTable && (
                    <Table caption={caption}>
                        <THead>
                            <tr>
                                {table.columns.map((column, index) => (
                                    <TH key={`${column}-${index}`} className={cn(numericColumns[index] && "text-right")}>
                                        {column}
                                    </TH>
                                ))}
                            </tr>
                        </THead>
                        <TBody>
                            {table.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={Math.max(1, table.columns.length)} className="px-5 py-3 text-fg-muted">
                                        No data
                                    </td>
                                </tr>
                            ) : (
                                table.rows.map((row, rowIndex) => (
                                    <TR key={rowIndex}>
                                        {row.map((cell, index) =>
                                            index === 0 ? (
                                                <th
                                                    key={index}
                                                    scope="row"
                                                    className="px-4 py-3 text-left font-medium whitespace-nowrap text-fg first:pl-5 last:pr-5"
                                                >
                                                    {formatCell(cell)}
                                                </th>
                                            ) : (
                                                <TD key={index} className={cn(numericColumns[index] && "text-right")}>
                                                    {formatCell(cell)}
                                                </TD>
                                            ),
                                        )}
                                    </TR>
                                ))
                            )}
                        </TBody>
                    </Table>
                )}
            </div>
        </figure>
    );
}

/** Numbers get thousands separators and keep up to two decimals of their own precision. */
function formatCell(value: string | number): string {
    if (typeof value === "string") return value;
    return formatNumber(value, Math.min(2, stepDecimals(Math.abs(value))));
}
