"use client";

import { Eraser, Lock, WandSparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

/** One part of a doctor's form, with an anchor (`#{prefix}{id}`) the progress column links to. */
export function FormPart({
    prefix,
    id,
    title,
    description,
    aside,
    children,
}: {
    prefix: string;
    id: string;
    title: string;
    description: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const headingId = `${prefix}${id}-h`;
    return (
        <section id={`${prefix}${id}`} aria-labelledby={headingId} className="flex scroll-mt-32 flex-col gap-5 px-5 py-6 sm:px-7">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h3 id={headingId} className="text-[17px] leading-snug font-bold text-fg">
                        {title}
                    </h3>
                    <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-fg-muted">{description}</p>
                </div>
                {aside && <span className="shrink-0 pt-0.5 text-[13px] font-semibold whitespace-nowrap text-fg-muted">{aside}</span>}
            </header>
            {children}
        </section>
    );
}

/** Demo mode only: fills the form with plausible sample values for presenting the flow, or empties it again. */
export function DemoFillBar({
    title,
    description,
    onFill,
    onClear,
    className = "",
}: {
    title?: string;
    description: string;
    onFill: () => void;
    onClear: () => void;
    className?: string;
}) {
    const t = useT();
    return (
        <div
            role="region"
            aria-label={t("doctorMedical.demo.region")}
            className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 rounded-xl border border-dashed border-primary/45 bg-primary-soft/55 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] ${className}`}
        >
            <WandSparkles aria-hidden className="size-5 text-primary-soft-fg" />
            <div>
                <p className="text-sm font-semibold text-fg">{title ?? t("doctorMedical.demo.title")}</p>
                <p className="mt-0.5 max-w-[80ch] text-[13px] text-fg-muted">{description}</p>
            </div>
            <div className="col-span-2 flex gap-2 md:col-span-1">
                <Button variant="secondary" size="sm" onClick={onClear}>
                    <Eraser aria-hidden />
                    {t("doctorMedical.demo.clear")}
                </Button>
                <Button size="sm" onClick={onFill}>
                    <WandSparkles aria-hidden />
                    {t("doctorMedical.demo.fill")}
                </Button>
            </div>
        </div>
    );
}

/** A private-to-doctors marker for notes coaches and fighters never see. */
export function DoctorsOnly({ children }: { children?: ReactNode }) {
    const t = useT();
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-neutral-fg">
            <Lock aria-hidden className="size-3.5" />
            {children ?? t("doctorMedical.doctorsOnly")}
        </span>
    );
}

/** Whether the two-column form layout (form and side column, from 1280px) is showing. */
export function useWideLayout() {
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(min-width: 1280px)");
        const sync = () => setWide(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);
    return wide;
}
