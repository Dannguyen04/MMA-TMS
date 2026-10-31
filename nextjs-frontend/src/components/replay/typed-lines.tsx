"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import styles from "./replay.module.css";

/** Advice lines written out letter by letter while the break runs; complete at once otherwise. */
export function TypedLines({ lines, typing }: { lines: string[]; typing: boolean }) {
    const total = lines.reduce((n, line) => n + line.length, 0);
    const [count, setCount] = useState(typing ? 0 : total);

    useEffect(() => {
        if (!typing) return;
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const next = Math.min(total, Math.floor((now - start) / 22));
            setCount(next);
            if (next < total) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [typing, total]);

    const starts = lines.map((_, i) => lines.slice(0, i).reduce((n, line) => n + line.length, 0));
    return (
        <ol className="mt-2 flex flex-col gap-1.5 text-[15px] leading-6 text-fg">
            {lines.map((line, i) => {
                const left = count - starts[i];
                const shown = line.slice(0, Math.max(0, left));
                const active = left > 0 && left < line.length;
                return (
                    <li key={i} className={cn("flex gap-2", shown.length === 0 && "invisible")}>
                        <span className="font-display font-bold text-primary-soft-fg tabular-nums">{i + 1}</span>
                        <span className={cn(active && styles.typing)}>{shown}</span>
                    </li>
                );
            })}
        </ol>
    );
}
