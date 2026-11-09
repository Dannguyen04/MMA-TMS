import type { ReactNode } from "react";

import { Sk } from "./ui";

/**
 * Loading placeholders for the doctor pages, one shape per layout (table, cards, columns, detail, form, profile), so the
 * page appears in its final arrangement the moment a link is clicked and the data fills in where the grey blocks were.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
/** Widths that vary row to row so a placeholder list doesn't look like a barcode. */
const W = ["62%", "48%", "71%", "55%", "66%", "43%", "58%", "69%"];

/** The announced region around a placeholder. */
export function Skel({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div aria-busy="true" aria-live="polite" className={`sk-page ${className}`}>
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}

/** A page title with its subtitle and action buttons. */
export function HeadSk({ actions = 1 }: { actions?: number }) {
    return (
        <div className="sk-head">
            <div className="sk-stack">
                <Sk w={260} h={36} r={8} />
                <Sk w={200} h={14} />
            </div>
            {actions > 0 && (
                <div className="sk-row">
                    {range(actions).map((i) => (
                        <Sk key={i} w={150} h={40} r={8} />
                    ))}
                </div>
            )}
        </div>
    );
}

/** A section title under the profile tabs. */
export function SecHeadSk({ action = true }: { action?: boolean }) {
    return (
        <div className="sk-head">
            <div className="sk-stack">
                <Sk w={180} h={26} r={6} />
                <Sk w={150} h={13} />
            </div>
            {action && <Sk w={170} h={40} r={8} />}
        </div>
    );
}

/** A row of filter pills. */
export function FilterSk({ n = 4 }: { n?: number }) {
    return (
        <div className="sk-row">
            {range(n).map((i) => (
                <Sk key={i} w={i === 0 ? 92 : 110} h={34} r={999} />
            ))}
        </div>
    );
}

/** A panel holding a table: header cells, then rows. */
export function TableSk({ rows = 6, cols = 5, title = false }: { rows?: number; cols?: number; title?: boolean }) {
    return (
        <div className="yt-panel sk-panel">
            {title && <Sk w={170} h={20} />}
            <div className="sk-table" style={{ ["--cols" as string]: cols }}>
                {range(cols).map((c) => (
                    <Sk key={`h${c}`} w={c === 0 ? "55%" : "40%"} h={11} />
                ))}
                {range(rows).flatMap((r) =>
                    range(cols).map((c) => (c === 0 ? <Sk key={`${r}-${c}`} w={W[r % W.length]} h={15} /> : <Sk key={`${r}-${c}`} w={c === cols - 1 ? 84 : "60%"} h={c === cols - 1 ? 24 : 13} r={c === cols - 1 ? 999 : 6} />)),
                )}
            </div>
        </div>
    );
}

/** A panel with a heading and a few text lines. */
export function PanelSk({ lines = 3, tall }: { lines?: number; tall?: number }) {
    return (
        <div className="yt-panel sk-panel" style={tall ? { minHeight: tall } : undefined}>
            <Sk w={150} h={20} />
            {range(lines).map((i) => (
                <Sk key={i} w={W[(i + 2) % W.length]} h={13} />
            ))}
        </div>
    );
}

/** A grid of cards (recovery plans). */
export function CardsSk({ n = 4 }: { n?: number }) {
    return (
        <div className="sk-cards">
            {range(n).map((i) => (
                <div key={i} className="yt-panel sk-panel">
                    <div className="sk-between">
                        <Sk w="55%" h={20} />
                        <Sk w={90} h={24} r={999} />
                    </div>
                    <Sk w="45%" h={13} />
                    <Sk w="100%" h={10} r={999} />
                    <Sk w="70%" h={13} />
                    <Sk w={110} h={14} />
                </div>
            ))}
        </div>
    );
}

/** Side-by-side columns of cards (triage lanes, clearance columns). */
export function ColumnsSk({ cards = [3, 2, 2], cardHeight = 120 }: { cards?: number[]; cardHeight?: number }) {
    return (
        <div className="sk-cols" style={{ ["--n" as string]: cards.length }}>
            {cards.map((n, c) => (
                <div key={c} className="sk-stack">
                    <div className="sk-col-head">
                        <Sk w={120} h={20} />
                        <Sk w={170} h={12} />
                    </div>
                    {range(n).map((i) => (
                        <div key={i} className="yt-panel sk-panel" style={{ minHeight: cardHeight }}>
                            <Sk w={W[(c + i) % W.length]} h={18} />
                            <Sk w="50%" h={12} />
                            <Sk w={96} h={24} r={999} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** A form card: sections of labels and inputs. */
export function FormSk({ sections = 3 }: { sections?: number }) {
    return (
        <div className="yt-panel sk-panel sk-form">
            {range(sections).map((s) => (
                <div key={s} className="sk-form-sec">
                    <div className="sk-stack">
                        <Sk w={140} h={18} />
                        <Sk w="80%" h={12} />
                    </div>
                    <div className="sk-fields">
                        {range(s === 0 ? 3 : 4).map((f) => (
                            <div key={f} className="sk-stack">
                                <Sk w={90} h={12} />
                                <Sk w="100%" h={40} r={8} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <div className="sk-row sk-end">
                <Sk w={80} h={40} r={8} />
                <Sk w={150} h={40} r={8} />
            </div>
        </div>
    );
}

/** A record's page: back link, title with badges, then two columns of panels. */
export function DetailSk() {
    return (
        <>
            <div className="sk-stack">
                <Sk w={110} h={14} />
                <Sk w={90} h={12} />
                <Sk w={340} h={34} r={8} />
                <div className="sk-row">
                    <Sk w={90} h={24} r={999} />
                    <Sk w={110} h={24} r={999} />
                    <Sk w={140} h={24} r={999} />
                </div>
            </div>
            <div className="sk-detail">
                <div className="sk-stack">
                    <PanelSk lines={4} />
                    <PanelSk lines={5} />
                </div>
                <div className="sk-stack">
                    <PanelSk lines={3} />
                    <PanelSk lines={3} />
                </div>
            </div>
        </>
    );
}

/** The fighter's header while it loads; the real tabs are already there, so the doctor can move on straight away. */
export function FighterHeadSk({ tabs }: { tabs: ReactNode }) {
    return (
        <>
            <Sk w={60} h={14} />
            <div className="hs-top" aria-hidden>
                <div className="hs-id">
                    <Sk w={104} h={118} r={14} />
                    <div className="sk-stack">
                        <Sk w={260} h={34} r={8} />
                        <Sk w={360} h={14} />
                        <div className="sk-row">
                            <Sk w={230} h={30} r={10} />
                            <Sk w={190} h={30} r={10} />
                        </div>
                    </div>
                </div>
                <div className="sk-row">
                    <Sk w={150} h={40} r={8} />
                    <Sk w={150} h={40} r={8} />
                </div>
            </div>
            {tabs}
        </>
    );
}

/** The profile's overview: body map, then two columns of panels. */
export function OverviewSk() {
    return (
        <div className="hs-grid">
            <div className="yt-panel sk-panel sk-plate" style={{ minHeight: 560 }}>
                <Sk w={130} h={20} />
            </div>
            <div className="hs-col">
                <PanelSk lines={3} />
                <PanelSk lines={4} />
                <PanelSk lines={2} />
            </div>
            <div className="hs-col hs-col3">
                <PanelSk lines={5} tall={260} />
                <PanelSk lines={3} />
            </div>
        </div>
    );
}

/** The triage board ("Hôm nay"). */
export function DashboardSk() {
    return (
        <>
            <div className="sk-head">
                <div className="sk-stack">
                    <Sk w={300} h={38} r={8} />
                    <Sk w={240} h={14} />
                </div>
                <div className="sk-row">
                    {range(3).map((i) => (
                        <Sk key={i} w={96} h={44} r={10} />
                    ))}
                </div>
            </div>
            <div className="sk-row">
                <Sk w={150} h={40} r={8} />
                <Sk w={140} h={40} r={8} />
            </div>
            <Sk w="100%" h={52} r={12} />
            <ColumnsSk cards={[3, 3, 2]} cardHeight={150} />
            <div className="sk-detail">
                <PanelSk lines={4} tall={200} />
                <PanelSk lines={3} tall={200} />
            </div>
        </>
    );
}

/** One day of the medical history: a date, then its events. */
export function HistorySk({ days = 3 }: { days?: number }) {
    return (
        <>
            {range(days).map((d) => (
                <TableSk key={d} title rows={d === 0 ? 3 : 2} cols={3} />
            ))}
        </>
    );
}
